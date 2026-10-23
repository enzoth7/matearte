-- The product now offers all configured lengths. Restore the web channel
-- that was disabled when its length was still missing.
update public.commerce_variants v
set available_web = true
from public.commerce_products p
where v.product_id = p.id
  and p.editorial_slug = 'bombillon-clasico'
  and p.name = 'Bombillon Clásico'
  and p.category_code = 'bombillas'
  and p.attributes->>'largo-mm' = 'todos'
  and v.active
  and v.price_minor > 0;

update public.commerce_products p
set published = true
where p.editorial_slug = 'bombillon-clasico'
  and p.name = 'Bombillon Clásico'
  and p.category_code = 'bombillas'
  and p.attributes->>'largo-mm' = 'todos'
  and exists (
    select 1 from public.commerce_variants v
    where v.product_id = p.id and v.active and v.available_web and v.price_minor > 0
  );
