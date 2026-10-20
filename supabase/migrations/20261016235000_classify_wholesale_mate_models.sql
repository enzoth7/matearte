-- Each wholesale row is already an independent product. Classify its mate model
-- without touching its identity, price, photos or historical order references.
update public.products
set catalog_attributes = coalesce(catalog_attributes, '{}'::jsonb)
  || jsonb_build_object('tipo-mate', lower(trim(model)))
where category_code = 'mates'
  and lower(trim(model)) in ('imperial', 'camionero', 'criollo', 'torpedo')
  and nullif(catalog_attributes->>'tipo-mate', '') is null;
