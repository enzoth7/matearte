-- Cotización confirmada para líneas mayoristas de julio y agosto sin equivalente UYU.
update public.order_items item
set exchange_rate = 0.0265,
    unit_price_minor = round(item.unit_price_arg * 0.0265 * 100)::bigint,
    total_minor = round(item.unit_price_arg * 0.0265 * 100)::bigint * item.quantity,
    immutable_snapshot = coalesce(item.immutable_snapshot, '{}'::jsonb) || jsonb_build_object(
      'unitPriceUyu', round(item.unit_price_arg * 0.0265, 2),
      'totalUyu', round(item.unit_price_arg * 0.0265, 2) * item.quantity)
from public.orders sale
where sale.id = item.order_id
  and sale.channel = 'Mayorista'
  and item.created_at >= timestamptz '2026-07-01 00:00:00+00'
  and item.created_at < timestamptz '2026-09-01 00:00:00+00'
  and item.immutable_snapshot->>'totalUyu' is null
  and item.exchange_rate is null
  and item.total_arg is not null;

update public.orders sale
set items_subtotal_minor = totals.total_minor,
    total_minor = totals.total_minor
from (
  select item.order_id, sum(item.total_minor)::bigint as total_minor
  from public.order_items item
  group by item.order_id
  having count(*) = count(item.immutable_snapshot->>'totalUyu')
     and bool_or(item.created_at >= timestamptz '2026-07-01 00:00:00+00'
       and item.created_at < timestamptz '2026-09-01 00:00:00+00')
) totals
where sale.id = totals.order_id
  and sale.channel = 'Mayorista'
  and sale.total_minor = 0;
