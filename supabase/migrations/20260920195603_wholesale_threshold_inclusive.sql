-- Make the configured wholesale threshold inclusive: 30 means 30 or more.

comment on column public.commerce_settings.wholesale_mate_quantity_threshold
  is 'Inclusive mate quantity threshold; 30 means the discount starts at 30 units.';

create or replace function private.wholesale_mate_unit_price(
  p_price_minor bigint,
  p_is_mate boolean,
  p_enabled boolean,
  p_mate_quantity integer,
  p_quantity_threshold integer,
  p_discount_percent numeric
) returns bigint
language sql
immutable
set search_path = ''
as $$
  select case
    when p_is_mate
      and p_enabled
      and p_mate_quantity >= p_quantity_threshold
      and p_discount_percent > 0
    then greatest(0, round(p_price_minor::numeric * (1 - p_discount_percent / 100)))::bigint
    else p_price_minor
  end;
$$;

create or replace function private.apply_wholesale_discount_to_paypal_order()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_settings public.commerce_settings%rowtype;
  v_mate_quantity integer := 0;
  v_discount_minor bigint := 0;
  v_usd_rate numeric;
begin
  if new.shipping_method <> 'international_shipping' or new.cart_id is null then
    return new;
  end if;

  select * into v_settings
  from public.commerce_settings
  where singleton = true;

  select coalesce(sum(item.quantity), 0)::integer
  into v_mate_quantity
  from public.cart_items item
  join public.commerce_variants variant on variant.id = item.variant_id
  join public.commerce_products product on product.id = variant.product_id
  where item.cart_id = new.cart_id
    and item.item_type = 'catalog'
    and lower(trim(coalesce(product.category_code, product.category))) = 'mates';

  if coalesce(v_settings.wholesale_mate_discount_enabled, false)
     and v_mate_quantity >= v_settings.wholesale_mate_quantity_threshold
     and v_settings.wholesale_mate_discount_percent > 0 then
    select coalesce(sum(
      (variant.price_minor - private.wholesale_mate_unit_price(
        variant.price_minor,
        true,
        true,
        v_mate_quantity,
        v_settings.wholesale_mate_quantity_threshold,
        v_settings.wholesale_mate_discount_percent
      )) * item.quantity
    ), 0)::bigint
    into v_discount_minor
    from public.cart_items item
    join public.commerce_variants variant on variant.id = item.variant_id
    join public.commerce_products product on product.id = variant.product_id
    where item.cart_id = new.cart_id
      and item.item_type = 'catalog'
      and lower(trim(coalesce(product.category_code, product.category))) = 'mates';

    new.items_subtotal_minor := greatest(0, new.items_subtotal_minor - v_discount_minor);
    new.total_minor := new.items_subtotal_minor + new.shipping_minor + new.payment_fee_minor;
  end if;

  select rate_to_uyu into v_usd_rate
  from public.commerce_exchange_rates
  where currency_code = 'USD';
  if coalesce(v_usd_rate, 0) > 0 then
    new.paypal_amount_usd_minor := round(new.total_minor::numeric / v_usd_rate)::bigint;
  end if;
  return new;
end;
$$;
