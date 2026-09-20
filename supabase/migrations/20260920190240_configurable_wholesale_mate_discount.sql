-- Configurable, silent wholesale discount for catalog mates.
-- The threshold is exclusive: a value of 30 applies from 31 units onward.

alter table public.commerce_settings
  add column if not exists wholesale_mate_discount_enabled boolean not null default true,
  add column if not exists wholesale_mate_quantity_threshold integer not null default 30,
  add column if not exists wholesale_mate_discount_percent numeric(7, 2) not null default 30;

alter table public.commerce_settings
  drop constraint if exists commerce_settings_wholesale_mate_quantity_threshold_check,
  drop constraint if exists commerce_settings_wholesale_mate_discount_percent_check;

alter table public.commerce_settings
  add constraint commerce_settings_wholesale_mate_quantity_threshold_check
    check (wholesale_mate_quantity_threshold between 1 and 999),
  add constraint commerce_settings_wholesale_mate_discount_percent_check
    check (wholesale_mate_discount_percent between 0 and 100);

comment on column public.commerce_settings.wholesale_mate_discount_enabled
  is 'Enables the internal quantity discount for catalog products in the mates category.';
comment on column public.commerce_settings.wholesale_mate_quantity_threshold
  is 'Exclusive mate quantity threshold; 30 means the discount starts at 31 units.';
comment on column public.commerce_settings.wholesale_mate_discount_percent
  is 'Percentage deducted from qualifying mate unit prices.';

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
      and p_mate_quantity > p_quantity_threshold
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
    and coalesce(product.category_code, product.category) = 'mates';

  if coalesce(v_settings.wholesale_mate_discount_enabled, false)
     and v_mate_quantity > v_settings.wholesale_mate_quantity_threshold
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
      and coalesce(product.category_code, product.category) = 'mates';

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

drop trigger if exists orders_paypal_wholesale_discount on public.orders;
create trigger orders_paypal_wholesale_discount
  before insert on public.orders
  for each row execute function private.apply_wholesale_discount_to_paypal_order();

create or replace function private.apply_wholesale_discount_to_paypal_order_item()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_cart_id uuid;
  v_shipping_method text;
  v_category text;
  v_settings public.commerce_settings%rowtype;
  v_mate_quantity integer := 0;
begin
  if new.item_type <> 'catalog' or new.source_variant_id is null then
    return new;
  end if;

  select cart_id, shipping_method
  into v_cart_id, v_shipping_method
  from public.orders
  where id = new.order_id;
  if v_shipping_method <> 'international_shipping' or v_cart_id is null then
    return new;
  end if;

  select coalesce(product.category_code, product.category)
  into v_category
  from public.commerce_variants variant
  join public.commerce_products product on product.id = variant.product_id
  where variant.id = new.source_variant_id;
  if v_category <> 'mates' then
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
  where item.cart_id = v_cart_id
    and item.item_type = 'catalog'
    and coalesce(product.category_code, product.category) = 'mates';

  new.unit_price_minor := private.wholesale_mate_unit_price(
    new.unit_price_minor,
    true,
    coalesce(v_settings.wholesale_mate_discount_enabled, false),
    v_mate_quantity,
    v_settings.wholesale_mate_quantity_threshold,
    v_settings.wholesale_mate_discount_percent
  );
  new.total_minor := new.unit_price_minor * new.quantity;
  return new;
end;
$$;

drop trigger if exists order_items_paypal_wholesale_discount on public.order_items;
create trigger order_items_paypal_wholesale_discount
  before insert on public.order_items
  for each row execute function private.apply_wholesale_discount_to_paypal_order_item();
