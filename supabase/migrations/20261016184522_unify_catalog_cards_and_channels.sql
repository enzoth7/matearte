-- Keep both historical catalog sources intact; each row gets availability only
-- for the channels it can currently sell through.
alter table public.commerce_variants
  add column if not exists available_local boolean not null default true,
  add column if not exists available_web boolean not null default true,
  add column if not exists rim_type text not null default '',
  add column if not exists leather_type text not null default '';

alter table public.products
  add column if not exists available_wholesale boolean not null default true,
  add column if not exists catalog_attributes jsonb not null default '{}'::jsonb;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'products_catalog_attributes_object' and conrelid = 'public.products'::regclass) then
    alter table public.products add constraint products_catalog_attributes_object check (jsonb_typeof(catalog_attributes) = 'object');
  end if;
end $$;

-- These are categories of unambiguous legacy model names, not a merge with
-- similarly named products in the retail catalog.
update public.products
set category_code = case
  when lower(trim(model)) in ('camionero', 'criollo', 'criollo coquito', 'imperial', 'torpedo') then 'mates'
  when lower(trim(model)) in ('bombilla', 'bombillón') then 'bombillas'
  when lower(trim(model)) = 'matera' then 'materas'
  else category_code
end
where category_code is null;

-- Validate at insertion time too: a stale register or cart must not bypass a
-- channel switch that changed after the product was selected.
create or replace function private.check_local_sale_item_availability()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if exists (select 1 from public.local_sales sale where sale.id = new.sale_id and sale.channel = 'Local')
     and not exists (select 1 from public.commerce_variants variant
                     where variant.id = new.variant_id and variant.active and variant.available_local) then
    raise exception 'La variante ya no está disponible en Local' using errcode = '22023';
  end if;
  return new;
end;
$$;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'local_sale_item_channel_availability' and tgrelid = 'public.local_sale_items'::regclass) then
    create trigger local_sale_item_channel_availability before insert on public.local_sale_items
    for each row execute function private.check_local_sale_item_availability();
  end if;
end $$;

create or replace function private.check_wholesale_line_availability()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if not exists (select 1 from public.products product
                 where lower(trim(product.model)) = lower(trim(new.model))
                   and lower(trim(product.variant)) = lower(trim(new.variant))
                   and product.available_wholesale)
     or exists (select 1 from public.products product
                where lower(trim(product.model)) = lower(trim(new.model))
                  and lower(trim(product.variant)) = lower(trim(new.variant))
                  and not product.available_wholesale) then
    raise exception 'El producto ya no está disponible para Mayorista' using errcode = '22023';
  end if;
  return new;
end;
$$;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'wholesale_line_channel_availability' and tgrelid = 'public.order_lines'::regclass) then
    create trigger wholesale_line_channel_availability before insert on public.order_lines
    for each row execute function private.check_wholesale_line_availability();
  end if;
end $$;
