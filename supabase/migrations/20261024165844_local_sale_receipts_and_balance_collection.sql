-- Later collections belong to the original local sale. They have their own
-- dates and payment methods so cash flow does not count the merchandise twice.
create table public.local_sale_receipts (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.orders(id) on delete cascade,
  amount_minor bigint not null check (amount_minor > 0),
  payment_method text not null check (payment_method in ('Efectivo', 'Débito', 'Crédito', 'Transferencia')),
  paid_on date not null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create index local_sale_receipts_sale_id_idx on public.local_sale_receipts(sale_id);
alter table public.local_sale_receipts enable row level security;
create policy local_sale_receipts_staff_read on public.local_sale_receipts
  for select to authenticated
  using ((select auth.uid()) is not null
    and ((select private.is_pricing_admin()) or (select private.is_commerce_admin()))
    and exists (select 1 from public.orders o where o.id = sale_id
      and o.channel in ('Local', 'Feria', 'WhatsApp', 'Instagram', 'Facebook')));
revoke all on public.local_sale_receipts from public, anon, authenticated;
grant select on public.local_sale_receipts to authenticated;
grant all on public.local_sale_receipts to service_role;

create function public.gestion_record_local_sale_payment(
  p_receipt_id uuid,
  p_sale_id uuid,
  p_amount_minor bigint,
  p_payment_method text,
  p_paid_on date
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_existing public.local_sale_receipts%rowtype;
  v_items_total bigint;
  v_later_paid bigint;
begin
  perform private.require_internal_staff();
  if p_receipt_id is null then raise exception 'Falta el identificador del cobro' using errcode = '22023'; end if;
  select * into v_order from public.orders
    where id = p_sale_id
      and channel in ('Local', 'Feria', 'WhatsApp', 'Instagram', 'Facebook')
      and status = 'internal_completed'
      and currency = 'UYU'
    for update;
  if not found then raise exception 'La venta no existe o no admite cobros' using errcode = '22023'; end if;

  -- The same request can be safely retried after an uncertain network result.
  select * into v_existing from public.local_sale_receipts where id = p_receipt_id;
  if found then
    if v_existing.sale_id <> p_sale_id or v_existing.amount_minor <> p_amount_minor
      or v_existing.payment_method <> p_payment_method or v_existing.paid_on <> p_paid_on then
      raise exception 'El identificador del cobro ya fue usado' using errcode = '23505';
    end if;
    return jsonb_build_object('id', v_existing.id, 'sale_id', v_existing.sale_id,
      'amount_minor', v_existing.amount_minor, 'payment_method', v_existing.payment_method,
      'paid_on', v_existing.paid_on);
  end if;

  if p_payment_method is null or p_payment_method not in ('Efectivo', 'Débito', 'Crédito', 'Transferencia') then
    raise exception 'El medio de pago no es válido' using errcode = '22023';
  end if;
  if p_paid_on is null or p_paid_on < v_order.sold_on
    or p_paid_on > (now() at time zone 'America/Montevideo')::date then
    raise exception 'La fecha del cobro no es válida' using errcode = '22023';
  end if;
  if p_amount_minor is null or p_amount_minor <= 0 then
    raise exception 'El importe debe ser mayor que cero' using errcode = '22023';
  end if;

  select coalesce(sum(total_minor), 0) into v_items_total
    from public.order_items where order_id = p_sale_id;
  select coalesce(sum(amount_minor), 0) into v_later_paid
    from public.local_sale_receipts where sale_id = p_sale_id;
  if p_amount_minor > v_items_total - v_order.total_minor - v_later_paid then
    raise exception 'El cobro supera el saldo pendiente' using errcode = '22023';
  end if;

  insert into public.local_sale_receipts(id, sale_id, amount_minor, payment_method, paid_on, created_by)
    values (p_receipt_id, p_sale_id, p_amount_minor, p_payment_method, p_paid_on, auth.uid());
  return jsonb_build_object('id', p_receipt_id, 'sale_id', p_sale_id,
    'amount_minor', p_amount_minor, 'payment_method', p_payment_method, 'paid_on', p_paid_on);
end;
$$;
revoke all on function public.gestion_record_local_sale_payment(uuid,uuid,bigint,text,date) from public, anon;
grant execute on function public.gestion_record_local_sale_payment(uuid,uuid,bigint,text,date) to authenticated;

-- Editing the sale must not leave previously registered collections above its
-- new merchandise value. Preserve the existing authorization and validations.
do $$
declare
  definition text := pg_get_functiondef('public.gestion_update_local_sale(uuid,uuid,date,text,bigint,jsonb)'::regprocedure);
  anchor text := '  if p_customer_id is not null then';
  replacement text := '  if v_charged + coalesce((select sum(amount_minor) from public.local_sale_receipts where sale_id = p_sale_id), 0) > v_items_total then raise exception ''Los cobros registrados superan el nuevo total de artículos'' using errcode = ''22023''; end if;' || E'\n\n' || '  if p_customer_id is not null then';
  occurrences integer;
begin
  occurrences := (length(definition) - length(replace(definition, anchor, ''))) / length(anchor);
  if occurrences <> 1 then raise exception 'Unexpected local sale update function: % occurrences', occurrences; end if;
  execute replace(definition, anchor, replacement);
end;
$$;
