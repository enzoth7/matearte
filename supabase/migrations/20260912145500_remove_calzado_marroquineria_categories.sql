-- Migration: 20260912145500_remove_calzado_marroquineria_categories.sql
-- Remove 'calzado' and 'marroquineria' categories, making 'botas', 'cintos', 'billeteras', and 'carteras' top-level categories.

-- 1. Unlink parent_code and update sort orders
update public.commerce_categories
set parent_code = null
where parent_code in ('calzado', 'marroquineria');

update public.commerce_categories set sort_order = 70 where code = 'botas';
update public.commerce_categories set sort_order = 80 where code = 'cintos';
update public.commerce_categories set sort_order = 81 where code = 'billeteras';
update public.commerce_categories set sort_order = 82 where code = 'carteras';

-- 2. Migrate attribute rules to 'botas'
insert into public.commerce_category_attributes (category_code, attribute_code, scope, required, filterable, sort_order)
values
  ('botas', 'material', 'product', false, true, 10),
  ('botas', 'genero', 'product', false, true, 20),
  ('botas', 'color', 'variant', true, true, 100),
  ('botas', 'talle', 'variant', true, true, 110)
on conflict (category_code, attribute_code, scope)
do update set
  required = excluded.required,
  filterable = excluded.filterable,
  sort_order = excluded.sort_order;

-- 3. Migrate attribute rules to 'cintos', 'billeteras', and 'carteras'
insert into public.commerce_category_attributes (category_code, attribute_code, scope, required, filterable, sort_order)
values
  ('cintos', 'material', 'product', false, true, 10),
  ('cintos', 'acabado', 'product', false, true, 30),
  ('cintos', 'color', 'variant', true, true, 100),
  ('billeteras', 'material', 'product', false, true, 10),
  ('billeteras', 'acabado', 'product', false, true, 30),
  ('billeteras', 'color', 'variant', true, true, 100),
  ('carteras', 'material', 'product', false, true, 10),
  ('carteras', 'acabado', 'product', false, true, 30),
  ('carteras', 'color', 'variant', true, true, 100)
on conflict (category_code, attribute_code, scope)
do update set
  required = excluded.required,
  filterable = excluded.filterable,
  sort_order = excluded.sort_order;

-- 4. Reassign any existing products assigned to calzado or marroquineria
update public.commerce_products
set category = 'botas', category_code = 'botas'
where category = 'calzado';

update public.commerce_products
set category = 'cintos', category_code = 'cintos'
where category = 'marroquineria';

-- 5. Delete orphan category attribute rules for calzado and marroquineria
delete from public.commerce_category_attributes
where category_code in ('calzado', 'marroquineria');

-- 6. Delete categories 'calzado' and 'marroquineria'
delete from public.commerce_categories
where code in ('calzado', 'marroquineria');
