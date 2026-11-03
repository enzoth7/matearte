update public.commerce_products
set description_pt = replace(description_pt, ' Feito sob encomenda.', ' Sob encomenda.')
where description_pt like '% Feito sob encomenda.';
