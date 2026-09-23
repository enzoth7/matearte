-- A customer may use the same discount code in any number of purchases.
-- Each payment session keeps its own reservation and redemption history.

alter table public.commerce_discount_usages
  drop constraint if exists commerce_discount_usages_discount_id_user_id_key;

create index if not exists commerce_discount_usages_customer_discount_idx
  on public.commerce_discount_usages (discount_id, user_id, created_at desc);

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
  v_today date := (now() at time zone 'America/Montevideo')::date;
begin
  if p_user_id is null then raise exception 'discount:unauthorized'; end if;

  select * into v_discount
  from public.commerce_discounts
  where code = upper(btrim(coalesce(p_code, '')));
  if not found then raise exception 'discount:not_found'; end if;

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
    pg_catalog.hashtextextended(p_checkout_key::text, 0)
  );

  select * into v_discount
  from public.commerce_discounts
  where code = upper(btrim(coalesce(p_code, '')))
  for update;
  if not found then raise exception 'discount:not_found'; end if;

  select * into v_usage
  from public.commerce_discount_usages
  where checkout_key = p_checkout_key
  for update;

  if found then
    if v_usage.user_id <> p_user_id or v_usage.discount_id <> v_discount.id then
      raise exception 'discount:invalid_reservation';
    end if;
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
  );

  return v_result;
end;
$$;
revoke all on function public.reserve_commerce_discount(uuid, text, bigint, uuid, timestamptz)
from public, anon, authenticated;
grant execute on function public.reserve_commerce_discount(uuid, text, bigint, uuid, timestamptz) to service_role;
