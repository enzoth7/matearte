-- Identify mates by their catalog category, including personalized mates.
-- Keep editorial_slug unchanged so existing product URLs remain valid.
update public.commerce_products
set name = 'Mate ' || btrim(name)
where category_code in ('mates', 'personalizados')
  and btrim(name) !~* '^mate([[:space:][:punct:]]|$)';
