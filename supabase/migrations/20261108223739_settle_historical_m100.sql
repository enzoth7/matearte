do $$
declare
  v_sale_id uuid;
  v_matches integer;
  v_updated integer;
begin
  select count(*), min(sale.id::text)::uuid into v_matches, v_sale_id
  from public.orders sale
  join public.wholesale_order_payment_openings opening on opening.sale_id = sale.id
  where sale.reference_code = '#M100'
    and sale.channel = 'Mayorista'
    and sale.sold_on >= '2026-10-01'::date
    and sale.sold_on < '2026-11-01'::date
    and sale.total_minor = 2538000
    and opening.collected_arg_minor = 0
    and opening.collected_minor = 0
    and not opening.paid_in_full_without_price
    and not opening.finance_paid_at_order
    and (select round(sum(item.total_arg) * 100)::bigint from public.order_items item
         where item.order_id = sale.id) = 84600000
    and (select sum(item.total_minor)::bigint from public.order_items item
         where item.order_id = sale.id) = 2538000
    and not exists (select 1 from public.order_items item
                    where item.order_id = sale.id and item.total_arg is null and not coalesce(item.no_cost, false))
    and not exists (select 1 from public.wholesale_order_receipts receipt where receipt.sale_id = sale.id)
    and not exists (select 1 from public.customer_account_allocations allocation where allocation.order_id = sale.id)
    and not exists (select 1 from public.wholesale_consignments consignment where consignment.order_id = sale.id);

  if v_matches <> 1 then
    raise exception 'M100 requiere revisión antes de registrar el pago histórico';
  end if;

  update public.wholesale_order_payment_openings
  set collected_arg_minor = 84600000,
      collected_minor = 2538000,
      finance_paid_at_order = true
  where sale_id = v_sale_id;

  get diagnostics v_updated = row_count;
  if v_updated <> 1 then
    raise exception 'No se actualizó el pago histórico de M100';
  end if;
end $$;
