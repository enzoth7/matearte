-- Remove 'tamano' attribute rule from materas category

delete from public.commerce_category_attributes
where category_code = 'materas'
  and attribute_code = 'tamano';
