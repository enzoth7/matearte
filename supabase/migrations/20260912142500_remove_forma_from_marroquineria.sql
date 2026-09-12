-- Remove 'forma' attribute rule from marroquineria and cintos categories

delete from public.commerce_category_attributes
where category_code in ('marroquineria', 'cintos')
  and attribute_code = 'forma';
