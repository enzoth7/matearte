-- La moneda mayorista pactada es independiente del equivalente UYU de Finanzas.
alter table public.orders add column wholesale_currency text
  check (wholesale_currency in ('ARS', 'UYU'));
update public.orders set wholesale_currency = 'ARS'
  where channel = 'Mayorista' and wholesale_currency is null;

-- La reserva conserva la moneda entre la asignación del número y la inserción
-- de las líneas del pedido, que crea el pedido mediante order_lines.
create table private.wholesale_order_currency_reservations (
  reference_code text primary key,
  currency text not null check (currency in ('ARS', 'UYU')),
  created_at timestamptz not null default now()
);
revoke all on private.wholesale_order_currency_reservations from public, anon, authenticated;

create function public.gestion_next_wholesale_order_code(p_currency text)
returns text language plpgsql security definer set search_path = '' as $$
declare v_code text;
begin
  if p_currency not in ('ARS', 'UYU') or p_currency is null then
    raise exception 'Elegí ARS o UYU para el pedido mayorista' using errcode = '22023';
  end if;
  v_code := public.gestion_next_wholesale_order_code();
  insert into private.wholesale_order_currency_reservations(reference_code, currency)
    values (v_code, p_currency);
  return v_code;
end;
$$;

create function private.guard_wholesale_consignment_order_currency()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_currency text;
begin
  select wholesale_currency into v_currency from public.orders where id = new.order_id;
  if new.currency <> coalesce(v_currency, 'ARS') then
    raise exception 'La consignación debe conservar la moneda pactada del pedido' using errcode = '22023';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_wholesale_consignment_order_currency() from public, anon, authenticated;
create trigger wholesale_consignment_order_currency
  before insert on public.wholesale_consignments for each row
  execute function private.guard_wholesale_consignment_order_currency();

-- Los cobros UYU de pedidos mayoristas pactados en UYU usan los mismos
-- comprobantes, sin cotización ni conversión.
alter table public.wholesale_order_receipts
  drop constraint wholesale_order_receipts_currency_check;

create or replace function private.customer_account_direct_receipt_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_order public.orders%rowtype; v_total bigint; v_initial bigint; v_direct bigint; v_allocated bigint;
begin
  select * into v_order from public.orders where id = new.sale_id for update;
  if tg_table_name = 'wholesale_order_receipts' then
    if new.currency <> coalesce(v_order.wholesale_currency, 'ARS') then
      raise exception 'El cobro debe tener la moneda pactada del pedido' using errcode = '22023'; end if;
    if new.currency = 'ARS' then
      v_total := private.wholesale_arg_total_minor(new.sale_id);
      select collected_arg_minor into v_initial from public.wholesale_order_payment_openings where sale_id = new.sale_id;
    else
      select coalesce(sum(total_minor), 0) into v_total from public.order_items where order_id = new.sale_id;
      select collected_minor into v_initial from public.wholesale_order_payment_openings where sale_id = new.sale_id;
    end if;
    if not found then v_initial := 0; end if;
    select coalesce(sum(source_amount_minor), 0) into v_direct from public.wholesale_order_receipts where sale_id = new.sale_id;
    select coalesce(sum(case when new.currency = 'ARS' then source_amount_minor else amount_minor end), 0)
      into v_allocated from public.customer_account_allocations where order_id = new.sale_id;
    if v_total is null or v_initial is null then
      raise exception 'Primero conciliá el precio y los cobros anteriores del pedido' using errcode = '22023'; end if;
    if v_initial + v_direct + v_allocated + new.source_amount_minor > v_total then
      raise exception 'El cobro supera el saldo del pedido' using errcode = '22023'; end if;
  else
    select coalesce(sum(total_minor), 0) into v_total from public.order_items where order_id = new.sale_id;
    v_initial := v_order.total_minor;
    select coalesce(sum(amount_minor), 0) into v_direct from public.local_sale_receipts where sale_id = new.sale_id;
    select coalesce(sum(amount_minor), 0) into v_allocated from public.customer_account_allocations where order_id = new.sale_id;
    if v_initial + v_direct + round(v_allocated / coalesce(v_order.retail_rate_to_uyu, 1)) + new.amount_minor > v_total + v_order.retail_shipping_minor then
      raise exception 'El cobro supera el saldo pendiente del pedido' using errcode = '22023'; end if;
  end if;
  return new;
end;
$$;

create function public.gestion_record_wholesale_payment_uyu(
  p_receipt_id uuid, p_sale_id uuid, p_amount_minor bigint, p_payment_method text, p_paid_on date
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_order public.orders%rowtype; v_existing public.wholesale_order_receipts%rowtype;
begin
  perform private.require_internal_staff();
  select * into v_order from public.orders where id = p_sale_id and channel = 'Mayorista'
    and wholesale_currency = 'UYU' and status not in ('cancelled', 'refunded') for update;
  if not found or exists (select 1 from public.wholesale_consignments where order_id = p_sale_id) then
    raise exception 'El pedido no admite este cobro' using errcode = '22023'; end if;
  if p_amount_minor is null or p_amount_minor <= 0 or
    p_payment_method not in ('Efectivo', 'Débito', 'Crédito', 'Transferencia') or
    p_paid_on is null or p_paid_on > (now() at time zone 'America/Montevideo')::date then
    raise exception 'Revisá el importe UYU, el medio y la fecha' using errcode = '22023'; end if;
  select * into v_existing from public.wholesale_order_receipts where id = p_receipt_id;
  if found then
    if v_existing.sale_id = p_sale_id and v_existing.currency = 'UYU' and
      v_existing.source_amount_minor = p_amount_minor and v_existing.payment_method = p_payment_method and
      v_existing.paid_on = p_paid_on then return jsonb_build_object('id', p_receipt_id, 'sale_id', p_sale_id); end if;
    raise exception 'El identificador del cobro ya fue usado' using errcode = '23505';
  end if;
  insert into public.wholesale_order_receipts
    (id, sale_id, amount_minor, source_amount_minor, currency, uyu_per_ars, payment_method, paid_on, created_by)
  values (p_receipt_id, p_sale_id, p_amount_minor, p_amount_minor, 'UYU', null,
    p_payment_method, p_paid_on, auth.uid());
  return jsonb_build_object('id', p_receipt_id, 'sale_id', p_sale_id);
end;
$$;
revoke all on function public.gestion_record_wholesale_payment_uyu(uuid,uuid,bigint,text,date) from public, anon;
grant execute on function public.gestion_record_wholesale_payment_uyu(uuid,uuid,bigint,text,date) to authenticated;
revoke all on function public.gestion_next_wholesale_order_code(text) from public, anon;
grant execute on function public.gestion_next_wholesale_order_code(text) to authenticated;

create or replace function private.wholesale_order_for(
  p_code text, p_customer text, p_sale_channel text, p_created_at timestamptz
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_order uuid; v_currency text;
begin
  if nullif(btrim(p_code), '') is null then raise exception 'Falta el número de pedido' using errcode = '22023'; end if;
  select id into v_order from public.orders where reference_code = p_code and channel = 'Mayorista' for update;
  if v_order is null then
    select currency into v_currency from private.wholesale_order_currency_reservations where reference_code = p_code;
    insert into public.orders (status, items_subtotal_minor, total_minor, shipping_method, customer_snapshot,
      reference_code, channel, customer_name, contact_id, sold_on, created_at, wholesale_currency)
    values ('internal_open', 0, 0, 'pickup', jsonb_build_object('purchaseFlow', 'internal', 'saleChannel', coalesce(p_sale_channel, 'WhatsApp')),
      p_code, 'Mayorista', p_customer, (select id from public.contacts where wholesale_name = p_customer),
      coalesce(p_created_at, now())::date, coalesce(p_created_at, now()), coalesce(v_currency, 'ARS'))
    returning id into v_order;
    delete from private.wholesale_order_currency_reservations where reference_code = p_code;
  end if;
  return v_order;
end;
$$;

-- #M113 fue creado en ARS, pero quedó vinculado en UYU por el valor inicial
-- del formulario. Solo se corrige si no se registraron ventas ni cobros.
do $$
declare v_id uuid; v_rate numeric;
begin
  select c.id into v_id from public.wholesale_consignments c join public.orders o on o.id = c.order_id
    where o.reference_code = '#M113' and c.currency = 'UYU';
  if v_id is null then return; end if;
  if exists (select 1 from public.wholesale_consignment_movements m
      join public.wholesale_consignment_lines l on l.id = m.line_id
      where l.consignment_id = v_id and m.kind = 'kept')
    or exists (select 1 from public.wholesale_consignment_allocations where consignment_id = v_id)
    or exists (select 1 from public.customer_account_receipts where consignment_id = v_id) then
    raise exception 'La consignación #M113 ya tiene ventas o cobros; no se cambia su moneda automáticamente';
  end if;
  select min(i.total_minor::numeric / (i.total_arg * 100)) into v_rate
    from public.wholesale_consignment_lines l join public.order_items i on i.id = l.order_item_id
    where l.consignment_id = v_id and i.total_arg > 0;
  if v_rate is null or v_rate <= 0 or exists (
    select 1 from public.wholesale_consignment_lines l join public.order_items i on i.id = l.order_item_id
    where l.consignment_id = v_id and (i.total_arg is null or i.total_arg < 0
      or i.total_arg * 100 / i.quantity <> trunc(i.total_arg * 100 / i.quantity)
      or (i.total_arg > 0 and i.total_minor::numeric / (i.total_arg * 100) <> v_rate))
  ) then raise exception 'Los precios de #M113 no permiten conciliar ARS'; end if;
  update public.wholesale_consignments set currency = 'ARS', exchange_rate = v_rate where id = v_id;
  update public.wholesale_consignment_lines l set unit_price_minor = (i.total_arg * 100 / i.quantity)::bigint
    from public.order_items i where l.order_item_id = i.id and l.consignment_id = v_id;
end;
$$;
