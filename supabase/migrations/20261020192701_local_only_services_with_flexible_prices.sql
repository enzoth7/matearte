-- A zero catalog price means the service price is agreed at the local sale.
-- Sale lines continue storing the amount actually charged; no history changes.
create or replace function private.enforce_local_service_product()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if coalesce(new.category_code, new.category) = 'servicios' then
    new.published := false;
    new.apply_catalog_price_adjustment := false;
  end if;
  return new;
end;
$$;

create trigger enforce_local_service_product
before insert or update of category, category_code, published, apply_catalog_price_adjustment
on public.commerce_products for each row
execute function private.enforce_local_service_product();

create or replace function private.enforce_local_service_variant()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if exists (
    select 1 from public.commerce_products product
    where product.id = new.product_id
      and coalesce(product.category_code, product.category) = 'servicios'
  ) then
    new.available_local := true;
    new.available_web := false;
    new.available_wholesale := false;
    new.wholesale_price_arg := null;
  end if;
  return new;
end;
$$;

create trigger enforce_local_service_variant
before insert or update of product_id, available_local, available_web,
  available_wholesale, wholesale_price_arg
on public.commerce_variants for each row
execute function private.enforce_local_service_variant();

create or replace function private.localize_service_variants_on_category_change()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if coalesce(new.category_code, new.category) = 'servicios'
     and coalesce(old.category_code, old.category) is distinct from 'servicios' then
    update public.commerce_variants
    set available_local = true,
        available_web = false,
        available_wholesale = false,
        wholesale_price_arg = null
    where product_id = new.id;
  end if;
  return new;
end;
$$;

create trigger localize_service_variants_on_category_change
after update of category, category_code
on public.commerce_products for each row
execute function private.localize_service_variants_on_category_change();

update public.commerce_products
set published = false, apply_catalog_price_adjustment = false
where coalesce(category_code, category) = 'servicios'
  and (published is distinct from false
    or apply_catalog_price_adjustment is distinct from false);

update public.commerce_variants variant
set available_local = true,
    available_web = false,
    available_wholesale = false,
    wholesale_price_arg = null
from public.commerce_products product
where product.id = variant.product_id
  and coalesce(product.category_code, product.category) = 'servicios'
  and (variant.available_local is distinct from true
    or variant.available_web is distinct from false
    or variant.available_wholesale is distinct from false
    or variant.wholesale_price_arg is not null);

update public.commerce_variants variant
set base_price_minor = base_price_minor
from public.commerce_products product
where product.id = variant.product_id
  and coalesce(product.category_code, product.category) = 'servicios'
  and variant.price_minor is distinct from variant.base_price_minor;

create or replace function private.check_local_sale_item_availability()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if exists (select 1 from public.local_sales sale where sale.id = new.sale_id)
     and not exists (select 1 from public.commerce_variants variant
                     where variant.id = new.variant_id and variant.active and variant.available_local) then
    raise exception 'La variante ya no está disponible en Local' using errcode = '22023';
  end if;
  if exists (
    select 1
    from public.local_sales sale
    join public.commerce_variants variant on variant.id = new.variant_id
    join public.commerce_products product on product.id = variant.product_id
    where sale.id = new.sale_id
      and sale.channel <> 'Local'
      and coalesce(product.category_code, product.category) = 'servicios'
  ) then
    raise exception 'Los servicios solo se registran en Local' using errcode = '22023';
  end if;
  return new;
end;
$$;
