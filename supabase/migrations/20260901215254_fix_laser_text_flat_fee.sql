-- El texto grabado a láser se cobra una sola vez por diseño, no por carácter.
update public.pricing_rule_definitions
set label = 'Virola · texto láser · precio total'
where rule_key = 'customization:laser:rim_text';

insert into public.pricing_catalog_values (version_id, rule_key, value, updated_at)
select version.id, 'customization:laser:rim_text', 300, clock_timestamp()
from public.pricing_catalog_versions version
where version.status in ('published', 'draft')
on conflict (version_id, rule_key) do update
set value = excluded.value,
    updated_at = excluded.updated_at;

update public.pricing_catalog_versions
set updated_at = clock_timestamp()
where status in ('published', 'draft');
