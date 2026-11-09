alter table public.inventory_cost_lines
  add column catalog_variant_id uuid references public.commerce_variants(id) on delete restrict;

delete from public.inventory_cost_lines line
using public.inventory_cost_profiles profile
where line.profile_id = profile.id
  and profile.category_code = 'botas'
  and line.amount_minor is null
  and ((line.kind = 'purchase' and line.name = 'Compra por par')
    or (line.kind = 'freight' and line.name = 'Flete de entrada por par'));

alter table public.inventory_cost_lines
  add constraint inventory_cost_purchase_variant_check
  check ((kind = 'purchase') = (catalog_variant_id is not null));

create unique index inventory_cost_purchase_variant_uidx
  on public.inventory_cost_lines(catalog_variant_id)
  where kind = 'purchase';
