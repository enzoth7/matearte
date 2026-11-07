-- El precio ARS adoptado del catálogo se vuelve el total de cada línea identificada.
-- Las líneas sin producto identificado conservan su importe nulo.
update public.order_items as item
set total_arg = item.unit_price_arg * item.quantity
where item.immutable_snapshot ->> 'historicalPriceSource' = 'catalog_2026-11-07'
  and item.unit_price_arg is not null
  and item.total_arg is null;

-- El equipo confirmó que estos pedidos antiguos estaban pagados por completo.
-- Registrar el importe de apertura solo en pedidos con todas sus líneas valuadas.
-- No se crean recibos ni ingresos nuevos.
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
