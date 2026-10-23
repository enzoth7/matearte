-- These active products were left hidden when missing measures also blocked
-- publication. Visibility and checkout validation are now separate.
update public.commerce_variants v
set available_web = true
from public.commerce_products p
where v.product_id = p.id
  and p.category_code in ('bombillas', 'cintos')
  and p.editorial_slug in (
    'bombillon-pico-de-loro-bronce',
    'cinto-de-cuero',
    'cinto-de-cuero-hebilla-plateada',
    'cinto-negro'
  )
  and v.active
  and v.price_minor > 0;

update public.commerce_products p
set published = true
where p.category_code in ('bombillas', 'cintos')
  and p.editorial_slug in (
    'bombillon-pico-de-loro-bronce',
    'cinto-de-cuero',
    'cinto-de-cuero-hebilla-plateada',
    'cinto-negro'
  )
  and exists (
    select 1 from public.commerce_variants v
    where v.product_id = p.id and v.active and v.available_web and v.price_minor > 0
  );
