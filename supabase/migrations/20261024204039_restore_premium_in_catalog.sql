-- "Premium" es un término comercial de MateArte: vuelve a los nombres, traducciones y descripciones
-- de donde lo habían quitado 20261024200000, 20261024210000, 20261024220000 y 20261024230000.
-- Los slugs nuevos se quedan como están.

do $$
declare
  expected integer;
  found integer;
begin
  create temporary table _premium_names (
    slug text primary key,
    name text not null,
    name_en text,
    name_pt text
  ) on commit drop;

  insert into _premium_names (slug, name, name_en, name_pt) values
    -- Desactivados: nombres anteriores a 20261024220000.
    ('mate-criollo-cincelado', 'Mate Criollo Cincelado Premium', null, null),
    ('mate-imperial-cuero-crudo-sin-patas-con-posa-mate-de-cuero-crudo-fleje', 'Mate Imperial Cuero Crudo Sin Patas Con Posa Mate de Cuero Crudo Fleje Premium', null, null),
    ('mate-imperial-cuero-crudo-sin-patas-fleje', 'Mate Imperial Cuero Crudo Sin Patas Fleje Premium', null, null),
    ('mate-imperial-forrado-en-cuero-crudo-sin-patas-con-posa-mate-de-cuero-crudo-cinta', 'Mate Imperial Forrado en Cuero Crudo Sin Patas Con Posa Mate de Cuero Crudo Cinta Premium', null, null),
    ('mate-imperial-pie-de-alpaca-fleje', 'Mate Imperial Pie de Alpaca Fleje Premium', null, null),
    ('mate-torpedo-alpaca-cincelado-con-posa-mate', 'Mate Torpedo Alpaca Cincelado Premium con Posa Mate', null, null),
    ('mate-torpedo-sin-patas-cincelado', 'Mate Torpedo Sin Patas Cincelado Premium', null, null),
    -- Publicados: el nombre en español no cambió; las traducciones lo habían omitido.
    ('mate-criollo-premium-con-posa-mate', 'Mate Criollo Premium con Posa  Mate', 'Premium Criollo Mate, Raw Leather, Large Chiseled Alpaca, with Coaster', 'Cuia Criollo Premium Couro Cru Alpaca Grande Cinzelada com Apoio'),
    ('mate-imperial-premium', 'Mate Imperial Premium', 'Premium Imperial Mate, Smooth Leather', 'Cuia Imperial Premium Couro Liso'),
    ('mate-imperial-premium-auf', 'Mate Imperial Premium AUF', 'Premium Imperial Mate, AUF', 'Cuia Imperial Premium AUF'),
    ('mate-torpedo-alpaca-cincelado-premium', 'Mate Torpedo Alpaca Cincelado Premium', 'Premium Torpedo Mate, Chiseled Alpaca', 'Cuia Torpedo Premium Alpaca Cinzelada'),
    ('mate-torpedo-alpaca-premium', 'Mate Torpedo Alpaca Premium', 'Premium Torpedo Mate, Alpaca', 'Cuia Torpedo Premium Alpaca'),
    ('mate-torpedo-pelos-premium', 'Mate Torpedo Pelos Premium', 'Premium Torpedo Mate, Hair-on Leather', 'Cuia Torpedo Premium Couro com Pelo'),
    ('mate-torpedo-premium-pie-de-alpaca', 'Mate Torpedo Premium Pie de Alpaca', 'Premium Torpedo Mate, Alpaca Base', 'Cuia Torpedo Premium Pé de Alpaca');

  select count(*) into expected from _premium_names;
  select count(*) into found from _premium_names n join public.commerce_products p on p.editorial_slug = n.slug;
  if found <> expected then
    raise exception 'Se esperaban % productos y se encontraron %', expected, found;
  end if;

  update public.commerce_products p
  set name = n.name,
      name_en = coalesce(n.name_en, p.name_en),
      name_pt = coalesce(n.name_pt, p.name_pt)
  from _premium_names n
  where p.editorial_slug = n.slug;
end
$$;

-- Descripciones generadas: la etiqueta de la virola y el fleje Premium.
update public.commerce_products
set description = replace(description, 'virola de alpaca grande cincelada', 'virola de alpaca grande cincelada premium'),
    description_en = replace(description_en, 'large chiseled alpaca rim', 'premium large chiseled alpaca rim'),
    description_pt = replace(description_pt, 'virola de alpaca grande cinzelada', 'virola de alpaca grande cinzelada premium')
where attributes->>'tipo-virola' = 'alpaca-grande-cincelada-premium'
  and description like '%virola de alpaca grande cincelada%'
  and description not like '%cincelada premium%';

update public.commerce_products
set description = replace(description, 'virola imperial', 'virola imperial premium'),
    description_en = replace(description_en, 'imperial rim', 'premium imperial rim'),
    description_pt = replace(description_pt, 'virola imperial', 'virola imperial premium')
where attributes->>'tipo-virola' = 'imperial-premium'
  and description like '%virola imperial%'
  and description not like '%virola imperial premium%';

update public.commerce_products
set description = regexp_replace(description, '(con virola [^,.]+)', '\1 y fleje premium'),
    description_en = regexp_replace(description_en, '(with [^,.]+ rim)', '\1 and premium band'),
    description_pt = regexp_replace(description_pt, '(com virola [^,.]+)', '\1 e faixa premium')
where attributes->>'diseno-fleje' = 'premium'
  and description like '%con virola %'
  and description not like '%fleje%';
