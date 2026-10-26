-- Anonymous storefront reads must not evaluate the private admin helper.
-- Keep the existing authenticated rules and the helper's restricted grants.
alter policy shipping_public_read on public.shipping_rates to authenticated;
create policy shipping_anon_read on public.shipping_rates
  for select to anon using (active);

alter policy taxonomy_attributes_public_read on public.commerce_attribute_definitions to authenticated;
create policy taxonomy_attributes_anon_read on public.commerce_attribute_definitions
  for select to anon using (active);

alter policy taxonomy_options_public_read on public.commerce_attribute_options to authenticated;
create policy taxonomy_options_anon_read on public.commerce_attribute_options
  for select to anon using (active);

alter policy taxonomy_rules_public_read on public.commerce_category_attributes to authenticated;
create policy taxonomy_rules_anon_read on public.commerce_category_attributes
  for select to anon using (
    exists (
      select 1 from public.commerce_categories c
      where c.code = commerce_category_attributes.category_code and c.active
    )
    and exists (
      select 1 from public.commerce_attribute_definitions a
      where a.code = commerce_category_attributes.attribute_code and a.active
    )
  );
