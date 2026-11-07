-- Los servicios vendidos en Local requieren taller y posterior entrega o envío.
-- Las ventas presenciales de artículos comunes siguen fuera de este circuito.
create or replace function private.guard_in_person_catalog_fulfillment()
returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.channel in ('Local', 'Feria')
     and new.status in ('shipped', 'delivered')
     and new.status is distinct from old.status
     and exists (
       select 1 from public.order_items as item where item.order_id = new.id
     )
     and not exists (
       select 1
       from public.order_items as item
       left join public.commerce_variants as variant on variant.id = item.source_variant_id
       left join public.commerce_products as product on product.id = variant.product_id
       where item.order_id = new.id
         and (
           item.item_type = 'design'
           or coalesce(item.immutable_snapshot -> 'customization', 'null'::jsonb) <> 'null'::jsonb
           or coalesce(nullif(product.category_code, ''), product.category) = 'servicios'
         )
     ) then
    raise exception 'Las ventas de catálogo en el local o en feria no requieren envío ni entrega.' using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function private.guard_in_person_catalog_fulfillment() from public, anon, authenticated;
