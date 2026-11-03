-- Los servicios existen solo en Local y siempre están activos: no dependen de la web ni del catálogo publicado.
create or replace function private.enforce_local_service_variant()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if exists (
    select 1 from public.commerce_products product
    where product.id = new.product_id
      and coalesce(product.category_code, product.category) = 'servicios'
  ) then
    new.active := true;
    new.available_local := true;
    new.available_web := false;
    new.available_wholesale := false;
    new.wholesale_price_arg := null;
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_local_service_variant on public.commerce_variants;
create trigger enforce_local_service_variant
before insert or update of product_id, active, available_local, available_web,
  available_wholesale, wholesale_price_arg
on public.commerce_variants for each row
execute function private.enforce_local_service_variant();

create or replace function private.localize_service_variants_on_category_change()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if coalesce(new.category_code, new.category) = 'servicios'
     and coalesce(old.category_code, old.category) is distinct from 'servicios' then
    update public.commerce_variants
    set active = true,
        available_local = true,
        available_web = false,
        available_wholesale = false,
        wholesale_price_arg = null
    where product_id = new.id;
  end if;
  return new;
end;
$$;

update public.commerce_variants variant
set active = true
from public.commerce_products product
where product.id = variant.product_id
  and coalesce(product.category_code, product.category) = 'servicios'
  and variant.active is distinct from true;
