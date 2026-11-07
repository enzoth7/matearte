-- Primera etapa de conciliación: fijar el precio unitario ARS del catálogo
-- para líneas históricas con producto identificable y precio único.
-- El total y el saldo del pedido se dejan pendientes hasta completar sus líneas.
with incomplete_orders as (
  select order_id
  from public.order_lines
  group by order_id
  having not bool_and(order_type = 'no_cost' or total_arg is not null)
), catalog_prices as (
  select line.line_id,
    case when lower(btrim(line.variant)) = 'genérico' then (
      select min(product.price_arg)
      from public.products as product
      where lower(btrim(product.model)) = lower(btrim(line.model))
      having count(distinct product.price_arg) = 1 and min(product.price_arg) > 0
    ) else (
      select min(product.price_arg)
      from public.products as product
      where lower(btrim(product.model)) = lower(btrim(line.model))
        and lower(btrim(product.variant)) = lower(btrim(line.variant))
      having count(distinct product.price_arg) = 1 and min(product.price_arg) > 0
    ) end as unit_price_arg
  from public.order_lines as line
  join incomplete_orders on incomplete_orders.order_id = line.order_id
  where line.unit_price_arg is null and line.total_arg is null
)
update public.order_items as item
set unit_price_arg = price.unit_price_arg,
    immutable_snapshot = item.immutable_snapshot || jsonb_build_object(
      'historicalPriceSource', 'catalog_2026-11-07',
      'historicalPriceRecordedAt', now()
    )
from catalog_prices as price
where item.immutable_snapshot ->> 'lineId' = price.line_id
  and item.unit_price_arg is null
  and item.total_arg is null
  and price.unit_price_arg is not null;
