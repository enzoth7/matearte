do $$
declare
  v_matching integer;
  v_updated integer;
begin
  with expected(sale_id, reference_code, ars_minor, uyu_minor) as (
    values
      ('8282f60f-327a-4695-9ea5-1f51d8acce43'::uuid, '#M078', 90310000::bigint, 2348060::bigint),
      ('d723d297-9eee-4440-b5ca-d679ca0c2079'::uuid, '#M083', 72778000::bigint, 1892228::bigint)
  )
  select count(*) into v_matching
  from expected
  join public.orders sale on sale.id = expected.sale_id
    and sale.reference_code = expected.reference_code
    and sale.channel = 'Mayorista'
    and sale.created_at >= '2026-09-01'::timestamptz
    and sale.created_at < '2026-10-01'::timestamptz
  join public.wholesale_order_payment_openings opening on opening.sale_id = sale.id
    and opening.collected_arg_minor = 0
    and opening.collected_minor = 0
    and not opening.paid_in_full_without_price
    and not opening.finance_paid_at_order
  where (select round(sum(item.total_arg) * 100)::bigint from public.order_items item
         where item.order_id = sale.id) = expected.ars_minor
    and (select sum(item.total_minor)::bigint from public.order_items item
         where item.order_id = sale.id) = expected.uyu_minor
    and not exists (select 1 from public.order_items item
                    where item.order_id = sale.id and item.total_arg is null and not coalesce(item.no_cost, false))
    and not exists (select 1 from public.wholesale_order_receipts receipt where receipt.sale_id = sale.id)
    and not exists (select 1 from public.customer_account_allocations allocation where allocation.order_id = sale.id)
    and not exists (select 1 from public.wholesale_consignments consignment where consignment.order_id = sale.id);

  if v_matching <> 2 then
    raise exception 'M078 y M083 requieren revisión antes de registrar el pago histórico';
  end if;

  update public.wholesale_order_payment_openings opening
  set collected_arg_minor = expected.ars_minor,
      collected_minor = expected.uyu_minor,
      finance_paid_at_order = true
  from (values
      ('8282f60f-327a-4695-9ea5-1f51d8acce43'::uuid, 90310000::bigint, 2348060::bigint),
      ('d723d297-9eee-4440-b5ca-d679ca0c2079'::uuid, 72778000::bigint, 1892228::bigint)
  ) as expected(sale_id, ars_minor, uyu_minor)
  where opening.sale_id = expected.sale_id;

  get diagnostics v_updated = row_count;
  if v_updated <> 2 then
    raise exception 'No se actualizaron exactamente los dos pedidos históricos';
  end if;
end $$;
