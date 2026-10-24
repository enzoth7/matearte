-- El diámetro del caño de la bombilla se carga en milímetros (8 o 10), como indica el código
-- "diametro-cano-mm"; la unidad guardada era "cm" y la ficha mostraba "8 cm".
update public.commerce_attribute_definitions
set unit = 'mm'
where code = 'diametro-cano-mm'
  and unit = 'cm';
