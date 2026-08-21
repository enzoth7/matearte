-- Nuevo esquema comercial informado por Richard. Las reglas históricas se
-- conservan, pero dejan de participar en el catálogo vigente.
update public.pricing_rule_definitions
set active = false,
    required = false
where rule_type in ('texture', 'metal', 'size', 'customization');

update public.pricing_rule_definitions
set active = true,
    required = false,
    label = initcap(family_id) || ' · precio base',
    sort_order = case family_id
      when 'camionero' then 10000
      when 'imperial' then 20000
      when 'torpedo' then 30000
      else 40000
    end
where rule_type = 'family';

insert into public.pricing_rule_definitions
  (rule_key, rule_type, label, value_kind, required, active, sort_order)
values
  ('leather:stamped', 'texture', 'Cuero estampado', 'uyu', true, true, 50010),
  ('leather:raw', 'texture', 'Cuero crudo', 'uyu', true, true, 50020),
  ('leather:print-pelos', 'texture', 'Print y pelos', 'uyu', false, true, 50030),
  ('metal:plata-900', 'metal', 'Plata 900', 'uyu', false, true, 50040)
on conflict (rule_key) do update
set label = excluded.label,
    value_kind = excluded.value_kind,
    required = excluded.required,
    active = excluded.active,
    sort_order = excluded.sort_order;

insert into public.pricing_rule_definitions
  (rule_key, rule_type, label, value_kind, customization_id, required, active, sort_order)
values
  ('customization:laser:rim_text', 'customization', 'Virola · texto', 'uyu', 'laser:rim_text', false, true, 51010),
  ('customization:laser:rim_image', 'customization', 'Virola · imagen o icono', 'uyu', 'laser:rim_image', false, true, 51020),
  ('customization:laser:rim_finish', 'customization', 'Virola · terminación', 'uyu', 'laser:rim_finish', false, true, 51030),
  ('customization:laser:fleje_text', 'customization', 'Fleje · texto', 'uyu', 'laser:fleje_text', false, true, 51040),
  ('customization:laser:fleje_image', 'customization', 'Fleje · imagen o icono', 'uyu', 'laser:fleje_image', false, true, 51050),
  ('customization:laser:fleje_finish', 'customization', 'Fleje · terminación', 'uyu', 'laser:fleje_finish', false, true, 51060),
  ('customization:bronze-applique:rim_text', 'customization', 'Virola · texto', 'uyu', 'bronze-applique:rim_text', false, true, 52010),
  ('customization:bronze-applique:rim_image', 'customization', 'Virola · imagen o icono', 'uyu', 'bronze-applique:rim_image', false, true, 52020),
  ('customization:bronze-applique:rim_finish', 'customization', 'Virola · terminación', 'uyu', 'bronze-applique:rim_finish', false, true, 52030),
  ('customization:bronze-applique:fleje_text', 'customization', 'Fleje · texto', 'uyu', 'bronze-applique:fleje_text', false, true, 52040),
  ('customization:bronze-applique:fleje_image', 'customization', 'Fleje · imagen o icono', 'uyu', 'bronze-applique:fleje_image', false, true, 52050),
  ('customization:bronze-applique:fleje_finish', 'customization', 'Fleje · terminación', 'uyu', 'bronze-applique:fleje_finish', false, true, 52060)
on conflict (rule_key) do update
set label = excluded.label,
    value_kind = excluded.value_kind,
    customization_id = excluded.customization_id,
    required = excluded.required,
    active = excluded.active,
    sort_order = excluded.sort_order;

update public.pricing_rule_definitions
set active = true,
    required = true,
    label = 'Comisión de Mercado Pago',
    sort_order = 53010
where rule_key = 'commission:mercado_pago';

-- Los cuatro precios base y los adicionales todavía desconocidos comienzan
-- vacíos. Solo se precargan los importes confirmados.
delete from public.pricing_catalog_values value
using public.pricing_catalog_versions version
where value.version_id = version.id
  and version.status in ('published', 'draft')
  and value.rule_key in (
    'family:camionero', 'family:imperial', 'family:torpedo', 'family:criollo',
    'leather:print-pelos', 'metal:plata-900',
    'customization:laser:rim_text', 'customization:laser:rim_image', 'customization:laser:rim_finish',
    'customization:laser:fleje_text', 'customization:laser:fleje_image', 'customization:laser:fleje_finish',
    'customization:bronze-applique:rim_text', 'customization:bronze-applique:rim_image', 'customization:bronze-applique:rim_finish',
    'customization:bronze-applique:fleje_text', 'customization:bronze-applique:fleje_image', 'customization:bronze-applique:fleje_finish'
  );

insert into public.pricing_catalog_values (version_id, rule_key, value, updated_at)
select version.id, seed.rule_key, seed.value, clock_timestamp()
from public.pricing_catalog_versions version
cross join (values
  ('leather:stamped'::text, 200::numeric),
  ('leather:raw'::text, 600::numeric),
  ('commission:mercado_pago'::text, 12::numeric)
) as seed(rule_key, value)
where version.status in ('published', 'draft')
on conflict (version_id, rule_key) do update
set value = excluded.value,
    updated_at = excluded.updated_at;

create or replace function public.get_published_pricing_catalog()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'versionId', version.id,
    'version', version.version,
    'publishedAt', version.published_at,
    'rules', coalesce((
      select jsonb_object_agg(value.rule_key, value.value order by value.rule_key)
      from public.pricing_catalog_values value
      join public.pricing_rule_definitions definition
        on definition.rule_key = value.rule_key
       and definition.active = true
      where value.version_id = version.id
    ), '{}'::jsonb)
  )
  from public.pricing_catalog_versions version
  where version.status = 'published'
  limit 1;
$$;

revoke all on function public.get_published_pricing_catalog() from public, anon, authenticated;
grant execute on function public.get_published_pricing_catalog() to anon, authenticated;
