-- Productos desactivados: URLs por nombre en lugar de los slugs de la importación ("mayorista-N") y
-- nombres sin la calificación comercial que MateArte no usa. No tienen URL pública, así que no hacen falta
-- redirecciones. Un nombre en null deja el nombre como está.

do $$
declare
  expected integer;
  found integer;
begin
  create temporary table _product_renames (
    old_slug text primary key,
    new_name text,
    new_slug text not null unique
  ) on commit drop;

  insert into _product_renames (old_slug, new_name, new_slug) values
    ('mate-torpedo-alpaca-cincelado', null, 'mate-torpedo-acero-cincelado'),
    ('mate-criollo-torpedo', 'Mate Criollo Cincelado', 'mate-criollo-cincelado'),
    ('mate-imperial-cuero-crudo-sin-patas-con-posa-mate-fleje-premium', 'Mate Imperial Cuero Crudo Sin Patas Con Posa Mate de Cuero Crudo Fleje', 'mate-imperial-cuero-crudo-sin-patas-con-posa-mate-de-cuero-crudo-fleje'),
    ('imperial-cuero-crudo-sin-patas-fleje-premium', 'Mate Imperial Cuero Crudo Sin Patas Fleje', 'mate-imperial-cuero-crudo-sin-patas-fleje'),
    ('mate-imperial-forrado-cuero-crudo-sin-patas-con-posa-mate-cinta-premium', 'Mate Imperial Forrado en Cuero Crudo Sin Patas Con Posa Mate de Cuero Crudo Cinta', 'mate-imperial-forrado-en-cuero-crudo-sin-patas-con-posa-mate-de-cuero-crudo-cinta'),
    ('mate-imperial-pie-de-alpaca-fleje-premium', 'Mate Imperial Pie de Alpaca Fleje', 'mate-imperial-pie-de-alpaca-fleje'),
    ('mayorista-18', 'Mate Torpedo Alpaca Cincelado con Posa Mate', 'mate-torpedo-alpaca-cincelado-con-posa-mate'),
    ('torpedo-sin-patas-cincelado-premium', 'Mate Torpedo Sin Patas Cincelado', 'mate-torpedo-sin-patas-cincelado'),
    ('mayorista-3', null, 'mate-criollo-camionero-con-posa-mate-de-cuero-crudo'),
    ('mayorista-45', null, 'mate-criollo-coquito'),
    ('mayorista-46', null, 'mate-imperial-ceramica'),
    ('mayorista-16', null, 'mate-imperial-plata-900'),
    ('mayorista-21', null, 'mate-torpedo-alpaca-grande-cincelada-pelos'),
    ('mayorista-30', null, 'mate-torpedo-cuero-crudo-alpaca-cincelada'),
    ('mayorista-29', null, 'mate-torpedo-cuero-crudo-alpaca-y-bronce'),
    ('mayorista-26', null, 'mate-torpedo-cuero-liso-virola-acero-y-bronce-liso');

  select count(*) into expected from _product_renames;

  create temporary table _product_rename_rows on commit drop as
  select p.id, r.new_name, r.new_slug
  from _product_renames r
  join public.commerce_products p on p.editorial_slug = r.old_slug;

  select count(*) into found from _product_rename_rows;
  if found <> expected then
    raise exception 'Se esperaban % productos y se encontraron %', expected, found;
  end if;

  if exists (
    select 1 from _product_rename_rows r
    join public.commerce_products p on p.editorial_slug = r.new_slug
    where p.id <> r.id and p.editorial_slug not in (select old_slug from _product_renames)
  ) then
    raise exception 'Un slug nuevo ya lo usa otro producto que no cambia';
  end if;

  update public.commerce_products p
  set editorial_slug = 'tmp-' || p.id::text
  from _product_rename_rows r
  where p.id = r.id;

  update public.commerce_products p
  set editorial_slug = r.new_slug,
      name = coalesce(r.new_name, p.name)
  from _product_rename_rows r
  where p.id = r.id;
end
$$;
