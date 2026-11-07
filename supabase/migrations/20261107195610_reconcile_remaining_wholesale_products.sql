-- Correspondencias confirmadas por el equipo. Genérico describe un pedido sin
-- color único; el vínculo al producto se conserva sin inventar una variante.
with matches(line_id, product_id, generic_variant) as (
  values
    ('hist-4',  '671aa7a0-f541-47e3-88f2-22407b3f3c8b'::uuid, false),
    ('hist-11', '671aa7a0-f541-47e3-88f2-22407b3f3c8b'::uuid, false),
    ('hist-5',  'c3d911ed-6a63-4772-93f8-200e25c4eb85'::uuid, true),
    ('hist-34', 'c3d911ed-6a63-4772-93f8-200e25c4eb85'::uuid, true),
    ('hist-84', 'c3d911ed-6a63-4772-93f8-200e25c4eb85'::uuid, true),
    ('hist-105','c3d911ed-6a63-4772-93f8-200e25c4eb85'::uuid, true),
    ('hist-152','c3d911ed-6a63-4772-93f8-200e25c4eb85'::uuid, true),
    ('hist-6',  '2910224e-79a7-4a99-82b1-6e6261132371'::uuid, true),
    ('hist-21', '2910224e-79a7-4a99-82b1-6e6261132371'::uuid, true),
    ('hist-42', '2910224e-79a7-4a99-82b1-6e6261132371'::uuid, true),
    ('hist-113','2910224e-79a7-4a99-82b1-6e6261132371'::uuid, true),
    ('hist-8',  '53f05b09-aadb-4c43-b15f-e8de14b4e987'::uuid, false),
    ('hist-14', 'e7b9457a-dec5-4567-ab1a-72974351c9a6'::uuid, false),
    ('hist-22', '18348072-285e-4e65-bd54-a1392a49f04e'::uuid, true),
    ('hist-71', '18348072-285e-4e65-bd54-a1392a49f04e'::uuid, true),
    ('hist-31', 'de5cdb37-f426-40d3-a3af-bddd735e2e79'::uuid, true),
    ('hist-72', '3dadbd1f-4505-417c-b29c-f66560043f9f'::uuid, true)
), catalog as (
  select match.line_id, product.id as product_id, product.name as model,
    match.generic_variant,
    min(variant.wholesale_price_arg) as unit_price_arg,
    count(variant.id) as variant_count,
    min(variant.id::text)::uuid as only_variant_id,
    min(variant.sku) as only_sku,
    min(variant.name) as only_variant_name
  from matches as match
  join public.commerce_products as product on product.id = match.product_id
  join public.commerce_variants as variant on variant.product_id = product.id
    and variant.available_wholesale and variant.wholesale_price_arg > 0
  group by match.line_id, product.id, product.name, match.generic_variant
  having count(distinct variant.wholesale_price_arg) = 1
)
update public.order_items as item
set title = catalog.model || ' — ' || case when catalog.generic_variant then 'Genérico' else catalog.only_variant_name end,
    source_variant_id = case when catalog.variant_count = 1 then catalog.only_variant_id else null end,
    sku = case when catalog.variant_count = 1 then catalog.only_sku else null end,
    unit_price_arg = catalog.unit_price_arg,
    total_arg = catalog.unit_price_arg * item.quantity,
    immutable_snapshot = item.immutable_snapshot || jsonb_build_object(
      'model', catalog.model,
      'variant', case when catalog.generic_variant then 'Genérico' else catalog.only_variant_name end,
      'catalogProductId', catalog.product_id,
      'historicalPriceSource', 'catalog_2026-11-07_manually_matched',
      'historicalPriceRecordedAt', now()
    )
from catalog
where item.immutable_snapshot ->> 'lineId' = catalog.line_id
  and item.unit_price_arg is null
  and item.total_arg is null;

-- Los doce pedidos restantes tenían pago total confirmado antes de valuarse.
with complete_orders as (
  select item.order_id, round(sum(coalesce(item.total_arg, 0)) * 100)::bigint as total_arg_minor
  from public.order_items as item
  join public.orders as sale on sale.id = item.order_id and sale.channel = 'Mayorista'
  join public.wholesale_order_payment_openings as opening on opening.sale_id = sale.id
  where opening.paid_in_full_without_price
  group by item.order_id
  having bool_and(item.total_arg is not null or coalesce(item.no_cost, false))
)
update public.wholesale_order_payment_openings as opening
set collected_arg_minor = complete.total_arg_minor,
    paid_in_full_without_price = false
from complete_orders as complete
where opening.sale_id = complete.order_id
  and opening.paid_in_full_without_price;
