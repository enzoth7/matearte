create table public.inventory_manufactured_products (
  id uuid primary key default gen_random_uuid(),
  source_key text unique,
  name text not null check (length(trim(name)) between 1 and 160),
  category_code text not null references public.commerce_categories(code),
  catalog_product_id uuid references public.commerce_products(id) on delete set null,
  reference_sale_price_minor bigint check (reference_sale_price_minor is null or reference_sale_price_minor >= 0),
  reference_variable_cost_minor bigint check (reference_variable_cost_minor is null or reference_variable_cost_minor >= 0),
  source_row text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index inventory_manufactured_catalog_product_uidx
  on public.inventory_manufactured_products(catalog_product_id)
  where catalog_product_id is not null;

create table public.inventory_manufactured_supplies (
  product_id uuid not null references public.inventory_manufactured_products(id) on delete cascade,
  cost_line_id uuid not null references public.inventory_cost_lines(id) on delete restrict,
  quantity numeric(12,4) not null default 1 check (quantity > 0),
  primary key (product_id, cost_line_id)
);

create or replace function private.validate_manufactured_product_catalog()
returns trigger language plpgsql set search_path = '' as $$
declare catalog_category text;
begin
  if new.catalog_product_id is not null then
    select category_code into catalog_category
    from public.commerce_products where id = new.catalog_product_id;
    if catalog_category is distinct from new.category_code then
      raise exception 'La categoría del producto no coincide con el catálogo';
    end if;
  end if;
  return new;
end;
$$;

create trigger inventory_manufactured_product_catalog_check
before insert or update of catalog_product_id, category_code
on public.inventory_manufactured_products
for each row execute function private.validate_manufactured_product_catalog();

create or replace function private.validate_manufactured_supply()
returns trigger language plpgsql set search_path = '' as $$
declare product_category text;
declare supply_category text;
declare supply_kind text;
begin
  select category_code into product_category
  from public.inventory_manufactured_products where id = new.product_id;
  select profile.category_code, line.kind into supply_category, supply_kind
  from public.inventory_cost_lines line
  join public.inventory_cost_profiles profile on profile.id = line.profile_id
  where line.id = new.cost_line_id;
  if supply_kind not in ('material', 'supply') or supply_category is distinct from product_category then
    raise exception 'El insumo no corresponde a la categoría del producto';
  end if;
  return new;
end;
$$;

create trigger inventory_manufactured_supply_check
before insert or update on public.inventory_manufactured_supplies
for each row execute function private.validate_manufactured_supply();

alter table public.inventory_manufactured_products enable row level security;
alter table public.inventory_manufactured_supplies enable row level security;
grant select, insert, update, delete on public.inventory_manufactured_products to authenticated;
grant select, insert, update, delete on public.inventory_manufactured_supplies to authenticated;

create policy inventory_manufactured_products_richard
on public.inventory_manufactured_products for all to authenticated
using ((select private.can_manage_inventory_costs()))
with check ((select private.can_manage_inventory_costs()));

create policy inventory_manufactured_supplies_richard
on public.inventory_manufactured_supplies for all to authenticated
using ((select private.can_manage_inventory_costs()))
with check ((select private.can_manage_inventory_costs()));

with source(source_key, name, category_code, reference_sale_price_minor,
  reference_variable_cost_minor, source_row, catalog_match) as (values
  ('clase1:margin:B7', 'Mate Imperial Alpaca x unidad', 'mates', 295000::bigint, 60500::bigint, '3 Margen!B7:E7', null::text),
  ('clase1:margin:B8', 'Bombilla Fina x mayor', 'bombillas', 45000::bigint, 31500::bigint, '3 Margen!B8:E8', null::text),
  ('clase1:margin:B9', 'Bombillón', 'bombillas', 55000::bigint, 40500::bigint, '3 Margen!B9:E9', null::text),
  ('clase1:margin:B10', 'Mate Torpedo Alpaca Cincelada', 'mates', 95000::bigint, 48500::bigint, '3 Margen!B10:E10', null::text),
  ('clase1:margin:B11', 'Mate Torpedo Alpaca Cincelada Grande', 'mates', 105000::bigint, 48500::bigint, '3 Margen!B11:E11', 'Mate Torpedo Alpaca Grande Cincelada'),
  ('clase1:margin:B12', 'Matera Cuadrada', 'materas', 290000::bigint, 95000::bigint, '3 Margen!B12:E12', 'Matera Cuadrada'),
  ('clase1:margin:B13', 'Mate Torpedo Cuero Crudo Alpaca y Bronce', 'mates', 120000::bigint, 46000::bigint, '3 Margen!B13:E13', 'Mate Torpedo Cuero Crudo Alpaca y Bronce'),
  ('clase1:margin:B14', 'Mate Torpedo Cuero Crudo Alpaca Grande', 'mates', 120000::bigint, 54500::bigint, '3 Margen!B14:E14', null::text),
  ('clase1:margin:B15', 'Mate Criollo Arley', 'mates', 45000::bigint, 28000::bigint, '3 Margen!B15:E15', null::text),
  ('clase1:margin:B16', 'Mate Criollo con Posa de Cuero Crudo', 'mates', 55000::bigint, 23000::bigint, '3 Margen!B16:E16', null::text)
)
insert into public.inventory_manufactured_products
  (source_key, name, category_code, reference_sale_price_minor,
   reference_variable_cost_minor, source_row, catalog_product_id)
select source.source_key, source.name, source.category_code,
  source.reference_sale_price_minor, source.reference_variable_cost_minor,
  source.source_row, catalog.id
from source
left join public.commerce_products catalog on catalog.name = source.catalog_match
  and catalog.category_code = source.category_code
on conflict (source_key) do nothing;

insert into public.inventory_manufactured_supplies(product_id, cost_line_id, quantity)
select product.id, line.id, 1
from public.inventory_manufactured_products product
join public.inventory_cost_profiles profile on profile.category_code = 'mates'
join public.inventory_cost_lines line on line.profile_id = profile.id
  and line.kind = 'material'
where product.source_key = 'clase1:margin:B7'
  and line.name in ('Mate base', 'Cuero', 'Fleje de alpaca base', 'Virola', 'Adhesivos y consumibles')
on conflict do nothing;
