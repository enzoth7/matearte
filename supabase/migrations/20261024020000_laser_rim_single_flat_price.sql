-- El grabado láser de virola se cobra una sola vez, con texto, imágenes o ambos.
-- La tarifa de imágenes se conserva en versiones históricas, pero ya no se
-- publica ni aparece en Gestión. Los apliques mantienen su tarifa por imagen.
update public.pricing_rule_definitions
set active = false,
    required = false
where rule_key = 'customization:laser:rim_image';

update public.pricing_rule_definitions
set label = 'Virola · grabado láser completo · precio total'
where rule_key = 'customization:laser:rim_text';
