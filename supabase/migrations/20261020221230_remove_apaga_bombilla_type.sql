-- Retirar el tipo incorrecto sin reasignar arbitrariamente los productos.
-- Quedan sin tipo hasta que se clasifiquen con una opción válida.
update public.commerce_products
set attributes = attributes - 'tipo-bombilla'
where attributes->>'tipo-bombilla' = 'apaga';

update public.products
set catalog_attributes = catalog_attributes - 'tipo-bombilla'
where catalog_attributes->>'tipo-bombilla' = 'apaga';

update public.commerce_variants
set option_values = option_values - 'tipo-bombilla'
where option_values->>'tipo-bombilla' = 'apaga';

delete from public.commerce_attribute_options
where attribute_code = 'tipo-bombilla' and code = 'apaga';
