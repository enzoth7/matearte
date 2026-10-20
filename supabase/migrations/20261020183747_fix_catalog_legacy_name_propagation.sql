-- Capture historical model/variant pairs before replacing the compatibility
-- product name. This changes labels only, never order quantities or prices.
create or replace function private.sync_catalog_product_name_to_legacy()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.name is distinct from new.name then
    update public.order_lines line
    set model = new.name,
        variant = variant.name
    from public.products legacy
    join public.commerce_variants variant on variant.id = legacy.commerce_variant_id
    where legacy.commerce_product_id = new.id
      and line.model = legacy.model
      and line.variant = legacy.variant;
  end if;

  update public.products
  set model = new.name,
      category_code = new.category_code,
      description = new.description,
      catalog_attributes = new.attributes
  where commerce_product_id = new.id;

  if old.name is distinct from new.name then
    update public.local_sale_items item
    set product_name = new.name
    where exists (
      select 1
      from public.commerce_variants variant
      where variant.product_id = new.id
        and variant.id = item.variant_id
    );

    update public.order_items item
    set title = new.name || ' — ' || variant.name
    from public.commerce_variants variant
    where item.item_type = 'catalog'
      and item.source_variant_id = variant.id
      and variant.product_id = new.id;
  end if;
  return new;
end;
$$;
