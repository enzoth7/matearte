-- Make the ready-to-sell storefront pieces available to the cart. Prices are
-- the UYU amounts already displayed by the public catalog. They are kept as
-- made-to-order items, so cart availability does not pretend to know stock.

insert into public.commerce_variants (
  product_id,
  sku,
  name,
  price_minor,
  weight_grams,
  inventory_tracked,
  stock_on_hand,
  active
)
select
  product.id,
  seed.sku,
  'Única',
  seed.price_minor,
  null,
  false,
  0,
  true
from (
  values
    ('mate-imperial', 'MA-IMP-001', 450000::bigint),
    ('mate-imperial-animal-print', 'MA-IMP-AN-001', 380000::bigint),
    ('mate-criollo-con-posa-mate', 'MA-CRI-001', 320000::bigint),
    ('mate-camionero-acero-liso', 'MA-CAM-001', 550000::bigint),
    ('mate-torpedo', 'MA-TOR-001', 120000::bigint),
    ('bombilla-acero-desarmable', 'BO-ACE-001', 150000::bigint),
    ('bombilla-alpaca-pico-loro', 'BO-ALP-001', 280000::bigint),
    ('matera-de-colgar-cuero', 'MT-COL-001', 520000::bigint),
    ('matera-cuadrada-cuero', 'MT-CUA-001', 750000::bigint),
    ('matera-ovalada-cuero', 'MT-OVA-001', 420000::bigint),
    ('termo-stanley-800-ml', 'TE-STA-800-001', 480000::bigint),
    ('termo-stanley-12-l', 'TE-STA-12-001', 680000::bigint),
    ('termo-termolar-1l', 'TE-TER-001', 600000::bigint)
) as seed(editorial_slug, sku, price_minor)
join public.commerce_products product on product.editorial_slug = seed.editorial_slug
on conflict (sku) do update set
  price_minor = excluded.price_minor,
  inventory_tracked = false,
  stock_on_hand = 0,
  active = true;

update public.commerce_products
set
  sale_mode = 'made_to_order',
  published = true
where editorial_slug in (
  'mate-imperial',
  'mate-imperial-animal-print',
  'mate-criollo-con-posa-mate',
  'mate-camionero-acero-liso',
  'mate-torpedo',
  'bombilla-acero-desarmable',
  'bombilla-alpaca-pico-loro',
  'matera-de-colgar-cuero',
  'matera-cuadrada-cuero',
  'matera-ovalada-cuero',
  'termo-stanley-800-ml',
  'termo-stanley-12-l',
  'termo-termolar-1l'
);
