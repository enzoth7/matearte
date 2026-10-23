update public.commerce_attribute_options
set label_es = 'Todos los largos'
where attribute_code = 'largo-mm' and code = 'todos';

-- 'Todos' is a purchase choice, not a missing length. Restore the bombilla
-- that was hidden when this value was incorrectly treated as incomplete.
update public.commerce_variants v
set available_web = true
from public.commerce_products p
where v.product_id = p.id
  and p.editorial_slug = 'mayorista-40'
  and p.name = 'Bombilla Cincelada'
  and p.category_code = 'bombillas'
  and p.attributes->>'largo-mm' = 'todos'
  and v.active
  and v.price_minor > 0;

update public.commerce_products p
set published = true
where p.editorial_slug = 'mayorista-40'
  and p.name = 'Bombilla Cincelada'
  and p.category_code = 'bombillas'
  and p.attributes->>'largo-mm' = 'todos'
  and exists (
    select 1 from public.commerce_variants v
    where v.product_id = p.id and v.active and v.available_web and v.price_minor > 0
  );
