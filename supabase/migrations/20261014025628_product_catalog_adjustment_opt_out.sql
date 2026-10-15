-- Keep the existing storefront price adjustment by default, while allowing
-- Richard to exclude individual products without changing past order totals.
alter table public.commerce_products
  add column apply_catalog_price_adjustment boolean not null default true;

comment on column public.commerce_products.apply_catalog_price_adjustment
  is 'When false, variants use their base price even if the catalog-wide adjustment is enabled.';

create or replace function private.set_catalog_variant_final_price()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_enabled boolean;
  v_percent numeric;
  v_product_enabled boolean;
begin
  if tg_op = 'INSERT' then
    new.base_price_minor := coalesce(new.base_price_minor, new.price_minor);
  elsif new.base_price_minor is not distinct from old.base_price_minor
        and new.price_minor is distinct from old.price_minor then
    -- Older admin clients may still write only the final-price field.
    new.base_price_minor := new.price_minor;
  end if;

  select catalog_price_adjustment_enabled, catalog_price_adjustment_percent
  into v_enabled, v_percent
  from public.commerce_settings
  where singleton = true;

  select apply_catalog_price_adjustment
  into v_product_enabled
  from public.commerce_products
  where id = new.product_id;

  new.price_minor := private.catalog_price_with_adjustment(
    new.base_price_minor,
    coalesce(v_enabled, false) and coalesce(v_product_enabled, true),
    coalesce(v_percent, 0)
  );
  return new;
end;
$$;

create or replace function private.reprice_catalog_after_product_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.apply_catalog_price_adjustment is distinct from old.apply_catalog_price_adjustment then
    update public.commerce_variants
    set base_price_minor = base_price_minor
    where product_id = new.id;
  end if;
  return new;
end;
$$;

create trigger commerce_products_reprice_catalog
  after update of apply_catalog_price_adjustment
  on public.commerce_products
  for each row execute function private.reprice_catalog_after_product_change();
