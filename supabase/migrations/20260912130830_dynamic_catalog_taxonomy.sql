-- Dynamic, Spanish-first catalog taxonomy. Legacy columns remain available while
-- products are reviewed and migrated by the commerce team.

create table public.commerce_categories (
  code text primary key check (code ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  label_es text not null check (char_length(trim(label_es)) between 1 and 80),
  parent_code text references public.commerce_categories(code) on delete restrict,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (parent_code is null or parent_code <> code)
);

create table public.commerce_attribute_definitions (
  code text primary key check (code ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  label_es text not null check (char_length(trim(label_es)) between 1 and 80),
  data_type text not null check (data_type in ('enum', 'number', 'boolean', 'text')),
  unit text,
  input_style text not null default 'select' check (input_style in ('select', 'swatch', 'buttons', 'number', 'checkbox', 'text')),
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.commerce_attribute_options (
  attribute_code text not null references public.commerce_attribute_definitions(code) on delete cascade,
  code text not null check (code ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  label_es text not null check (char_length(trim(label_es)) between 1 and 80),
  swatch_hex text check (swatch_hex is null or swatch_hex ~ '^#[0-9A-Fa-f]{6}$'),
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (attribute_code, code)
);

create table public.commerce_category_attributes (
  category_code text not null references public.commerce_categories(code) on delete cascade,
  attribute_code text not null references public.commerce_attribute_definitions(code) on delete cascade,
  scope text not null check (scope in ('product', 'variant')),
  required boolean not null default false,
  filterable boolean not null default false,
  sort_order integer not null default 0,
  primary key (category_code, attribute_code, scope)
);

alter table public.commerce_products
  add column if not exists category_code text references public.commerce_categories(code) on delete restrict,
  add column if not exists attributes jsonb not null default '{}'::jsonb;
alter table public.commerce_products drop constraint if exists commerce_products_attributes_object;
alter table public.commerce_products add constraint commerce_products_attributes_object check (jsonb_typeof(attributes) = 'object');

alter table public.commerce_variants add column if not exists option_values jsonb not null default '{}'::jsonb;
alter table public.commerce_variants drop constraint if exists commerce_variants_option_values_object;
alter table public.commerce_variants add constraint commerce_variants_option_values_object check (jsonb_typeof(option_values) = 'object');

alter table public.commerce_product_images add column if not exists option_values jsonb not null default '{}'::jsonb;
alter table public.commerce_product_images drop constraint if exists commerce_product_images_option_values_object;
alter table public.commerce_product_images add constraint commerce_product_images_option_values_object check (jsonb_typeof(option_values) = 'object');

create index if not exists commerce_products_category_code_idx on public.commerce_products (category_code, published);
create index if not exists commerce_variants_option_values_idx on public.commerce_variants using gin (option_values);
create index if not exists commerce_product_images_option_values_idx on public.commerce_product_images using gin (option_values);
create unique index if not exists commerce_variants_structured_options_unique
  on public.commerce_variants (product_id, option_values) where option_values <> '{}'::jsonb;

drop trigger if exists commerce_categories_updated_at on public.commerce_categories;
create trigger commerce_categories_updated_at before update on public.commerce_categories
for each row execute function private.set_updated_at();
drop trigger if exists commerce_attribute_definitions_updated_at on public.commerce_attribute_definitions;
create trigger commerce_attribute_definitions_updated_at before update on public.commerce_attribute_definitions
for each row execute function private.set_updated_at();
drop trigger if exists commerce_attribute_options_updated_at on public.commerce_attribute_options;
create trigger commerce_attribute_options_updated_at before update on public.commerce_attribute_options
for each row execute function private.set_updated_at();

alter table public.commerce_categories enable row level security;
alter table public.commerce_attribute_definitions enable row level security;
alter table public.commerce_attribute_options enable row level security;
alter table public.commerce_category_attributes enable row level security;

revoke all on public.commerce_categories, public.commerce_attribute_definitions,
  public.commerce_attribute_options, public.commerce_category_attributes from anon, authenticated;
grant select on public.commerce_categories, public.commerce_attribute_definitions,
  public.commerce_attribute_options, public.commerce_category_attributes to anon;
grant select, insert, update, delete on public.commerce_categories, public.commerce_attribute_definitions,
  public.commerce_attribute_options, public.commerce_category_attributes to authenticated;

drop policy if exists taxonomy_categories_public_read on public.commerce_categories;
create policy taxonomy_categories_public_read on public.commerce_categories for select to anon, authenticated
using (active or (select private.is_commerce_admin()));
drop policy if exists taxonomy_categories_admin_write on public.commerce_categories;
create policy taxonomy_categories_admin_write on public.commerce_categories for all to authenticated
using ((select private.is_commerce_admin())) with check ((select private.is_commerce_admin()));

drop policy if exists taxonomy_attributes_public_read on public.commerce_attribute_definitions;
create policy taxonomy_attributes_public_read on public.commerce_attribute_definitions for select to anon, authenticated
using (active or (select private.is_commerce_admin()));
drop policy if exists taxonomy_attributes_admin_write on public.commerce_attribute_definitions;
create policy taxonomy_attributes_admin_write on public.commerce_attribute_definitions for all to authenticated
using ((select private.is_commerce_admin())) with check ((select private.is_commerce_admin()));

drop policy if exists taxonomy_options_public_read on public.commerce_attribute_options;
create policy taxonomy_options_public_read on public.commerce_attribute_options for select to anon, authenticated
using (active or (select private.is_commerce_admin()));
drop policy if exists taxonomy_options_admin_write on public.commerce_attribute_options;
create policy taxonomy_options_admin_write on public.commerce_attribute_options for all to authenticated
using ((select private.is_commerce_admin())) with check ((select private.is_commerce_admin()));

drop policy if exists taxonomy_rules_public_read on public.commerce_category_attributes;
create policy taxonomy_rules_public_read on public.commerce_category_attributes for select to anon, authenticated
using (((exists (select 1 from public.commerce_categories c where c.code = category_code and c.active)
  and exists (select 1 from public.commerce_attribute_definitions a where a.code = attribute_code and a.active))
  or (select private.is_commerce_admin())));
drop policy if exists taxonomy_rules_admin_write on public.commerce_category_attributes;
create policy taxonomy_rules_admin_write on public.commerce_category_attributes for all to authenticated
using ((select private.is_commerce_admin())) with check ((select private.is_commerce_admin()));

insert into public.commerce_categories (code, label_es, parent_code, sort_order) values
  ('mates', 'Mates', null, 10), ('bombillas', 'Bombillas', null, 20),
  ('termos', 'Termos', null, 30), ('materas', 'Materas', null, 40),
  ('kits-materos', 'Kits materos', null, 50), ('cuchillos', 'Cuchillos', null, 60),
  ('calzado', 'Calzado', null, 70), ('botas', 'Botas', 'calzado', 71),
  ('marroquineria', 'Marroquinería', null, 80), ('cintos', 'Cintos', 'marroquineria', 81),
  ('billeteras', 'Billeteras', 'marroquineria', 82), ('carteras', 'Carteras', 'marroquineria', 83)
on conflict (code) do update set label_es = excluded.label_es, parent_code = excluded.parent_code, sort_order = excluded.sort_order;

insert into public.commerce_attribute_definitions (code, label_es, data_type, unit, input_style) values
  ('tipo-mate', 'Modelo de mate', 'enum', null, 'select'), ('material', 'Material', 'enum', null, 'select'),
  ('forma', 'Forma', 'enum', null, 'select'), ('tamano', 'Tamaño', 'enum', null, 'select'),
  ('acabado', 'Acabado', 'text', null, 'text'), ('color', 'Color', 'enum', null, 'swatch'),
  ('talle', 'Talle', 'enum', null, 'buttons'), ('capacidad-ml', 'Capacidad', 'number', 'ml', 'number'),
  ('tipo-bombilla', 'Tipo de bombilla', 'enum', null, 'select'),
  ('diametro-cano-mm', 'Diámetro del caño', 'number', 'mm', 'number'), ('largo-mm', 'Largo', 'number', 'mm', 'number'),
  ('material-cuerpo', 'Material del cuerpo', 'enum', null, 'select'), ('forma-pico', 'Forma del pico', 'enum', null, 'select'),
  ('material-pico', 'Material del pico', 'enum', null, 'select'), ('decoracion', 'Decoración', 'enum', null, 'select'),
  ('tipo-cuchillo', 'Tipo de cuchillo', 'enum', null, 'select'),
  ('largo-hoja-mm', 'Largo de hoja', 'number', 'mm', 'number'), ('ancho-hoja-mm', 'Ancho de hoja', 'number', 'mm', 'number'),
  ('configuracion-filo', 'Configuración del filo', 'enum', null, 'select'),
  ('tiene-gavilan', 'Tiene gavilán', 'boolean', null, 'checkbox'), ('forma-gavilan', 'Forma del gavilán', 'enum', null, 'select'),
  ('material-hoja', 'Material de hoja', 'enum', null, 'select'), ('material-cabo', 'Material del cabo', 'enum', null, 'select'),
  ('material-vaina', 'Material de la vaina', 'enum', null, 'select')
on conflict (code) do update set label_es = excluded.label_es, data_type = excluded.data_type, unit = excluded.unit, input_style = excluded.input_style;

insert into public.commerce_attribute_options (attribute_code, code, label_es, swatch_hex, sort_order) values
  ('tipo-mate','imperial','Imperial',null,10), ('tipo-mate','camionero','Camionero',null,20),
  ('tipo-mate','criollo','Criollo',null,30), ('tipo-mate','torpedo','Torpedo',null,40),
  ('material','cuero','Cuero',null,10), ('material','plata','Plata',null,20), ('material','alpaca','Alpaca',null,30),
  ('material','acero-inoxidable','Acero inoxidable',null,40), ('material','otros-metales','Otros metales',null,50),
  ('material','madera','Madera',null,60), ('material','estampado','Estampado',null,70), ('forma','ovalada','Ovalada',null,10),
  ('tamano','pequeno','Pequeño',null,10), ('tamano','mediano','Mediano',null,20), ('tamano','grande','Grande',null,30),
  ('color','marron','Marrón','#6C4530',10), ('color','negro','Negro','#241D1A',20),
  ('color','natural','Natural','#CFAF79',30), ('color','cuero-crudo','Cuero crudo','#E8D9BB',40),
  ('color','rojo','Rojo','#A83232',50), ('color','blanco','Blanco','#F5F5F5',60),
  ('color','rosado','Rosado','#E8A4A4',70), ('color','gris','Gris','#8C8C8C',80),
  ('color','dorado','Dorado','#C9A859',90), ('color','celeste','Celeste','#74ACDF',100),
  ('color','azul','Azul','#1E3A8A',110), ('color','beige','Beige','#DFD1B8',120), ('color','metalico','Metálico','#9B9B95',130),
  ('talle','34','34',null,10), ('talle','35','35',null,20), ('talle','36','36',null,30), ('talle','37','37',null,40),
  ('talle','38','38',null,50), ('talle','39','39',null,60), ('talle','40','40',null,70), ('talle','41','41',null,80),
  ('talle','42','42',null,90), ('talle','43','43',null,100), ('talle','44','44',null,110), ('talle','45','45',null,120), ('talle','46','46',null,130),
  ('tipo-bombilla','clasica','Clásica',null,10), ('tipo-bombilla','bombillon','Bombillón',null,20), ('tipo-bombilla','apaga','Apaga',null,30),
  ('forma-pico','pico-loro','Pico loro',null,10),
  ('material-cuerpo','alpaca','Alpaca',null,10), ('material-cuerpo','bronce','Bronce',null,20),
  ('material-cuerpo','acero-inoxidable','Acero inoxidable',null,30),
  ('material-pico','alpaca','Alpaca',null,10), ('material-pico','bronce','Bronce',null,20),
  ('decoracion','con-aros','Con aros',null,10), ('decoracion','cincelada','Cincelada',null,20), ('decoracion','con-aplique','Con aplique',null,30),
  ('tipo-cuchillo','cuchillo-criollo','Cuchillo criollo o de cintura',null,10), ('tipo-cuchillo','facon','Facón',null,20),
  ('tipo-cuchillo','daga','Daga',null,30), ('tipo-cuchillo','verijero','Verijero o fillingo',null,40), ('tipo-cuchillo','caronero','Caronero',null,50),
  ('configuracion-filo','un-filo','Un filo',null,10), ('configuracion-filo','doble-filo','Doble filo',null,20),
  ('configuracion-filo','filo-con-contrafilo','Filo con contrafilo',null,30),
  ('forma-gavilan','recto','Recto',null,10), ('forma-gavilan','s','En S',null,20), ('forma-gavilan','u','En U',null,30),
  ('material-hoja','acero','Acero',null,10), ('material-hoja','acero-inoxidable','Acero inoxidable',null,20),
  ('material-cabo','madera','Madera',null,10), ('material-cabo','asta-guampa','Asta o guampa',null,20),
  ('material-cabo','bronce','Bronce',null,30), ('material-cabo','plata','Plata',null,40),
  ('material-cabo','alpaca','Alpaca',null,50), ('material-cabo','combinado','Combinado',null,60),
  ('material-vaina','cuero-crudo','Cuero crudo',null,10), ('material-vaina','suela','Suela',null,20),
  ('material-vaina','metal','Metal',null,30), ('material-vaina','combinada','Combinada',null,40)
on conflict (attribute_code, code) do update set label_es = excluded.label_es, swatch_hex = excluded.swatch_hex, sort_order = excluded.sort_order;

insert into public.commerce_category_attributes (category_code, attribute_code, scope, required, filterable, sort_order) values
  ('mates','tipo-mate','product',false,true,10), ('mates','material','product',false,true,20), ('mates','acabado','product',false,true,30), ('mates','color','variant',false,true,100),
  ('bombillas','tipo-bombilla','product',true,true,10), ('bombillas','diametro-cano-mm','product',false,true,20),
  ('bombillas','largo-mm','product',false,false,30), ('bombillas','material-cuerpo','product',false,true,40),
  ('bombillas','forma-pico','product',false,true,50), ('bombillas','material-pico','product',false,true,60),
  ('bombillas','decoracion','product',false,true,70), ('bombillas','color','variant',false,true,100),
  ('termos','material','product',false,true,10), ('termos','acabado','product',false,true,20),
  ('termos','color','variant',true,true,100), ('termos','capacidad-ml','variant',false,true,110),
  ('materas','forma','product',true,true,10), ('materas','material','product',false,true,20),
  ('materas','tamano','product',false,true,30), ('materas','acabado','product',false,true,40), ('materas','color','variant',true,true,100),
  ('kits-materos','material','product',false,true,10), ('kits-materos','color','variant',false,true,100),
  ('cuchillos','tipo-cuchillo','product',true,true,10), ('cuchillos','largo-hoja-mm','product',true,true,20),
  ('cuchillos','ancho-hoja-mm','product',false,false,30), ('cuchillos','configuracion-filo','product',true,true,40),
  ('cuchillos','tiene-gavilan','product',false,true,50), ('cuchillos','forma-gavilan','product',false,true,60),
  ('cuchillos','material-hoja','product',false,true,70), ('cuchillos','material-cabo','product',false,true,80),
  ('cuchillos','material-vaina','product',false,true,90), ('cuchillos','acabado','product',false,true,100),
  ('calzado','material','product',false,true,10), ('calzado','color','variant',true,true,100), ('calzado','talle','variant',true,true,110),
  ('marroquineria','material','product',false,true,10), ('marroquineria','forma','product',false,true,20),
  ('marroquineria','acabado','product',false,true,30), ('marroquineria','color','variant',true,true,100)
on conflict (category_code, attribute_code, scope) do update
set required = excluded.required, filterable = excluded.filterable, sort_order = excluded.sort_order;

-- Legacy product and variant backfill. Gift products are preserved but hidden for manual reclassification.
update public.commerce_products set published = false where category = 'regalos';
update public.commerce_products
set category = 'bombillas', category_code = 'bombillas', attributes = attributes || jsonb_build_object('tipo-bombilla', 'bombillon')
where category = 'bombillones';
update public.commerce_products
set category_code = case
  when category = 'kit-matero' then 'kits-materos' when category = 'cuchillo' then 'cuchillos'
  when category in ('mates','bombillas','termos','materas','kits-materos','cuchillos','calzado','botas','cintos','billeteras','carteras') then category
  else null end
where category <> 'regalos';
update public.commerce_products
set attributes = attributes
  || case when jsonb_array_length(catalog_filters -> 'materials') = 1 then jsonb_build_object('material', catalog_filters -> 'materials' ->> 0) else '{}'::jsonb end
  || case when category_code = 'mates' and jsonb_array_length(catalog_filters -> 'productTypes') = 1 then jsonb_build_object('tipo-mate', catalog_filters -> 'productTypes' ->> 0) else '{}'::jsonb end
  || case when jsonb_array_length(catalog_filters -> 'finishes') = 1 then jsonb_build_object('acabado', catalog_filters -> 'finishes' ->> 0) else '{}'::jsonb end;
update public.commerce_variants v
set option_values = jsonb_build_object('color', coalesce(v.color, p.catalog_filters -> 'colors' ->> 0))
from public.commerce_products p
where p.id = v.product_id and v.option_values = '{}'::jsonb
  and coalesce(v.color, case when jsonb_array_length(p.catalog_filters -> 'colors') = 1 then p.catalog_filters -> 'colors' ->> 0 end) is not null
  and not exists (
    select 1 from public.commerce_variants v2
    where v2.product_id = v.product_id
      and v2.id <> v.id
      and coalesce(v2.color, case when jsonb_array_length(p.catalog_filters -> 'colors') = 1 then p.catalog_filters -> 'colors' ->> 0 end)
        = coalesce(v.color, case when jsonb_array_length(p.catalog_filters -> 'colors') = 1 then p.catalog_filters -> 'colors' ->> 0 end)
  );

comment on table public.commerce_categories is 'Spanish-first hierarchical storefront categories managed by Commerce Admin.';
comment on table public.commerce_attribute_definitions is 'Catalog attribute definitions shared by products and purchasable variants.';
comment on column public.commerce_products.attributes is 'Structured product-level attribute values keyed by taxonomy code.';
comment on column public.commerce_variants.option_values is 'Structured purchasable option values keyed by taxonomy code.';
comment on column public.commerce_product_images.option_values is 'Option values, normally color, used to share media across matching variants.';
