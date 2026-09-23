-- Administrable promotional codes, checkout reservations and immutable order snapshots.

create table public.commerce_discounts (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  discount_type text not null check (discount_type in ('percentage', 'fixed')),
  value numeric(12,2) not null,
  valid_from date not null,
  valid_until date not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (code = upper(btrim(code))),
  check (code ~ '^[A-Z0-9][A-Z0-9_-]{3,31}$'),
  check (valid_until >= valid_from),
  check (
    (discount_type = 'percentage' and value > 0 and value < 100)
    or (discount_type = 'fixed' and value > 0 and value = trunc(value))
  )
);

create table public.commerce_discount_usages (
  id uuid primary key default gen_random_uuid(),
  discount_id uuid not null references public.commerce_discounts(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  checkout_key uuid not null,
  order_id uuid references public.orders(id) on delete set null,
  status text not null default 'reserved' check (status in ('reserved', 'redeemed')),
  code text not null,
  discount_type text not null check (discount_type in ('percentage', 'fixed')),
  discount_value numeric(12,2) not null,
  discount_minor bigint not null check (discount_minor > 0),
  reserved_until timestamptz not null,
  redeemed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (discount_id, user_id),
  unique (checkout_key),
  check (
    (status = 'reserved' and redeemed_at is null)
    or (status = 'redeemed' and redeemed_at is not null and order_id is not null)
  )
);

create index commerce_discounts_status_idx
  on public.commerce_discounts (enabled, valid_from, valid_until);
create index commerce_discount_usages_expiry_idx
  on public.commerce_discount_usages (reserved_until)
  where status = 'reserved';
create index commerce_discount_usages_order_idx
  on public.commerce_discount_usages (order_id)
  where order_id is not null;

create trigger commerce_discounts_updated_at
before update on public.commerce_discounts
for each row execute function private.set_updated_at();

create trigger commerce_discount_usages_updated_at
before update on public.commerce_discount_usages
for each row execute function private.set_updated_at();

revoke all on table public.commerce_discounts, public.commerce_discount_usages
from public, anon, authenticated;
grant select, insert, update on table public.commerce_discounts to authenticated;
grant all on table public.commerce_discounts, public.commerce_discount_usages to service_role;

alter table public.commerce_discounts enable row level security;
alter table public.commerce_discount_usages enable row level security;

create policy commerce_discounts_admin_read
on public.commerce_discounts for select to authenticated
using ((select private.is_commerce_admin()));

create policy commerce_discounts_admin_insert
on public.commerce_discounts for insert to authenticated
with check ((select private.is_commerce_admin()));

create policy commerce_discounts_admin_update
on public.commerce_discounts for update to authenticated
using ((select private.is_commerce_admin()))
with check ((select private.is_commerce_admin()));

alter table public.orders
  add column discount_id uuid references public.commerce_discounts(id) on delete set null,
  add column discount_code text,
  add column discount_type text check (discount_type is null or discount_type in ('percentage', 'fixed')),
  add column discount_value numeric(12,2),
  add column discount_minor bigint not null default 0 check (discount_minor >= 0);

do $drop_old_total_constraint$
declare
  v_constraint_name text;
begin
  for v_constraint_name in
    select conname
    from pg_catalog.pg_constraint
    where conrelid = 'public.orders'::regclass
      and contype = 'c'
      and pg_catalog.pg_get_constraintdef(oid) like '%total_minor%items_subtotal_minor%shipping_minor%payment_fee_minor%'
      and pg_catalog.pg_get_constraintdef(oid) not like '%discount_minor%'
  loop
    execute format('alter table public.orders drop constraint %I', v_constraint_name);
  end loop;
end;
$drop_old_total_constraint$;
alter table public.orders
  add constraint orders_total_matches_components
  check (total_minor = items_subtotal_minor + shipping_minor + payment_fee_minor - discount_minor),
  add constraint orders_discount_snapshot_complete
  check (
    (discount_minor = 0 and discount_id is null and discount_code is null and discount_type is null and discount_value is null)
    or
    (discount_minor > 0 and discount_code is not null and discount_type is not null and discount_value is not null)
  );

create or replace function private.commerce_discount_result(
  p_discount public.commerce_discounts,
  p_subtotal_minor bigint
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_discount_minor bigint;
begin
  if p_subtotal_minor <= 0 then raise exception 'discount:not_applicable'; end if;
  v_discount_minor := case
    when p_discount.discount_type = 'percentage'
      then round(p_subtotal_minor::numeric * p_discount.value / 100)::bigint
    else p_discount.value::bigint
  end;
  if v_discount_minor <= 0 or v_discount_minor >= p_subtotal_minor then
    raise exception 'discount:not_applicable';
  end if;
  return jsonb_build_object(
    'discountId', p_discount.id,
    'code', p_discount.code,
    'discountType', p_discount.discount_type,
    'discountValue', p_discount.value,
    'discountMinor', v_discount_minor,
    'itemsSubtotalMinor', p_subtotal_minor,
    'discountedItemsSubtotalMinor', p_subtotal_minor - v_discount_minor
  );
end;
$$;
revoke all on function private.commerce_discount_result(public.commerce_discounts, bigint)
from public, anon, authenticated;

create or replace function public.validate_commerce_discount(
  p_user_id uuid,
  p_code text,
  p_subtotal_minor bigint
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_discount public.commerce_discounts%rowtype;
  v_usage public.commerce_discount_usages%rowtype;
  v_today date := (now() at time zone 'America/Montevideo')::date;
begin
  if p_user_id is null then raise exception 'discount:unauthorized'; end if;
  select * into v_discount
  from public.commerce_discounts
  where code = upper(btrim(coalesce(p_code, '')));
  if not found then raise exception 'discount:not_found'; end if;

  select * into v_usage
  from public.commerce_discount_usages
  where discount_id = v_discount.id and user_id = p_user_id;
  if found and v_usage.status = 'redeemed' then raise exception 'discount:already_used'; end if;
  if found and v_usage.status = 'reserved' and v_usage.reserved_until > now() then
    raise exception 'discount:in_use';
  end if;
  if not v_discount.enabled then raise exception 'discount:disabled'; end if;
  if v_today < v_discount.valid_from then raise exception 'discount:not_started'; end if;
  if v_today > v_discount.valid_until then raise exception 'discount:expired'; end if;

  return private.commerce_discount_result(v_discount, p_subtotal_minor);
end;
$$;
revoke all on function public.validate_commerce_discount(uuid, text, bigint)
from public, anon, authenticated;
grant execute on function public.validate_commerce_discount(uuid, text, bigint) to service_role;

create or replace function public.reserve_commerce_discount(
  p_user_id uuid,
  p_code text,
  p_subtotal_minor bigint,
  p_checkout_key uuid,
  p_reserved_until timestamptz
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_discount public.commerce_discounts%rowtype;
  v_usage public.commerce_discount_usages%rowtype;
  v_result jsonb;
  v_today date := (now() at time zone 'America/Montevideo')::date;
begin
  if p_user_id is null or p_checkout_key is null or p_reserved_until <= now() then
    raise exception 'discount:invalid_reservation';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_user_id::text || ':' || upper(btrim(coalesce(p_code, ''))), 0)
  );

  select * into v_discount
  from public.commerce_discounts
  where code = upper(btrim(coalesce(p_code, '')))
  for update;
  if not found then raise exception 'discount:not_found'; end if;

  select * into v_usage
  from public.commerce_discount_usages
  where discount_id = v_discount.id and user_id = p_user_id
  for update;

  if found and v_usage.status = 'redeemed' then raise exception 'discount:already_used'; end if;
  if found and v_usage.status = 'reserved' and v_usage.checkout_key = p_checkout_key then
    if v_usage.discount_minor <= 0 or v_usage.discount_minor >= p_subtotal_minor then
      raise exception 'discount:not_applicable';
    end if;
    return jsonb_build_object(
      'discountId', v_discount.id,
      'code', v_usage.code,
      'discountType', v_usage.discount_type,
      'discountValue', v_usage.discount_value,
      'discountMinor', v_usage.discount_minor,
      'itemsSubtotalMinor', p_subtotal_minor,
      'discountedItemsSubtotalMinor', p_subtotal_minor - v_usage.discount_minor
    );
  end if;
  if found and v_usage.status = 'reserved' and v_usage.reserved_until > now() then
    raise exception 'discount:in_use';
  end if;
  if not v_discount.enabled then raise exception 'discount:disabled'; end if;
  if v_today < v_discount.valid_from then raise exception 'discount:not_started'; end if;
  if v_today > v_discount.valid_until then raise exception 'discount:expired'; end if;

  v_result := private.commerce_discount_result(v_discount, p_subtotal_minor);
  insert into public.commerce_discount_usages (
    discount_id, user_id, checkout_key, status, code, discount_type,
    discount_value, discount_minor, reserved_until
  ) values (
    v_discount.id, p_user_id, p_checkout_key, 'reserved', v_discount.code,
    v_discount.discount_type, v_discount.value,
    (v_result ->> 'discountMinor')::bigint, p_reserved_until
  )
  on conflict (discount_id, user_id) do update set
    checkout_key = excluded.checkout_key,
    order_id = null,
    status = 'reserved',
    code = excluded.code,
    discount_type = excluded.discount_type,
    discount_value = excluded.discount_value,
    discount_minor = excluded.discount_minor,
    reserved_until = excluded.reserved_until,
    redeemed_at = null;
  return v_result;
end;
$$;
revoke all on function public.reserve_commerce_discount(uuid, text, bigint, uuid, timestamptz)
from public, anon, authenticated;
grant execute on function public.reserve_commerce_discount(uuid, text, bigint, uuid, timestamptz) to service_role;

create or replace function public.release_commerce_discount(
  p_user_id uuid,
  p_checkout_key uuid
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare v_count integer;
begin
  delete from public.commerce_discount_usages
  where user_id = p_user_id and checkout_key = p_checkout_key and status = 'reserved';
  get diagnostics v_count = row_count;
  return v_count > 0;
end;
$$;
revoke all on function public.release_commerce_discount(uuid, uuid) from public, anon, authenticated;
grant execute on function public.release_commerce_discount(uuid, uuid) to service_role;

create or replace function private.redeem_commerce_discount(
  p_user_id uuid,
  p_checkout_key uuid,
  p_order_id uuid
) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.commerce_discount_usages
  set status = 'redeemed', order_id = p_order_id, redeemed_at = now()
  where user_id = p_user_id
    and checkout_key = p_checkout_key
    and status = 'reserved';
end;
$$;
revoke all on function private.redeem_commerce_discount(uuid, uuid, uuid)
from public, anon, authenticated;

-- The overload keeps the existing authoritative PayPal order creator intact,
-- then applies and reserves the optional discount in the same transaction.
create or replace function public.create_paypal_international_order(
  p_user_id uuid,
  p_cart_id uuid,
  p_design_prices jsonb,
  p_customer_snapshot jsonb,
  p_destination_snapshot jsonb,
  p_idempotency_key uuid,
  p_shipping_minor bigint,
  p_peso integer,
  p_discount_code text,
  p_usd_rate numeric
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_base jsonb;
  v_order public.orders%rowtype;
  v_discount jsonb;
  v_discount_minor bigint := 0;
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
      v_discount := public.reserve_commerce_discount(
        p_user_id, p_discount_code, v_order.items_subtotal_minor,
        p_idempotency_key, coalesce(v_order.reservation_expires_at, now() + interval '2 hours')
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
$$;
revoke all on function public.create_paypal_international_order(
  uuid, uuid, jsonb, jsonb, jsonb, uuid, bigint, integer, text, numeric
) from public, anon, authenticated;
grant execute on function public.create_paypal_international_order(
  uuid, uuid, jsonb, jsonb, jsonb, uuid, bigint, integer, text, numeric
) to service_role;

create or replace function public.process_paypal_payment(
  p_event_id text,
  p_event_type text,
  p_paypal_order_id text,
  p_capture_id text,
  p_amount_usd_minor bigint,
  p_capture_payload jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_id uuid;
  v_order public.orders%rowtype;
  v_has_custom boolean;
  v_target_status text;
begin
  if coalesce(trim(p_event_id), '') = '' or p_paypal_order_id is null then
    raise exception 'Evento o orden de PayPal incompleta';
  end if;
  select * into v_order from public.orders where paypal_order_id = p_paypal_order_id for update;
  if not found then raise exception 'Orden de PayPal no encontrada'; end if;

  begin
    insert into public.payment_webhook_events (provider, provider_event_id, event_type, signature_valid, payload)
    values ('paypal', p_event_id, p_event_type, true, p_capture_payload)
    returning id into v_event_id;
  exception when unique_violation then
    return jsonb_build_object('duplicate', true);
  end;

  select exists (select 1 from public.order_items where order_id = v_order.id and requires_review)
  into v_has_custom;
  if p_amount_usd_minor <> v_order.paypal_amount_usd_minor then
    v_target_status := 'manual_review';
  elsif v_has_custom then
    v_target_status := 'paid_pending_review';
  else
    v_target_status := 'ready_for_fulfillment';
  end if;

  if v_order.status = 'pending_payment' then
    update public.orders set status = v_target_status, paid_at = now() where id = v_order.id;
    update public.carts set status = 'converted' where id = v_order.cart_id;
    if v_order.discount_minor > 0 then
      perform private.redeem_commerce_discount(v_order.user_id, v_order.checkout_idempotency_key, v_order.id);
    end if;
  end if;

  insert into public.commerce_payments (
    order_id, provider, provider_payment_id, status, status_detail,
    amount_minor, currency, raw_payload, approved_at
  ) values (
    v_order.id, 'paypal', p_capture_id, 'approved',
    case when p_amount_usd_minor <> v_order.paypal_amount_usd_minor then 'amount_mismatch' else null end,
    p_amount_usd_minor, 'USD', p_capture_payload, now()
  ) on conflict (provider_payment_id) do update set
    status = excluded.status,
    status_detail = excluded.status_detail,
    amount_minor = excluded.amount_minor,
    currency = excluded.currency,
    raw_payload = excluded.raw_payload,
    approved_at = excluded.approved_at;

  update public.payment_webhook_events set
    processed_at = now(),
    processing_error = case when p_amount_usd_minor <> v_order.paypal_amount_usd_minor then 'monto no coincide' else null end
  where id = v_event_id;

  return jsonb_build_object(
    'processed', true,
    'orderId', v_order.id,
    'paymentStatus', 'approved',
    'manualReview', v_target_status = 'manual_review'
  );
end;
$$;
revoke all on function public.process_paypal_payment(text, text, text, text, bigint, jsonb)
from public, anon, authenticated;
grant execute on function public.process_paypal_payment(text, text, text, text, bigint, jsonb)
to service_role;

create or replace function public.process_mercado_pago_payment(
  p_event_id text,
  p_event_type text,
  p_event_payload jsonb,
  p_payment jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_id uuid;
  v_order public.orders%rowtype;
  v_cart public.carts%rowtype;
  v_shipping public.shipping_rates%rowtype;
  v_usage public.commerce_discount_usages%rowtype;
  v_payment_id text := p_payment ->> 'id';
  v_reference uuid;
  v_status text := coalesce(p_payment ->> 'status', 'unknown');
  v_status_detail text := p_payment ->> 'status_detail';
  v_currency text := coalesce(p_payment ->> 'currency_id', '');
  v_amount_minor bigint := round(coalesce((p_payment ->> 'transaction_amount')::numeric, 0) * 100);
  v_checkout jsonb;
  v_items jsonb;
  v_customer jsonb;
  v_user_id uuid;
  v_cart_id uuid;
  v_shipping_rate_id uuid;
  v_items_subtotal bigint;
  v_fee_minor bigint;
  v_discount_minor bigint := 0;
  v_expected_total bigint;
  v_has_custom boolean;
  v_target_status text;
  v_item_count integer;
  v_catalog_count integer;
  v_design_count integer;
  v_checkout_version integer;
begin
  if v_status not in ('approved', 'refunded', 'charged_back') then
    if v_status in ('rejected', 'cancelled') then
      begin
        v_reference := (p_payment ->> 'external_reference')::uuid;
        delete from public.commerce_discount_usages
        where checkout_key = v_reference and status = 'reserved';
      exception when others then
        null;
      end;
    end if;
    return jsonb_build_object('processed', false, 'ignored', true, 'paymentStatus', v_status);
  end if;
  if p_event_id is null or p_event_id = '' or v_payment_id is null then
    raise exception 'Evento de pago incompleto';
  end if;
  begin
    v_reference := (p_payment ->> 'external_reference')::uuid;
  exception when others then
    return jsonb_build_object('processed', false, 'reason', 'invalid_reference');
  end;

  select * into v_order
  from public.orders
  where id = v_reference or checkout_idempotency_key = v_reference
  order by (id = v_reference) desc
  limit 1
  for update;
  if not found and v_status <> 'approved' then
    return jsonb_build_object('processed', false, 'ignored', true, 'reason', 'order_not_found');
  end if;

  begin
    insert into public.payment_webhook_events (provider_event_id, event_type, signature_valid, payload)
    values (p_event_id, p_event_type, true, p_event_payload)
    returning id into v_event_id;
  exception when unique_violation then
    return jsonb_build_object('duplicate', true);
  end;

  if v_order.id is null then
    begin
      v_checkout := case
        when jsonb_typeof(p_payment -> 'metadata' -> 'checkout_payload') = 'string'
          then (p_payment -> 'metadata' ->> 'checkout_payload')::jsonb
        when jsonb_typeof(p_payment -> 'metadata' -> 'checkout_payload') = 'object'
          then p_payment -> 'metadata' -> 'checkout_payload'
        else null
      end;
      v_checkout_version := coalesce((v_checkout ->> 'version')::integer, 0);
      v_user_id := (v_checkout ->> 'userId')::uuid;
      v_cart_id := (v_checkout ->> 'cartId')::uuid;
      v_shipping_rate_id := (v_checkout ->> 'shippingRateId')::uuid;
      v_items := v_checkout -> 'items';
      v_customer := v_checkout -> 'customer';
      v_fee_minor := coalesce((v_checkout ->> 'paymentFeeMinor')::bigint, 0);
      v_discount_minor := coalesce((v_checkout ->> 'discountMinor')::bigint, 0);
    exception when others then
      raise exception 'Los datos del checkout aprobado no son válidos';
    end;

    if v_checkout_version not in (1, 2)
      or jsonb_typeof(v_items) <> 'array'
      or jsonb_typeof(v_customer) <> 'object'
      or v_fee_minor < 0
      or v_discount_minor < 0
      or (v_checkout_version = 1 and v_discount_minor <> 0)
    then
      raise exception 'Los datos del checkout aprobado están incompletos';
    end if;

    v_item_count := jsonb_array_length(v_items);
    if v_item_count < 1 or v_item_count > 50 then
      raise exception 'La cantidad de artículos del checkout no es válida';
    end if;
    if exists (
      select 1
      from jsonb_array_elements(v_items) item
      where item ->> 'itemType' not in ('catalog', 'design')
        or coalesce((item ->> 'quantity')::integer, 0) not between 1 and 99
        or coalesce((item ->> 'unitPriceMinor')::bigint, -1) < 0
        or (item ->> 'itemType' = 'design' and (item ->> 'quantity')::integer <> 1)
        or (item ->> 'itemType' = 'catalog' and jsonb_typeof(coalesce(item -> 'selectedOptions', '{}'::jsonb)) <> 'object')
        or (item ->> 'itemType' = 'catalog' and exists (
          select 1 from jsonb_each(coalesce(item -> 'selectedOptions', '{}'::jsonb)) option_value
          where jsonb_typeof(option_value.value) not in ('string', 'number', 'boolean')
        ))
    ) then
      raise exception 'Uno de los artículos del checkout no es válido';
    end if;

    select * into v_cart from public.carts
    where id = v_cart_id and user_id = v_user_id for update;
    if not found then raise exception 'El carrito del pago aprobado no existe'; end if;
    select * into v_shipping from public.shipping_rates where id = v_shipping_rate_id;
    if not found then raise exception 'La modalidad de entrega del pago aprobado no existe'; end if;

    select count(*) into v_catalog_count
    from jsonb_array_elements(v_items) item
    join public.commerce_variants variant on variant.id = (item ->> 'sourceId')::uuid
    join public.commerce_products product on product.id = variant.product_id
    where item ->> 'itemType' = 'catalog';
    select count(*) into v_design_count
    from jsonb_array_elements(v_items) item
    join public.designs design
      on design.id = (item ->> 'sourceId')::uuid and design.user_id = v_user_id
    where item ->> 'itemType' = 'design';
    if v_catalog_count + v_design_count <> v_item_count then
      raise exception 'Uno de los artículos del pago aprobado ya no existe';
    end if;

    select coalesce(sum(
      (item ->> 'unitPriceMinor')::bigint * (item ->> 'quantity')::integer
    ), 0)::bigint into v_items_subtotal
    from jsonb_array_elements(v_items) item;

    if v_discount_minor > 0 then
      select * into v_usage
      from public.commerce_discount_usages
      where checkout_key = v_reference and user_id = v_user_id and status = 'reserved'
      for update;
      if not found or v_usage.discount_minor <> v_discount_minor then
        raise exception 'La reserva del descuento no coincide';
      end if;
    end if;

    if v_discount_minor >= v_items_subtotal then
      raise exception 'El descuento del checkout no es válido';
    end if;
    v_expected_total := v_items_subtotal + v_fee_minor - v_discount_minor;
    v_has_custom := v_design_count > 0;
    v_target_status := case
      when v_currency <> 'UYU' or v_amount_minor <> v_expected_total then 'manual_review'
      when v_has_custom then 'paid_pending_review'
      else 'ready_for_fulfillment'
    end;

    insert into public.orders (
      user_id, cart_id, status, items_subtotal_minor, shipping_minor, payment_fee_minor,
      discount_id, discount_code, discount_type, discount_value, discount_minor,
      total_minor, shipping_method, shipping_snapshot, customer_snapshot,
      checkout_idempotency_key, reservation_expires_at, paid_at
    ) values (
      v_user_id, v_cart.id, v_target_status, v_items_subtotal, 0, v_fee_minor,
      v_usage.discount_id, v_usage.code, v_usage.discount_type, v_usage.discount_value, v_discount_minor,
      v_expected_total,
      case when v_shipping.is_pickup then 'pickup' else 'national_shipping' end,
      (to_jsonb(v_shipping) - 'rate_minor') || jsonb_build_object('paymentTiming', 'on_delivery'),
      v_customer, v_reference, null,
      coalesce(nullif(p_payment ->> 'date_approved', '')::timestamptz, now())
    ) returning * into v_order;

    insert into public.order_items (
      order_id, item_type, source_variant_id, sku, title, quantity,
      unit_price_minor, total_minor, immutable_snapshot, requires_review
    )
    select v_order.id, 'catalog', variant.id, variant.sku,
      product.name || ' — ' || variant.name,
      (item ->> 'quantity')::integer,
      (item ->> 'unitPriceMinor')::bigint,
      (item ->> 'unitPriceMinor')::bigint * (item ->> 'quantity')::integer,
      jsonb_build_object(
        'product', to_jsonb(product), 'variant', to_jsonb(variant),
        'selectedOptions', coalesce(item -> 'selectedOptions', variant.option_values, '{}'::jsonb)
      ), false
    from jsonb_array_elements(v_items) item
    join public.commerce_variants variant on variant.id = (item ->> 'sourceId')::uuid
    join public.commerce_products product on product.id = variant.product_id
    where item ->> 'itemType' = 'catalog';

    insert into public.order_items (
      order_id, item_type, source_design_id, title, quantity,
      unit_price_minor, total_minor, immutable_snapshot, requires_review, review_status
    )
    select v_order.id, 'design', design.id, design.title, 1,
      (item ->> 'unitPriceMinor')::bigint,
      (item ->> 'unitPriceMinor')::bigint,
      jsonb_build_object(
        'schemaVersion', design.schema_version,
        'configuration', design.configuration,
        'flejeConfiguration', design.fleje_configuration,
        'previewPath', design.preview_path,
        'assets', coalesce((select jsonb_agg(to_jsonb(asset))
          from public.design_assets asset where asset.design_id = design.id), '[]'::jsonb)
      ), true, 'pending'
    from jsonb_array_elements(v_items) item
    join public.designs design
      on design.id = (item ->> 'sourceId')::uuid and design.user_id = v_user_id
    where item ->> 'itemType' = 'design';

    update public.carts set status = 'converted'
    where id = v_cart.id and status = 'active';
    if v_discount_minor > 0 then
      perform private.redeem_commerce_discount(v_user_id, v_reference, v_order.id);
    end if;
  else
    if v_currency <> 'UYU' or v_amount_minor <> v_order.total_minor then
      update public.orders set status = 'manual_review'
      where id = v_order.id returning * into v_order;
    elsif v_status = 'approved' and v_order.status = 'pending_payment' then
      select exists (select 1 from public.order_items where order_id = v_order.id and requires_review)
      into v_has_custom;
      v_target_status := case when v_has_custom then 'paid_pending_review' else 'ready_for_fulfillment' end;
      update public.orders set
        status = v_target_status,
        paid_at = coalesce(nullif(p_payment ->> 'date_approved', '')::timestamptz, now())
      where id = v_order.id returning * into v_order;
      if v_order.discount_minor > 0 then
        perform private.redeem_commerce_discount(v_order.user_id, v_order.checkout_idempotency_key, v_order.id);
      end if;
    elsif v_status in ('refunded', 'charged_back') then
      update public.orders set status = 'refunded'
      where id = v_order.id returning * into v_order;
    end if;
  end if;

  insert into public.commerce_payments (
    order_id, provider_payment_id, status, status_detail,
    amount_minor, currency, raw_payload, approved_at
  ) values (
    v_order.id, v_payment_id, v_status, v_status_detail,
    v_amount_minor, 'UYU', p_payment,
    case when v_status = 'approved'
      then coalesce(nullif(p_payment ->> 'date_approved', '')::timestamptz, now()) else null end
  ) on conflict (provider_payment_id) do update set
    status = excluded.status,
    status_detail = excluded.status_detail,
    amount_minor = excluded.amount_minor,
    raw_payload = excluded.raw_payload,
    approved_at = coalesce(public.commerce_payments.approved_at, excluded.approved_at),
    updated_at = now();

  update public.payment_webhook_events set
    processed_at = now(),
    processing_error = case
      when v_currency <> 'UYU' or v_amount_minor <> v_order.total_minor then 'monto o moneda no coincide'
      else null end
  where id = v_event_id;

  return jsonb_build_object(
    'processed', true,
    'orderId', v_order.id,
    'paymentStatus', v_status,
    'manualReview', v_order.status = 'manual_review'
  );
end;
$$;
revoke all on function public.process_mercado_pago_payment(text, text, jsonb, jsonb)
from public, anon, authenticated;
grant execute on function public.process_mercado_pago_payment(text, text, jsonb, jsonb)
to service_role;

create or replace function public.discard_unconfirmed_paypal_order(p_paypal_order_id text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
begin
  select * into v_order
  from public.orders order_row
  where order_row.paypal_order_id = p_paypal_order_id
    and order_row.customer_snapshot ->> 'purchaseFlow' = 'international_paypal'
    and order_row.paid_at is null
    and not exists (
      select 1 from public.commerce_payments payment
      where payment.order_id = order_row.id and payment.status = 'approved'
    )
  for update;
  if not found then return false; end if;

  delete from public.commerce_discount_usages
  where checkout_key = v_order.checkout_idempotency_key and status = 'reserved';
  delete from public.commerce_payments where order_id = v_order.id;
  delete from public.order_items where order_id = v_order.id;
  delete from public.orders where id = v_order.id;
  return true;
end;
$$;
revoke all on function public.discard_unconfirmed_paypal_order(text)
from public, anon, authenticated;
grant execute on function public.discard_unconfirmed_paypal_order(text) to service_role;
