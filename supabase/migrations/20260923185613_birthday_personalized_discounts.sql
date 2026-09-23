-- Personal birthday benefits, scoped discount calculation and idempotent
-- lifecycle delivery. Existing promotion codes remain global, all-items and
-- unlimited unless an administrator explicitly changes the new fields.

alter table public.commerce_discounts
  add column owner_user_id uuid references auth.users(id) on delete cascade,
  add column applicability text not null default 'all_items',
  add column redemption_limit integer,
  add column source_key text;

alter table public.commerce_discounts
  add constraint commerce_discounts_applicability_check
    check (applicability in ('all_items', 'design_items')),
  add constraint commerce_discounts_redemption_limit_check
    check (redemption_limit is null or redemption_limit > 0),
  add constraint commerce_discounts_source_key_check
    check (source_key is null or char_length(source_key) between 1 and 180),
  add constraint commerce_discounts_personal_scope_check
    check (owner_user_id is null or redemption_limit is not null);

create unique index commerce_discounts_source_key_key
  on public.commerce_discounts (source_key)
  where source_key is not null;

create index commerce_discounts_owner_idx
  on public.commerce_discounts (owner_user_id, valid_until desc)
  where owner_user_id is not null;

create or replace function private.commerce_discount_result(
  p_discount public.commerce_discounts,
  p_items_subtotal_minor bigint,
  p_design_subtotal_minor bigint
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_eligible_subtotal_minor bigint;
  v_discount_minor bigint;
begin
  if p_items_subtotal_minor <= 0
    or p_design_subtotal_minor < 0
    or p_design_subtotal_minor > p_items_subtotal_minor
  then
    raise exception 'discount:not_applicable';
  end if;

  v_eligible_subtotal_minor := case p_discount.applicability
    when 'design_items' then p_design_subtotal_minor
    else p_items_subtotal_minor
  end;
  if v_eligible_subtotal_minor <= 0 then
    raise exception 'discount:not_applicable';
  end if;

  v_discount_minor := case
    when p_discount.discount_type = 'percentage'
      then round(v_eligible_subtotal_minor::numeric * p_discount.value / 100)::bigint
    else p_discount.value::bigint
  end;
  if v_discount_minor <= 0
    or v_discount_minor >= p_items_subtotal_minor
    or v_discount_minor > v_eligible_subtotal_minor
  then
    raise exception 'discount:not_applicable';
  end if;

  return jsonb_build_object(
    'discountId', p_discount.id,
    'code', p_discount.code,
    'discountType', p_discount.discount_type,
    'discountValue', p_discount.value,
    'applicability', p_discount.applicability,
    'eligibleSubtotalMinor', v_eligible_subtotal_minor,
    'discountMinor', v_discount_minor,
    'itemsSubtotalMinor', p_items_subtotal_minor,
    'discountedItemsSubtotalMinor', p_items_subtotal_minor - v_discount_minor
  );
end;
$$;
revoke all on function private.commerce_discount_result(public.commerce_discounts, bigint, bigint)
from public, anon, authenticated;

-- Compatibility overload for existing backend callers. Design-only codes are
-- deliberately not applicable until the caller supplies a design subtotal.
create or replace function private.commerce_discount_result(
  p_discount public.commerce_discounts,
  p_subtotal_minor bigint
) returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.commerce_discount_result(p_discount, p_subtotal_minor, 0);
$$;
revoke all on function private.commerce_discount_result(public.commerce_discounts, bigint)
from public, anon, authenticated;

create or replace function public.validate_commerce_discount(
  p_user_id uuid,
  p_code text,
  p_items_subtotal_minor bigint,
  p_design_subtotal_minor bigint
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
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

  return private.commerce_discount_result(
    v_discount,
    p_items_subtotal_minor,
    p_design_subtotal_minor
  );
end;
$$;
revoke all on function public.validate_commerce_discount(uuid, text, bigint, bigint)
from public, anon, authenticated;
grant execute on function public.validate_commerce_discount(uuid, text, bigint, bigint)
to service_role;

create or replace function public.validate_commerce_discount(
  p_user_id uuid,
  p_code text,
  p_subtotal_minor bigint
) returns jsonb
language sql
security definer
set search_path = ''
as $$
  select public.validate_commerce_discount(p_user_id, p_code, p_subtotal_minor, 0);
$$;
revoke all on function public.validate_commerce_discount(uuid, text, bigint)
from public, anon, authenticated;
grant execute on function public.validate_commerce_discount(uuid, text, bigint)
to service_role;

create or replace function public.reserve_commerce_discount(
  p_user_id uuid,
  p_code text,
  p_items_subtotal_minor bigint,
  p_design_subtotal_minor bigint,
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
    v_result := private.commerce_discount_result(
      v_discount,
      p_items_subtotal_minor,
      p_design_subtotal_minor
    );
    if v_usage.discount_minor <> (v_result ->> 'discountMinor')::bigint then
      raise exception 'discount:invalid_reservation';
    end if;
    return v_result;
  end if;

  if not v_discount.enabled then raise exception 'discount:disabled'; end if;
  if v_today < v_discount.valid_from then raise exception 'discount:not_started'; end if;
  if v_today > v_discount.valid_until then raise exception 'discount:expired'; end if;

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

  v_result := private.commerce_discount_result(
    v_discount,
    p_items_subtotal_minor,
    p_design_subtotal_minor
  );
  insert into public.commerce_discount_usages (
    discount_id, user_id, checkout_key, status, code, discount_type,
    discount_value, discount_minor, reserved_until
  ) values (
    v_discount.id, p_user_id, p_checkout_key, 'reserved', v_discount.code,
    v_discount.discount_type, v_discount.value,
    (v_result ->> 'discountMinor')::bigint, p_reserved_until
  );

  return v_result;
end;
$$;
revoke all on function public.reserve_commerce_discount(uuid, text, bigint, bigint, uuid, timestamptz)
from public, anon, authenticated;
grant execute on function public.reserve_commerce_discount(uuid, text, bigint, bigint, uuid, timestamptz)
to service_role;

create or replace function public.reserve_commerce_discount(
  p_user_id uuid,
  p_code text,
  p_subtotal_minor bigint,
  p_checkout_key uuid,
  p_reserved_until timestamptz
) returns jsonb
language sql
security definer
set search_path = ''
as $$
  select public.reserve_commerce_discount(
    p_user_id,
    p_code,
    p_subtotal_minor,
    0,
    p_checkout_key,
    p_reserved_until
  );
$$;
revoke all on function public.reserve_commerce_discount(uuid, text, bigint, uuid, timestamptz)
from public, anon, authenticated;
grant execute on function public.reserve_commerce_discount(uuid, text, bigint, uuid, timestamptz)
to service_role;

create or replace function private.redeem_commerce_discount(
  p_user_id uuid,
  p_checkout_key uuid,
  p_order_id uuid
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usage public.commerce_discount_usages%rowtype;
  v_discount public.commerce_discounts%rowtype;
begin
  select * into v_usage
  from public.commerce_discount_usages
  where user_id = p_user_id
    and checkout_key = p_checkout_key
    and status = 'reserved'
  for update;
  if not found then raise exception 'discount:invalid_reservation'; end if;

  select * into v_discount
  from public.commerce_discounts
  where id = v_usage.discount_id
  for update;

  if v_discount.redemption_limit is not null and (
    select count(*)
    from public.commerce_discount_usages usage_row
    where usage_row.discount_id = v_discount.id
      and usage_row.status = 'redeemed'
      and usage_row.id <> v_usage.id
  ) >= v_discount.redemption_limit then
    raise exception 'discount:already_used';
  end if;

  update public.commerce_discount_usages
  set status = 'redeemed', order_id = p_order_id, redeemed_at = now()
  where id = v_usage.id;
end;
$$;
revoke all on function private.redeem_commerce_discount(uuid, uuid, uuid)
from public, anon, authenticated;

-- PayPal creates the order before reserving a discount, so calculate the
-- authoritative personalized subtotal from the persisted order items.
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
      v_discount := public.reserve_commerce_discount(
        p_user_id,
        p_discount_code,
        v_order.items_subtotal_minor,
        v_design_subtotal_minor,
        p_idempotency_key,
        coalesce(v_order.reservation_expires_at, now() + interval '2 hours')
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

create or replace function private.generate_birthday_discount_code()
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_code text;
begin
  loop
    v_code := 'CUMPLE-' || upper(encode(extensions.gen_random_bytes(12), 'hex'));
    exit when not exists (
      select 1 from public.commerce_discounts discount_row where discount_row.code = v_code
    );
  end loop;
  return v_code;
end;
$$;
revoke all on function private.generate_birthday_discount_code()
from public, anon, authenticated;

create or replace function public.queue_upcoming_birthday_emails(
  p_today date default ((now() at time zone 'America/Montevideo')::date)
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target date := p_today + 10;
  v_valid_until date := p_today + 30;
  v_profile record;
  v_event_key text;
  v_source_key text;
  v_existing_status text;
  v_code text;
  v_affected integer;
  v_queued integer := 0;
begin
  for v_profile in
    select
      profile.user_id,
      profile.full_name,
      profile.birth_date,
      lower(btrim(auth_user.email)) as email
    from public.customer_profiles profile
    join auth.users auth_user on auth_user.id = profile.user_id
    where profile.birth_date is not null
      and auth_user.deleted_at is null
      and nullif(lower(btrim(auth_user.email)), '') is not null
      and (
        (
          extract(month from profile.birth_date) = extract(month from v_target)
          and extract(day from profile.birth_date) = extract(day from v_target)
        )
        or (
          extract(month from profile.birth_date) = 2
          and extract(day from profile.birth_date) = 29
          and extract(month from v_target) = 2
          and extract(day from v_target) = 28
          and v_target = (date_trunc('month', v_target)::date + interval '1 month - 1 day')::date
        )
      )
  loop
    v_event_key := 'birthday:' || v_profile.user_id::text || ':' || extract(year from v_target)::integer::text;
    v_source_key := v_event_key;
    v_existing_status := null;
    select email_row.status into v_existing_status
    from public.lifecycle_email_outbox email_row
    where email_row.event_key = v_event_key;
    if found and v_existing_status in ('sending', 'sent') then
      continue;
    end if;

    select discount_row.code into v_code
    from public.commerce_discounts discount_row
    where discount_row.source_key = v_source_key;
    if not found then
      loop
        v_code := private.generate_birthday_discount_code();
        begin
          insert into public.commerce_discounts (
            code, discount_type, value, valid_from, valid_until, enabled,
            owner_user_id, applicability, redemption_limit, source_key
          ) values (
            v_code, 'percentage', 20, p_today, v_valid_until, true,
            v_profile.user_id, 'design_items', 1, v_source_key
          );
          exit;
        exception when unique_violation then
          select discount_row.code into v_code
          from public.commerce_discounts discount_row
          where discount_row.source_key = v_source_key;
          if found then exit; end if;
        end;
      end loop;
    end if;

    insert into public.lifecycle_email_outbox (
      user_id, event_type, event_key, recipient_email, payload
    ) values (
      v_profile.user_id,
      'birthday',
      v_event_key,
      v_profile.email,
      jsonb_build_object(
        'name', nullif(btrim(v_profile.full_name), ''),
        'birthdayDate', v_profile.birth_date,
        'birthdayYear', extract(year from v_target)::integer,
        'discountCode', v_code,
        'discountPercent', '20%',
        'discountValidity', '30 días desde ahora',
        'discountValidUntil', v_valid_until
      )
    )
    on conflict (event_key) do update set
      recipient_email = excluded.recipient_email,
      payload = excluded.payload,
      status = case
        when public.lifecycle_email_outbox.status = 'skipped' then 'pending'
        else public.lifecycle_email_outbox.status
      end,
      attempt_count = case
        when public.lifecycle_email_outbox.status = 'skipped' then 0
        else public.lifecycle_email_outbox.attempt_count
      end,
      available_at = case
        when public.lifecycle_email_outbox.status = 'skipped' then now()
        else public.lifecycle_email_outbox.available_at
      end,
      last_error = case
        when public.lifecycle_email_outbox.status = 'skipped' then null
        else public.lifecycle_email_outbox.last_error
      end,
      updated_at = now()
    where public.lifecycle_email_outbox.status in ('pending', 'failed', 'skipped');

    get diagnostics v_affected = row_count;
    v_queued := v_queued + v_affected;
  end loop;

  return v_queued;
end;
$$;
revoke all on function public.queue_upcoming_birthday_emails(date)
from public, anon, authenticated;
grant execute on function public.queue_upcoming_birthday_emails(date)
to service_role;

comment on column public.commerce_discounts.owner_user_id is
  'Optional account owner. Personal codes return not_found for every other account.';
comment on column public.commerce_discounts.applicability is
  'Eligible order-item scope: all_items or design_items from the customizer.';
comment on column public.commerce_discounts.redemption_limit is
  'Maximum successful redemptions across the code; null keeps legacy unlimited behavior.';
comment on column public.commerce_discounts.source_key is
  'Backend idempotency key for generated campaigns such as birthday:user:year.';
comment on table public.lifecycle_email_outbox is
  'Backend-only, idempotent queue for welcome and account birthday emails; birthday delivery is independent of newsletter consent.';
