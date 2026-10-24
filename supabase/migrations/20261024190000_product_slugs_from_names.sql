-- Las URLs de producto se derivan del nombre. Antes había slugs heredados de una importación
-- ("mayorista-NN"), de nombres anteriores o con sufijos al azar; las URLs anteriores quedan
-- redirigidas de forma permanente desde la web (paginaweb/src/lib/product-slug-redirects.ts).
-- Ningún slug nuevo coincide con el slug anterior de otro producto publicado, así que ninguna
-- URL pública pasa a mostrar un producto distinto.

do $$
declare
  expected integer;
  found integer;
begin
  create temporary table _product_slug_changes (
    old_slug text primary key,
    new_slug text not null unique
  ) on commit drop;

  insert into _product_slug_changes (old_slug, new_slug) values
    ('bombillon-pico-de-loro', 'bombillon-pico-de-loro-alpaca'),
    ('bota', 'bota-texana-corta'),
    ('bota-estampada', 'bota-modelo-sophie'),
    ('bota-hombre', 'bota-de-hombre-larga'),
    ('bota-modelo-sophie-7732adff', 'bota-modelo-sophie-2'),
    ('bota-vaquera', 'bota-texana-larga'),
    ('camionero-cuero-crudo-alpaca-cincelada', 'mate-camionero-cuero-crudo-alpaca-cincelada'),
    ('camionero-plata-900', 'mate-camionero-plata-900'),
    ('camionero-sin-patass-virola-de-acero', 'mate-camionero-sin-patas-virola-de-acero'),
    ('cartera-de-cuero', 'cartera-matera'),
    ('cinto-de-cuero', 'cinto-de-cuero-hebilla-dorada'),
    ('cinto-negro', 'cinto-de-vestir'),
    ('criollo-camionero-con-posa-mate-de-cuero-crudo-alpaca-cincelada', 'mate-criollo-camionero-con-posa-mate-de-cuero-crudo-alpaca-cincelada'),
    ('criollo-premium-con-posa-mate', 'mate-criollo-premium-con-posa-mate'),
    ('imperial-croco-fleje-pampa', 'mate-imperial-croco-fleje-pampa'),
    ('kit-matero', 'kit-matero-cuadrado'),
    ('kit-matero-9a144bdf', 'kit-matero-ovalado'),
    ('mate-criollo-con-posa-mate', 'mate-criollo-camionero-sin-virola'),
    ('mate-criollo-imperial-cuero-fleje-floral', 'mate-imperial-cuero-crudo-sin-patas-con-posa-mate-de-cuero-crudo'),
    ('mate-criollo-imperial-cuero-fleje-griego', 'mate-imperial-cuero-crudo-sin-patas-fleje-griego'),
    ('mate-criollo-imperial-cuero-fleje-pampa', 'mate-imperial-forrado-en-cuero-crudo-sin-patas-con-posa-mate-de-cuero-crudo-cinta-pampa'),
    ('mate-criollo-imperial-fleje-abstracto', 'mate-criollo-imperial-fleje-abstracto-con-posa-mate-de-cuero-crudo'),
    ('mate-criollo-imperial-fleje-flores', 'mate-criollo-imperial-fleje-flores-con-posa-mate-de-cuero-crudo'),
    ('mate-criollo-imperial-fleje-griego', 'mate-criollo-imperial-fleje-griego-con-posa-mate-de-cuero-crudo'),
    ('mate-criollo-imperial-fleje-liso', 'mate-criollo-imperial-fleje-liso-con-posa-mate-de-cuero-crudo'),
    ('mate-criollo-imperial-fleje-pampa', 'mate-criollo-imperial-fleje-pampa-con-posa-mate-de-cuero-crudo'),
    ('mate-criollo-imperial-fleje-pampa-62f080fc', 'mate-criollo-imperial-fleje-pampa-virola-de-acero'),
    ('mate-criollo-personalizado-escudo-de-uruguay', 'mate-criollo-vaqueta-personalizada-escudo-de-uruguay'),
    ('mate-criollo-torpedo-virola-lisa', 'mate-criollo-virola-alpaca-lisa'),
    ('mate-criollo-vaqueta-personalizada-paysandu-4c338e7b', 'mate-criollo-vaqueta-personalizada-paysandu-2'),
    ('mate-criollo-vaqueta-personalizada-uruguay', 'mate-criollo-virola-alpaca-y-bronce-vaqueta-personalizada-uruguay'),
    ('mate-criollo-vaqueta-personalizada-uruguay-185ff284', 'mate-criollo-vaqueta-personalizada-uruguay-2'),
    ('mate-de-plata-900', 'mate-cuero-crudo-virola-de-plata-900'),
    ('mate-estribo-camionero', 'mate-camionero-coleccion-estribo'),
    ('mate-estribo-imperial', 'mate-imperial-coleccion-estribo'),
    ('mate-estribo-torpedo-alpaca-y-bronce', 'mate-coquito-coleccion-estribo-alpaca-y-bronce'),
    ('mate-imperial', 'mate-imperial-pie-de-alpaca-fleje-pampa'),
    ('mate-imperial-fleje-abstractp', 'mate-imperial-fleje-abstracto'),
    ('mate-torpedo', 'mate-torpedo-alpaca-grande-cincelada'),
    ('mate-torpedo-cuero-liso-virola-personalizada-escudo-auf', 'mate-torpedo-personalizado-auf-2'),
    ('mate-torpedo-plata-cincelado-premium', 'mate-torpedo-plata-900'),
    ('mate-torpedo-virola-personalizada-escudo-auf', 'mate-torpedo-personalizado-auf'),
    ('matera', 'matera-ovalada'),
    ('matera-criolla', 'matera-cuero-crudo-aza-con-argolla'),
    ('matera-estampada-db362cbe', 'matera-estampada'),
    ('mayorista-1', 'mate-camionero-virola-alpaca-cincelada'),
    ('mayorista-10', 'mate-criollo-coquito-con-posa-mate-copa'),
    ('mayorista-11', 'mate-criollo-torpedo-alpaca-grande-cincelada-con-posa-mate'),
    ('mayorista-12', 'mate-imperial-premium-auf'),
    ('mayorista-19', 'mate-torpedo-cuero-crudo-alpaca-grande-cincelada'),
    ('mayorista-2', 'mate-criollo-camionero-con-posa-mate-copa'),
    ('mayorista-20', 'mate-torpedo-cuero-liso-alpaca-grande-lisa'),
    ('mayorista-22', 'mate-torpedo-alpaca-cincelada-pelos'),
    ('mayorista-25', 'mate-torpedo-virola-alpaca-y-bronce-croco'),
    ('mayorista-28', 'mate-torpedo-cuero-liso-alpaca-cincelada'),
    ('mayorista-31', 'mate-torpedo-cuero-estampado-alpaca-cincelada'),
    ('mayorista-32', 'mate-torpedo-cuero-estampado-alpaca-grande-cincelada'),
    ('mayorista-33', 'mate-torpedo-cuero-estampado-alpaca-grande-lisa'),
    ('mayorista-34', 'mate-torpedo-acero-liso'),
    ('mayorista-36', 'bombillon-pico-alpaca'),
    ('mayorista-38', 'bombillon-con-aros-pico-alpaca'),
    ('mayorista-4', 'mate-camionero-virola-acero-liso'),
    ('mayorista-40', 'bombilla-cincelada'),
    ('mayorista-6', 'mate-criollo-coquito-virola-acero-liso'),
    ('mayorista-8', 'mate-criollo-alpaca-grande-cincelada-con-posa-mate'),
    ('mayorista-9', 'mate-criollo-coquito-con-posa-mate-cinta'),
    ('termo-stanley', 'termo-stanley-con-manija'),
    ('termo-stanley-21994043', 'termo-stanley-2'),
    ('torpedo-alpaca-cincelado-premium', 'mate-torpedo-alpaca-cincelado-premium'),
    ('torpedo-alpaca-premium', 'mate-torpedo-alpaca-premium'),
    ('torpedo-cuerdo-crudo-alpaca-lisa', 'mate-torpedo-cuerdo-crudo-alpaca-lisa'),
    ('torpedo-cuero-estampado-pie-de-alpaca', 'mate-torpedo-cuero-estampado-pie-de-alpaca'),
    ('torpedo-pelos-premium', 'mate-torpedo-pelos-premium'),
    ('torpedo-premium-pie-de-alpaca', 'mate-torpedo-premium-pie-de-alpaca'),
    ('torpedo-virola-de-alpaca-croco', 'mate-torpedo-virola-de-alpaca-croco'),
    ('bota-modelo-sophie', 'bota-modelo-sophie-3'),
    ('matera-estampada', 'matera-cuero-y-madera');

  select count(*) into expected from _product_slug_changes;

  create temporary table _product_slug_rows on commit drop as
  select p.id, c.new_slug
  from _product_slug_changes c
  join public.commerce_products p on p.editorial_slug = c.old_slug;

  select count(*) into found from _product_slug_rows;
  if found <> expected then
    raise exception 'Se esperaban % productos para cambiar de slug y se encontraron %', expected, found;
  end if;

  if exists (
    select 1
    from _product_slug_rows r
    join public.commerce_products p on p.editorial_slug = r.new_slug
    where p.id <> r.id and p.editorial_slug not in (select old_slug from _product_slug_changes)
  ) then
    raise exception 'Un slug nuevo ya lo usa otro producto que no cambia';
  end if;

  -- Dos pasos para que un slug nuevo pueda coincidir con uno anterior que también se libera.
  update public.commerce_products p
  set editorial_slug = 'tmp-' || p.id::text
  from _product_slug_rows r
  where p.id = r.id;

  update public.commerce_products p
  set editorial_slug = r.new_slug
  from _product_slug_rows r
  where p.id = r.id;
end
$$;
