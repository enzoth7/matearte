-- Existing global and design-only coupons keep their scope.
alter table public.commerce_discounts
  add column category_codes text[] not null default '{}',
  add column include_design_items boolean not null default false;
alter table public.commerce_discounts drop constraint commerce_discounts_applicability_check;
alter table public.commerce_discounts add constraint commerce_discounts_applicability_check
  check (applicability in ('all_items','design_items','categories'));
alter table public.commerce_discounts add constraint commerce_discounts_categories_check
  check (applicability <> 'categories' or cardinality(category_codes)>0 or include_design_items);
alter table public.commerce_discount_usages add column pricing_snapshot jsonb, add column calculation_snapshot jsonb;

create function private.validate_discount_category_scope()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if new.applicability <> 'categories' then
    new.category_codes := '{}';
    new.include_design_items := false;
  else
    select coalesce(array_agg(code order by code),'{}'::text[]) into new.category_codes
    from (select distinct lower(btrim(value)) as code from unnest(new.category_codes) value where nullif(btrim(value),'') is not null) codes;
    if exists (select 1 from unnest(new.category_codes) as selected(code) where not exists (
      select 1 from public.commerce_categories category where category.code=selected.code
    )) then raise exception 'discount:invalid_category'; end if;
  end if;
  return new;
end;
$$;
revoke all on function private.validate_discount_category_scope() from public,anon,authenticated;
create trigger commerce_discounts_category_scope before insert or update of applicability,category_codes,include_design_items on public.commerce_discounts
for each row execute function private.validate_discount_category_scope();

create or replace function private.commerce_discount_result_scoped(
  p_discount public.commerce_discounts, p_items_subtotal_minor bigint,
  p_design_subtotal_minor bigint, p_category_subtotals jsonb
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_eligible_subtotal_minor bigint;
  v_discount_minor bigint;
  v_catalog_total bigint := 0;
  v_entry record;
begin
  if p_items_subtotal_minor is null or p_design_subtotal_minor is null or p_items_subtotal_minor <= 0
    or p_design_subtotal_minor < 0 or p_design_subtotal_minor > p_items_subtotal_minor
  then raise exception 'discount:not_applicable'; end if;
  if p_category_subtotals is not null then
    if jsonb_typeof(p_category_subtotals) <> 'object' then raise exception 'discount:invalid'; end if;
    for v_entry in select key,value from jsonb_each_text(p_category_subtotals) loop
      if v_entry.value is null or v_entry.value !~ '^[0-9]+$' then raise exception 'discount:invalid'; end if;
      v_catalog_total := v_catalog_total + v_entry.value::bigint;
    end loop;
    if v_catalog_total + p_design_subtotal_minor <> p_items_subtotal_minor then raise exception 'discount:invalid'; end if;
  end if;
  case p_discount.applicability
    when 'all_items' then v_eligible_subtotal_minor := p_items_subtotal_minor;
    when 'design_items' then v_eligible_subtotal_minor := p_design_subtotal_minor;
    when 'categories' then
      if p_category_subtotals is null then raise exception 'discount:not_applicable'; end if;
      select coalesce(sum(value::bigint),0) into v_eligible_subtotal_minor
      from jsonb_each_text(p_category_subtotals) where key=any(p_discount.category_codes);
      if p_discount.include_design_items then
        v_eligible_subtotal_minor := v_eligible_subtotal_minor + p_design_subtotal_minor;
      end if;
    else raise exception 'discount:invalid';
  end case;
  if v_eligible_subtotal_minor <= 0 then raise exception 'discount:not_applicable'; end if;
  v_discount_minor := case when p_discount.discount_type='percentage'
    then round(v_eligible_subtotal_minor::numeric * p_discount.value / 100)::bigint
    else p_discount.value::bigint end;
  if v_discount_minor <= 0 or v_discount_minor >= p_items_subtotal_minor or v_discount_minor > v_eligible_subtotal_minor
  then raise exception 'discount:not_applicable'; end if;
  return jsonb_build_object(
    'discountId',p_discount.id,'code',p_discount.code,'discountType',p_discount.discount_type,'discountValue',p_discount.value,
    'applicability',p_discount.applicability,'categoryCodes',p_discount.category_codes,
    'includeDesignItems',p_discount.include_design_items or p_discount.applicability='design_items',
    'eligibleSubtotalMinor',v_eligible_subtotal_minor,'discountMinor',v_discount_minor,
    'itemsSubtotalMinor',p_items_subtotal_minor,'discountedItemsSubtotalMinor',p_items_subtotal_minor-v_discount_minor
  );
end;
$$;
revoke all on function private.commerce_discount_result_scoped(public.commerce_discounts,bigint,bigint,jsonb) from public,anon,authenticated;
create or replace function private.commerce_discount_result(p_discount public.commerce_discounts,p_items_subtotal_minor bigint,p_design_subtotal_minor bigint)
returns jsonb language sql security invoker set search_path = '' as $$
select private.commerce_discount_result_scoped(p_discount,p_items_subtotal_minor,p_design_subtotal_minor,null);
$$;
revoke all on function private.commerce_discount_result(public.commerce_discounts,bigint,bigint) from public,anon,authenticated;

CREATE OR REPLACE FUNCTION public.validate_commerce_discount_scoped(p_user_id uuid, p_code text, p_items_subtotal_minor bigint, p_design_subtotal_minor bigint, p_category_subtotals jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_discount public.commerce_discounts%rowtype;
  v_today date := (now() at time zone 'America/Montevideo')::date;
begin
  if p_user_id is null then raise exception 'discount:unauthorized'; end if;

  select * into v_discount
  from public.commerce_discounts
  where code = upper(btrim(coalesce(p_code, '')));
  if not found or (v_discount.owner_user_id is not null and v_discount.owner_user_id <> p_user_id) then
    raise exception 'discount:not_found';
  end if;

  if not v_discount.enabled then raise exception 'discount:disabled'; end if;
  if v_today < v_discount.valid_from then raise exception 'discount:not_started'; end if;
  if v_today > v_discount.valid_until then raise exception 'discount:expired'; end if;
  perform private.ensure_welcome_discount_eligible(v_discount, p_user_id);

  if v_discount.redemption_limit is not null and (
    select count(*)
    from public.commerce_discount_usages usage_row
    where usage_row.discount_id = v_discount.id and usage_row.status = 'redeemed'
  ) >= v_discount.redemption_limit then
    raise exception 'discount:already_used';
  end if;

  if v_discount.redemption_limit is not null and exists (
    select 1
    from public.commerce_discount_usages usage_row
    where usage_row.discount_id = v_discount.id
      and usage_row.status = 'reserved'
      and usage_row.reserved_until > now()
  ) then
    raise exception 'discount:in_use';
  end if;

  return private.commerce_discount_result_scoped(
    v_discount,
    p_items_subtotal_minor,
    p_design_subtotal_minor,
    p_category_subtotals
  );
end;
$function$;
revoke all on function public.validate_commerce_discount_scoped(uuid,text,bigint,bigint,jsonb) from public,anon,authenticated;
grant execute on function public.validate_commerce_discount_scoped(uuid,text,bigint,bigint,jsonb) to service_role;
create or replace function public.validate_commerce_discount(p_user_id uuid,p_code text,p_items_subtotal_minor bigint,p_design_subtotal_minor bigint)
returns jsonb language sql security definer set search_path = '' as $$
select public.validate_commerce_discount_scoped(p_user_id,p_code,p_items_subtotal_minor,p_design_subtotal_minor,null);
$$;
revoke all on function public.validate_commerce_discount(uuid,text,bigint,bigint) from public,anon,authenticated;
grant execute on function public.validate_commerce_discount(uuid,text,bigint,bigint) to service_role;

CREATE OR REPLACE FUNCTION public.reserve_commerce_discount_scoped(p_user_id uuid, p_code text, p_items_subtotal_minor bigint, p_design_subtotal_minor bigint, p_checkout_key uuid, p_reserved_until timestamp with time zone, p_category_subtotals jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_discount public.commerce_discounts%rowtype;
  v_usage public.commerce_discount_usages%rowtype;
  v_result jsonb;
  v_pricing jsonb := jsonb_build_object('items',p_items_subtotal_minor,'designs',p_design_subtotal_minor,'categories',p_category_subtotals);
  v_today date := (now() at time zone 'America/Montevideo')::date;
begin
  if p_user_id is null or p_checkout_key is null or p_reserved_until <= now() then
    raise exception 'discount:invalid_reservation';
  end if;

  select * into v_discount
  from public.commerce_discounts
  where code = upper(btrim(coalesce(p_code, '')))
  for update;
  if not found or (v_discount.owner_user_id is not null and v_discount.owner_user_id <> p_user_id) then
    raise exception 'discount:not_found';
  end if;

  select * into v_usage
  from public.commerce_discount_usages
  where checkout_key = p_checkout_key
  for update;
  if found then
    if v_usage.user_id <> p_user_id or v_usage.discount_id <> v_discount.id then
      raise exception 'discount:invalid_reservation';
    end if;
    if v_usage.calculation_snapshot is not null then
      if v_usage.pricing_snapshot is distinct from v_pricing then raise exception 'discount:invalid_reservation'; end if;
      return v_usage.calculation_snapshot;
    end if;
    v_result := private.commerce_discount_result_scoped(
      v_discount,
      p_items_subtotal_minor,
      p_design_subtotal_minor,
      p_category_subtotals
    );
    if v_usage.discount_minor <> (v_result ->> 'discountMinor')::bigint then
      raise exception 'discount:invalid_reservation';
    end if;
    return v_result;
  end if;

  if not v_discount.enabled then raise exception 'discount:disabled'; end if;
  if v_today < v_discount.valid_from then raise exception 'discount:not_started'; end if;
  if v_today > v_discount.valid_until then raise exception 'discount:expired'; end if;
  perform private.ensure_welcome_discount_eligible(v_discount, p_user_id);

  delete from public.commerce_discount_usages usage_row
  where usage_row.discount_id = v_discount.id
    and usage_row.status = 'reserved'
    and usage_row.reserved_until <= now();

  if v_discount.redemption_limit is not null and (
    select count(*)
    from public.commerce_discount_usages usage_row
    where usage_row.discount_id = v_discount.id and usage_row.status = 'redeemed'
  ) >= v_discount.redemption_limit then
    raise exception 'discount:already_used';
  end if;

  if v_discount.redemption_limit is not null and exists (
    select 1
    from public.commerce_discount_usages usage_row
    where usage_row.discount_id = v_discount.id
      and usage_row.status = 'reserved'
      and usage_row.reserved_until > now()
  ) then
    raise exception 'discount:in_use';
  end if;

  v_result := private.commerce_discount_result_scoped(
    v_discount,
    p_items_subtotal_minor,
    p_design_subtotal_minor,
      p_category_subtotals
  );
  insert into public.commerce_discount_usages (
    discount_id, user_id, checkout_key, status, code, discount_type,
    discount_value, discount_minor, reserved_until, pricing_snapshot, calculation_snapshot
  ) values (
    v_discount.id, p_user_id, p_checkout_key, 'reserved', v_discount.code,
    v_discount.discount_type, v_discount.value,
    (v_result ->> 'discountMinor')::bigint, p_reserved_until, v_pricing, v_result
  );

  return v_result;
end;
$function$;
revoke all on function public.reserve_commerce_discount_scoped(uuid,text,bigint,bigint,uuid,timestamptz,jsonb) from public,anon,authenticated;
grant execute on function public.reserve_commerce_discount_scoped(uuid,text,bigint,bigint,uuid,timestamptz,jsonb) to service_role;
create or replace function public.reserve_commerce_discount(p_user_id uuid,p_code text,p_items_subtotal_minor bigint,p_design_subtotal_minor bigint,p_checkout_key uuid,p_reserved_until timestamptz)
returns jsonb language sql security definer set search_path = '' as $$
select public.reserve_commerce_discount_scoped(p_user_id,p_code,p_items_subtotal_minor,p_design_subtotal_minor,p_checkout_key,p_reserved_until,null);
$$;
revoke all on function public.reserve_commerce_discount(uuid,text,bigint,bigint,uuid,timestamptz) from public,anon,authenticated;
grant execute on function public.reserve_commerce_discount(uuid,text,bigint,bigint,uuid,timestamptz) to service_role;

-- Use the order's immutable product snapshots for PayPal category totals.
create function private.order_discount_category_subtotals(p_order_id uuid)
returns jsonb language sql security invoker set search_path = '' as $$
select coalesce(jsonb_object_agg(category,subtotal),'{}'::jsonb) from (
  select lower(btrim(coalesce(nullif(item.immutable_snapshot->'product'->>'category_code',''),
    item.immutable_snapshot->'product'->>'category',''))) as category, sum(item.total_minor) as subtotal
  from public.order_items item where item.order_id=p_order_id and item.item_type='catalog'
  group by 1
) subtotals;
$$;
revoke all on function private.order_discount_category_subtotals(uuid) from public,anon,authenticated;

CREATE OR REPLACE FUNCTION public.create_paypal_international_order(p_user_id uuid, p_cart_id uuid, p_design_prices jsonb, p_customer_snapshot jsonb, p_destination_snapshot jsonb, p_idempotency_key uuid, p_shipping_minor bigint, p_peso integer, p_discount_code text, p_usd_rate numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_base jsonb;
  v_order public.orders%rowtype;
  v_discount jsonb;
  v_discount_minor bigint := 0;
  v_design_subtotal_minor bigint := 0;
  v_amount_usd_minor bigint;
begin
  if p_usd_rate is null or p_usd_rate <= 0 then raise exception 'Cotización USD inválida'; end if;

  v_base := public.create_paypal_international_order(
    p_user_id, p_cart_id, p_design_prices, p_customer_snapshot,
    p_destination_snapshot, p_idempotency_key, 0, p_shipping_minor, p_peso
  );

  select * into v_order
  from public.orders
  where user_id = p_user_id and checkout_idempotency_key = p_idempotency_key
  for update;
  if not found then raise exception 'No se pudo crear la orden de PayPal'; end if;

  -- Once sent to PayPal (or closed), retries must preserve the historical quote.
  if v_order.paypal_order_id is not null or v_order.paid_at is not null or v_order.status <> 'pending_payment' then
    return jsonb_build_object(
      'id',v_order.id,'orderNumber',v_order.order_number,'status',v_order.status,
      'itemsSubtotalMinor',v_order.items_subtotal_minor,'shippingMinor',v_order.shipping_minor,
      'discountMinor',v_order.discount_minor,'totalMinor',v_order.total_minor,
      'paypalAmountUsdMinor',v_order.paypal_amount_usd_minor,'existing',true);
  end if;

  select coalesce(sum(item.total_minor), 0)::bigint into v_design_subtotal_minor
  from public.order_items item
  where item.order_id = v_order.id and item.item_type = 'design';

  if nullif(btrim(coalesce(p_discount_code, '')), '') is not null then
    if v_order.discount_minor > 0 then
      if v_order.discount_code <> upper(btrim(p_discount_code)) then
        raise exception 'El reintento debe conservar el código de descuento';
      end if;
      v_discount_minor := v_order.discount_minor;
    else
      if v_order.paypal_order_id is not null then
        raise exception 'La orden de PayPal ya fue creada y no admite otro descuento';
      end if;
      v_discount := public.reserve_commerce_discount_scoped(
        p_user_id,
        p_discount_code,
        v_order.items_subtotal_minor,
        v_design_subtotal_minor,
        p_idempotency_key,
        coalesce(v_order.reservation_expires_at, now() + interval '2 hours'),
        private.order_discount_category_subtotals(v_order.id)
      );
      v_discount_minor := (v_discount ->> 'discountMinor')::bigint;
      update public.orders set
        discount_id = (v_discount ->> 'discountId')::uuid,
        discount_code = v_discount ->> 'code',
        discount_type = v_discount ->> 'discountType',
        discount_value = (v_discount ->> 'discountValue')::numeric,
        discount_minor = v_discount_minor,
        total_minor = items_subtotal_minor + shipping_minor + payment_fee_minor - v_discount_minor
      where id = v_order.id
      returning * into v_order;
      update public.commerce_discount_usages set order_id = v_order.id
      where checkout_key = p_idempotency_key and user_id = p_user_id;
    end if;
  elsif v_order.discount_minor > 0 then
    raise exception 'El reintento debe conservar el código de descuento';
  end if;

  v_amount_usd_minor := round(v_order.total_minor::numeric / p_usd_rate)::bigint;
  update public.orders set paypal_amount_usd_minor = v_amount_usd_minor where id = v_order.id;

  return jsonb_build_object(
    'id', v_order.id,
    'orderNumber', v_order.order_number,
    'status', v_order.status,
    'itemsSubtotalMinor', v_order.items_subtotal_minor,
    'shippingMinor', v_order.shipping_minor,
    'discountMinor', v_order.discount_minor,
    'totalMinor', v_order.total_minor,
    'paypalAmountUsdMinor', v_amount_usd_minor,
    'existing', coalesce((v_base ->> 'existing')::boolean, false)
  );
end;
$function$;
revoke all on function public.create_paypal_international_order(uuid,uuid,jsonb,jsonb,jsonb,uuid,bigint,integer,text,numeric) from public,anon,authenticated;
grant execute on function public.create_paypal_international_order(uuid,uuid,jsonb,jsonb,jsonb,uuid,bigint,integer,text,numeric) to service_role;
