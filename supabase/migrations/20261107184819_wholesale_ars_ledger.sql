-- ARS es la moneda operativa mayorista. Los importes UYU existentes se
-- conservan como equivalentes para finanzas y no se reescriben cobros previos.
alter table public.wholesale_order_payment_openings
  add column collected_arg_minor bigint check (collected_arg_minor is null or collected_arg_minor >= 0);
update public.wholesale_order_payment_openings
  set collected_arg_minor = 0 where collected_minor = 0;

alter table public.customer_account_allocations
  add column source_amount_minor bigint check (source_amount_minor is null or source_amount_minor > 0);
update public.customer_account_allocations
  set source_amount_minor = amount_minor
  where receipt_id in (select id from public.customer_account_receipts where currency = 'UYU');

do $$
begin
  if exists (select 1 from public.wholesale_order_receipts where currency <> 'ARS') then
    raise exception 'Hay cobros mayoristas en UYU que necesitan conciliación antes de activar saldos ARS';
  end if;
  if exists (
    select 1 from public.customer_account_allocations a
    join public.customer_account_receipts r on r.id = a.receipt_id
    where r.currency = 'ARS' and a.source_amount_minor is null
  ) then
    raise exception 'Hay entregas ARS ya asignadas que necesitan conciliación antes de activar saldos ARS';
  end if;
end;
$$;

alter table public.wholesale_order_receipts
  drop constraint if exists wholesale_order_receipts_currency_check;
alter table public.wholesale_order_receipts
  add constraint wholesale_order_receipts_currency_check check (currency = 'ARS') not valid;

create or replace function private.wholesale_arg_total_minor(p_order_id uuid)
returns bigint language plpgsql stable security definer set search_path = '' as $$
declare v_total numeric; v_missing boolean;
begin
  select coalesce(sum(coalesce(i.total_arg, 0)), 0),
    count(*) = 0 or bool_or(i.total_arg is null and not coalesce(i.no_cost, false))
    into v_total, v_missing
  from public.order_items i where i.order_id = p_order_id;
  if v_missing then return null; end if;
  return round(v_total * 100)::bigint;
end;
$$;
revoke all on function private.wholesale_arg_total_minor(uuid) from public, anon, authenticated;

create or replace function private.wholesale_arg_collected_minor(p_order_id uuid)
returns bigint language plpgsql stable security definer set search_path = '' as $$
declare v_opening bigint;
begin
  select collected_arg_minor into v_opening from public.wholesale_order_payment_openings where sale_id = p_order_id;
  if found and v_opening is null then return null; end if;
  return coalesce(v_opening, 0)
    + coalesce((select sum(source_amount_minor) from public.wholesale_order_receipts where sale_id = p_order_id), 0)
    + coalesce((select sum(source_amount_minor) from public.customer_account_allocations where order_id = p_order_id), 0);
end;
$$;
revoke all on function private.wholesale_arg_collected_minor(uuid) from public, anon, authenticated;

create or replace function private.assert_wholesale_arg_balance(p_order_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_total bigint; v_collected bigint;
begin
  if not exists (select 1 from public.orders where id = p_order_id and channel = 'Mayorista') then return; end if;
  v_total := private.wholesale_arg_total_minor(p_order_id);
  v_collected := private.wholesale_arg_collected_minor(p_order_id);
  if v_total is null and coalesce(v_collected, 0) > 0 then
    raise exception 'Primero conciliá el precio original ARS del pedido' using errcode = '22023';
  end if;
  if v_total is not null and v_collected is not null and v_collected > v_total then
    raise exception 'El nuevo total ARS no puede ser menor que los cobros confirmados' using errcode = '22023';
  end if;
end;
$$;
revoke all on function private.assert_wholesale_arg_balance(uuid) from public, anon, authenticated;

create or replace function private.wholesale_collected_must_fit_total()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.channel = 'Mayorista' then perform private.assert_wholesale_arg_balance(new.id); end if;
  return new;
end;
$$;

create function private.wholesale_item_arg_balance_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    perform private.assert_wholesale_arg_balance(new.order_id);
  elsif tg_op = 'DELETE' then
    perform private.assert_wholesale_arg_balance(old.order_id);
  else
    perform private.assert_wholesale_arg_balance(old.order_id);
    if new.order_id is distinct from old.order_id then
      perform private.assert_wholesale_arg_balance(new.order_id);
    end if;
  end if;
  return null;
end;
$$;
revoke all on function private.wholesale_item_arg_balance_guard() from public, anon, authenticated;
create trigger wholesale_item_arg_balance_guard
after insert or update of total_arg, order_id or delete on public.order_items
for each row execute function private.wholesale_item_arg_balance_guard();

drop function public.gestion_record_wholesale_payment(uuid,uuid,bigint,text,numeric,text,date,bigint);
create function public.gestion_record_wholesale_payment(
  p_receipt_id uuid, p_sale_id uuid, p_source_amount_minor bigint,
  p_currency text, p_uyu_per_ars numeric, p_payment_method text,
  p_paid_on date, p_opening_collected_arg_minor bigint default null
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_order public.orders%rowtype;
  v_opening public.wholesale_order_payment_openings%rowtype;
  v_existing public.wholesale_order_receipts%rowtype;
  v_total_arg bigint; v_order_uyu numeric; v_opening_arg bigint;
  v_receipts_arg bigint; v_allocations_arg bigint; v_uyu_minor bigint;
begin
  perform private.require_internal_staff();
  select * into v_order from public.orders where id = p_sale_id and channel = 'Mayorista'
    and currency = 'UYU' and status not in ('cancelled', 'refunded') for update;
  if not found then raise exception 'El pedido mayorista no existe o no admite cobros' using errcode = '22023'; end if;
  v_total_arg := private.wholesale_arg_total_minor(p_sale_id);
  if v_total_arg is null then
    raise exception 'Primero conciliá el precio original ARS del pedido' using errcode = '22023';
  end if;
  if p_currency is distinct from 'ARS' or p_source_amount_minor is null or p_source_amount_minor < 0
    or p_uyu_per_ars is null or p_uyu_per_ars <= 0
    or (p_source_amount_minor > 0 and p_payment_method not in ('Efectivo', 'Débito', 'Crédito', 'Transferencia'))
    or (p_source_amount_minor > 0 and p_paid_on is null)
    or (p_paid_on is not null and p_paid_on > (now() at time zone 'America/Montevideo')::date) then
    raise exception 'Revisá el importe ARS, la cotización, el medio y la fecha' using errcode = '22023';
  end if;
  v_uyu_minor := round(p_source_amount_minor * p_uyu_per_ars)::bigint;
  if p_source_amount_minor > 0 and v_uyu_minor <= 0 then
    raise exception 'El equivalente UYU debe ser mayor que cero' using errcode = '22023';
  end if;
  select * into v_existing from public.wholesale_order_receipts where id = p_receipt_id;
  if found then
    if v_existing.sale_id = p_sale_id and v_existing.source_amount_minor = p_source_amount_minor
      and v_existing.currency = 'ARS' and v_existing.uyu_per_ars = p_uyu_per_ars
      and v_existing.payment_method = p_payment_method and v_existing.paid_on = p_paid_on then
      return jsonb_build_object('id', v_existing.id, 'sale_id', v_existing.sale_id, 'amount_minor', v_existing.amount_minor);
    end if;
    raise exception 'El identificador del cobro ya fue usado' using errcode = '23505';
  end if;
  select * into v_opening from public.wholesale_order_payment_openings where sale_id = p_sale_id for update;
  if found and v_opening.collected_minor is null then
    if p_opening_collected_arg_minor is null or p_opening_collected_arg_minor < 0 then
      raise exception 'Confirmá el cobro anterior en ARS, incluso si es cero' using errcode = '22023';
    end if;
    v_opening_arg := p_opening_collected_arg_minor;
    select coalesce(sum((i.immutable_snapshot ->> 'totalUyu')::numeric), 0)
      into v_order_uyu from public.order_items i where i.order_id = p_sale_id;
    update public.wholesale_order_payment_openings
      set collected_arg_minor = v_opening_arg,
        collected_minor = case when v_total_arg > 0 then round(v_opening_arg * v_order_uyu * 100 / v_total_arg)::bigint else 0 end,
        confirmed_at = now(), confirmed_by = auth.uid()
      where sale_id = p_sale_id;
  elsif found and v_opening.collected_arg_minor is null then
    if p_opening_collected_arg_minor is null or p_opening_collected_arg_minor < 0 then
      raise exception 'Confirmá el cobro anterior en ARS' using errcode = '22023';
    end if;
    v_opening_arg := p_opening_collected_arg_minor;
    update public.wholesale_order_payment_openings
      set collected_arg_minor = v_opening_arg,
        confirmed_at = coalesce(confirmed_at, now()), confirmed_by = coalesce(confirmed_by, auth.uid())
      where sale_id = p_sale_id;
  else
    v_opening_arg := coalesce(v_opening.collected_arg_minor, 0);
    if p_opening_collected_arg_minor is not null and p_opening_collected_arg_minor <> v_opening_arg then
      raise exception 'El cobro anterior ya se confirmó con otro importe' using errcode = '22023';
    end if;
  end if;
  select coalesce(sum(source_amount_minor), 0) into v_receipts_arg
    from public.wholesale_order_receipts where sale_id = p_sale_id;
  select coalesce(sum(source_amount_minor), 0) into v_allocations_arg
    from public.customer_account_allocations where order_id = p_sale_id;
  if v_opening_arg + v_receipts_arg + v_allocations_arg + p_source_amount_minor > v_total_arg then
    raise exception 'El cobro ARS supera el saldo pendiente' using errcode = '22023';
  end if;
  if p_source_amount_minor = 0 then
    if p_opening_collected_arg_minor is null then raise exception 'El cobro debe ser mayor que cero' using errcode = '22023'; end if;
    return jsonb_build_object('sale_id', p_sale_id, 'opening_collected_arg_minor', v_opening_arg);
  end if;
  insert into public.wholesale_order_receipts
    (id, sale_id, amount_minor, source_amount_minor, currency, uyu_per_ars, payment_method, paid_on, created_by)
  values (p_receipt_id, p_sale_id, v_uyu_minor, p_source_amount_minor, 'ARS', p_uyu_per_ars,
    p_payment_method, p_paid_on, auth.uid());
  return jsonb_build_object('id', p_receipt_id, 'sale_id', p_sale_id, 'amount_minor', v_uyu_minor);
end;
$$;
revoke all on function public.gestion_record_wholesale_payment(uuid,uuid,bigint,text,numeric,text,date,bigint) from public, anon;
grant execute on function public.gestion_record_wholesale_payment(uuid,uuid,bigint,text,numeric,text,date,bigint) to authenticated;

drop function public.gestion_allocate_customer_account_receipt(uuid,uuid,uuid,bigint);
create function public.gestion_allocate_customer_account_receipt(
  p_allocation_id uuid, p_receipt_id uuid, p_order_id uuid, p_source_amount_minor bigint
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_receipt public.customer_account_receipts%rowtype;
  v_order public.orders%rowtype;
  v_existing public.customer_account_allocations%rowtype;
  v_available_source bigint; v_available_uyu bigint; v_amount_uyu bigint;
  v_total bigint; v_initial bigint; v_direct bigint; v_allocated bigint;
begin
  perform private.require_internal_staff();
  if p_allocation_id is null or p_receipt_id is null or p_order_id is null
    or p_source_amount_minor is null or p_source_amount_minor <= 0 then
    raise exception 'La asignación debe tener un importe positivo' using errcode = '22023';
  end if;
  select * into v_receipt from public.customer_account_receipts where id = p_receipt_id for update;
  select * into v_order from public.orders where id = p_order_id for update;
  if v_receipt.id is null or v_order.id is null or v_receipt.contact_id is distinct from v_order.contact_id
    or v_order.status in ('cancelled', 'refunded')
    or (v_order.channel = 'Mayorista' and v_receipt.currency <> 'ARS')
    or (v_order.channel <> 'Mayorista' and v_receipt.currency <> 'UYU') then
    raise exception 'La entrega y el pedido deben pertenecer a la misma cuenta y moneda' using errcode = '22023';
  end if;
  select * into v_existing from public.customer_account_allocations where id = p_allocation_id;
  if found then
    if v_existing.receipt_id = p_receipt_id and v_existing.order_id = p_order_id
      and v_existing.source_amount_minor = p_source_amount_minor then
      return jsonb_build_object('id', v_existing.id, 'amount_minor', v_existing.amount_minor);
    end if;
    raise exception 'El identificador de la asignación ya se usó' using errcode = '23505';
  end if;
  select v_receipt.source_amount_minor - coalesce(sum(source_amount_minor), 0),
    v_receipt.amount_minor - coalesce(sum(amount_minor), 0)
    into v_available_source, v_available_uyu
  from public.customer_account_allocations where receipt_id = p_receipt_id;
  if p_source_amount_minor > v_available_source then
    raise exception 'La entrega no tiene ese saldo a favor' using errcode = '22023';
  end if;
  v_amount_uyu := case when p_source_amount_minor = v_available_source then v_available_uyu
    when v_receipt.currency = 'ARS' then round(p_source_amount_minor * v_receipt.uyu_per_ars)::bigint
    else p_source_amount_minor end;
  if v_amount_uyu <= 0 or v_amount_uyu > v_available_uyu then
    raise exception 'El equivalente UYU de la entrega no es válido' using errcode = '22023';
  end if;
  if v_order.channel = 'Mayorista' then
    v_total := private.wholesale_arg_total_minor(p_order_id);
    select collected_arg_minor into v_initial from public.wholesale_order_payment_openings where sale_id = p_order_id;
    if not found then v_initial := 0; end if;
    if v_total is null or v_initial is null then
      raise exception 'Primero conciliá el precio y los cobros anteriores del pedido' using errcode = '22023';
    end if;
    select coalesce(sum(source_amount_minor), 0) into v_direct from public.wholesale_order_receipts where sale_id = p_order_id;
    select coalesce(sum(source_amount_minor), 0) into v_allocated from public.customer_account_allocations where order_id = p_order_id;
  else
    if v_order.status <> 'internal_completed' then raise exception 'La venta no admite cobros' using errcode = '22023'; end if;
    select coalesce(sum(total_minor), 0) into v_total from public.order_items where order_id = p_order_id;
    v_initial := v_order.total_minor;
    select coalesce(sum(amount_minor), 0) into v_direct from public.local_sale_receipts where sale_id = p_order_id;
    select coalesce(sum(amount_minor), 0) into v_allocated from public.customer_account_allocations where order_id = p_order_id;
  end if;
  if p_source_amount_minor > v_total - v_initial - v_direct - v_allocated then
    raise exception 'La asignación supera el saldo del pedido' using errcode = '22023';
  end if;
  insert into public.customer_account_allocations
    (id, receipt_id, order_id, amount_minor, source_amount_minor, created_by)
  values (p_allocation_id, p_receipt_id, p_order_id, v_amount_uyu, p_source_amount_minor, auth.uid());
  return jsonb_build_object('id', p_allocation_id, 'amount_minor', v_amount_uyu);
end;
$$;
revoke all on function public.gestion_allocate_customer_account_receipt(uuid,uuid,uuid,bigint) from public, anon;
grant execute on function public.gestion_allocate_customer_account_receipt(uuid,uuid,uuid,bigint) to authenticated;

create or replace function private.customer_account_direct_receipt_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_order public.orders%rowtype; v_total bigint; v_initial bigint; v_direct bigint; v_allocated bigint;
begin
  select * into v_order from public.orders where id = new.sale_id for update;
  if tg_table_name = 'wholesale_order_receipts' then
    if new.currency <> 'ARS' then raise exception 'Los cobros mayoristas se registran en ARS' using errcode = '22023'; end if;
    v_total := private.wholesale_arg_total_minor(new.sale_id);
    select collected_arg_minor into v_initial from public.wholesale_order_payment_openings where sale_id = new.sale_id;
    if not found then v_initial := 0; end if;
    select coalesce(sum(source_amount_minor), 0) into v_direct from public.wholesale_order_receipts where sale_id = new.sale_id;
    select coalesce(sum(source_amount_minor), 0) into v_allocated from public.customer_account_allocations where order_id = new.sale_id;
    if v_total is null or v_initial is null then
      raise exception 'Primero conciliá el precio y los cobros anteriores del pedido' using errcode = '22023';
    end if;
    if v_initial + v_direct + v_allocated + new.source_amount_minor > v_total then
      raise exception 'El cobro supera el saldo ARS del pedido' using errcode = '22023';
    end if;
  else
    select coalesce(sum(total_minor), 0) into v_total from public.order_items where order_id = new.sale_id;
    v_initial := v_order.total_minor;
    select coalesce(sum(amount_minor), 0) into v_direct from public.local_sale_receipts where sale_id = new.sale_id;
    select coalesce(sum(amount_minor), 0) into v_allocated from public.customer_account_allocations where order_id = new.sale_id;
    if v_initial + v_direct + v_allocated + new.amount_minor > v_total then
      raise exception 'El cobro supera el saldo pendiente del pedido' using errcode = '22023';
    end if;
  end if;
  return new;
end;
$$;
