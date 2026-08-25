-- Catálogo canónico para el dashboard: una regla por importe editable.
-- Las definiciones y versiones históricas se conservan, pero las reglas
-- anteriores dejan de participar en el cálculo vigente.
update public.pricing_rule_definitions
set active = false,
    required = false;

insert into public.pricing_rule_definitions
  (rule_key, rule_type, label, value_kind, family_id, texture_id, color_id, metal_id, size_id, customization_id, required, active, sort_order)
values
  ('family:camionero', 'family', 'Camionero · precio base', 'uyu', 'camionero', null, null, null, null, null, true, true, 10000),
  ('family:imperial', 'family', 'Imperial · precio base', 'uyu', 'imperial', null, null, null, null, null, true, true, 20000),
  ('family:torpedo', 'family', 'Torpedo · precio base', 'uyu', 'torpedo', null, null, null, null, null, true, true, 30000),
  ('family:criollo', 'family', 'Criollo · precio base', 'uyu', 'criollo', null, null, null, null, null, true, true, 40000),

  ('tree:imperial:cincelado-premium', 'texture', 'Cincelado Premium · adicional', 'uyu', 'imperial', 'cincelado-premium', null, null, null, null, true, true, 20100),
  ('metal:plata-900', 'metal', 'Plata 900 · adicional', 'uyu', 'imperial', 'virola-plata-900', null, 'plata-900', null, null, true, true, 20300),

  ('tree:criollo:torpedo-criollo-posa-mate', 'texture', 'Torpedo criollo posa mate · adicional', 'uyu', 'criollo', 'torpedo-criollo-posa-mate', null, null, null, null, true, true, 40100),
  ('metal:criollo:torpedo-criollo-posa-mate:alpaca-grande-lacre', 'metal', 'Alpaca grande al lacre · Torpedo', 'uyu', 'criollo', 'torpedo-criollo-posa-mate', null, 'alpaca-grande-lacre-torpedo', null, null, true, true, 40110),
  ('tree:criollo:imperial-criollo-posa-mate', 'texture', 'Imperial criollo posa mate · adicional', 'uyu', 'criollo', 'imperial-criollo-posa-mate', null, null, null, null, true, true, 40200),
  ('metal:criollo:imperial-criollo-posa-mate:alpaca-grande-lacre', 'metal', 'Alpaca grande al lacre · Imperial', 'uyu', 'criollo', 'imperial-criollo-posa-mate', null, 'alpaca-grande-lacre-imperial', null, null, true, true, 40210),
  ('tree:criollo:camionero-criollo-posa-mate', 'texture', 'Camionero criollo posa mate · adicional', 'uyu', 'criollo', 'camionero-criollo-posa-mate', null, null, null, null, true, true, 40300),

  ('leather:stamped', 'texture', 'Cuero estampado', 'uyu', null, null, null, null, null, null, true, true, 50010),
  ('leather:raw', 'texture', 'Cuero crudo', 'uyu', null, null, null, null, null, null, true, true, 50020),
  ('leather:print-pelos', 'texture', 'Print / pelos', 'uyu', null, null, null, null, null, null, true, true, 50030),
  ('leather:vaqueta', 'texture', 'Vaqueta', 'uyu', null, null, null, null, null, null, true, true, 50040),
  ('leather:raw-posa-mate', 'texture', 'Cuero crudo para posa mate', 'uyu', null, null, null, null, null, null, true, true, 50050),
  ('metal:alpaca-bronce', 'metal', 'Alpaca y bronce', 'uyu', null, null, null, 'alpaca-bronce', null, null, true, true, 50110),
  ('metal:alpaca-grande', 'metal', 'Alpaca grande', 'uyu', null, null, null, 'alpaca-grande', null, null, true, true, 50120),

  ('customization:laser:rim_text', 'customization', 'Virola · texto por carácter', 'uyu', null, null, null, null, null, 'laser:rim_text', true, true, 51010),
  ('customization:laser:rim_image', 'customization', 'Virola · imagen o icono', 'uyu', null, null, null, null, null, 'laser:rim_image', true, true, 51020),
  ('customization:bronze-applique:rim_text', 'customization', 'Virola · texto por carácter', 'uyu', null, null, null, null, null, 'bronze-applique:rim_text', true, true, 52010),
  ('customization:bronze-applique:rim_image', 'customization', 'Virola · imagen o icono', 'uyu', null, null, null, null, null, 'bronze-applique:rim_image', true, true, 52020),
  ('customization:bronze-applique:fleje_text', 'customization', 'Fleje · texto por carácter', 'uyu', null, null, null, null, null, 'bronze-applique:fleje_text', true, true, 52030),
  ('customization:bronze-applique:fleje_image', 'customization', 'Fleje · imagen o icono', 'uyu', null, null, null, null, null, 'bronze-applique:fleje_image', true, true, 52040),
  ('customization:alpaca-applique:rim_text', 'customization', 'Virola · texto por carácter', 'uyu', null, null, null, null, null, 'alpaca-applique:rim_text', true, true, 53010),
  ('customization:alpaca-applique:rim_image', 'customization', 'Virola · imagen o icono', 'uyu', null, null, null, null, null, 'alpaca-applique:rim_image', true, true, 53020),
  ('customization:alpaca-applique:fleje_text', 'customization', 'Fleje · texto por carácter', 'uyu', null, null, null, null, null, 'alpaca-applique:fleje_text', true, true, 53030),
  ('customization:alpaca-applique:fleje_image', 'customization', 'Fleje · imagen o icono', 'uyu', null, null, null, null, null, 'alpaca-applique:fleje_image', true, true, 53040),
  ('commission:mercado_pago', 'commission', 'Comisión de Mercado Pago', 'percent', null, null, null, null, null, null, true, true, 54010)
on conflict (rule_key) do update
set rule_type = excluded.rule_type,
    label = excluded.label,
    value_kind = excluded.value_kind,
    family_id = excluded.family_id,
    texture_id = excluded.texture_id,
    color_id = excluded.color_id,
    metal_id = excluded.metal_id,
    size_id = excluded.size_id,
    customization_id = excluded.customization_id,
    required = excluded.required,
    active = excluded.active,
    sort_order = excluded.sort_order;

-- Se cargan los importes actuales solamente cuando la versión todavía no tiene
-- ese valor. Así se respetan cambios administrativos existentes.
insert into public.pricing_catalog_values (version_id, rule_key, value, updated_at)
select version.id, seed.rule_key, seed.value, clock_timestamp()
from public.pricing_catalog_versions version
cross join (values
  ('family:camionero'::text, 1800::numeric),
  ('family:imperial'::text, 2600::numeric),
  ('family:torpedo'::text, 1800::numeric),
  ('family:criollo'::text, 0::numeric),
  ('tree:imperial:cincelado-premium'::text, 3000::numeric),
  ('metal:plata-900'::text, 17500::numeric),
  ('tree:criollo:torpedo-criollo-posa-mate'::text, 1300::numeric),
  ('metal:criollo:torpedo-criollo-posa-mate:alpaca-grande-lacre'::text, 2500::numeric),
  ('tree:criollo:imperial-criollo-posa-mate'::text, 1900::numeric),
  ('metal:criollo:imperial-criollo-posa-mate:alpaca-grande-lacre'::text, 3000::numeric),
  ('tree:criollo:camionero-criollo-posa-mate'::text, 1300::numeric),
  ('leather:stamped'::text, 200::numeric),
  ('leather:raw'::text, 600::numeric),
  ('leather:print-pelos'::text, 600::numeric),
  ('leather:vaqueta'::text, 400::numeric),
  ('leather:raw-posa-mate'::text, 650::numeric),
  ('metal:alpaca-bronce'::text, 300::numeric),
  ('metal:alpaca-grande'::text, 300::numeric),
  ('customization:laser:rim_text'::text, 150::numeric),
  ('customization:laser:rim_image'::text, 400::numeric),
  ('customization:bronze-applique:rim_text'::text, 150::numeric),
  ('customization:bronze-applique:rim_image'::text, 400::numeric),
  ('customization:bronze-applique:fleje_text'::text, 150::numeric),
  ('customization:bronze-applique:fleje_image'::text, 400::numeric),
  ('customization:alpaca-applique:rim_text'::text, 150::numeric),
  ('customization:alpaca-applique:rim_image'::text, 400::numeric),
  ('customization:alpaca-applique:fleje_text'::text, 150::numeric),
  ('customization:alpaca-applique:fleje_image'::text, 400::numeric),
  ('commission:mercado_pago'::text, 12::numeric)
) as seed(rule_key, value)
where version.status in ('published', 'draft')
on conflict (version_id, rule_key) do nothing;

notify pgrst, 'reload schema';
