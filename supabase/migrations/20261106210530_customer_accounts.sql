-- Una entrega a cuenta es dinero recibido una sola vez, aunque después se
-- aplique a varios pedidos. La asignación no crea un nuevo ingreso.
create table public.customer_account_receipts (
  id uuid primary key,
  contact_id uuid not null references public.contacts(id),
  amount_minor bigint not null check (amount_minor > 0),
  source_amount_minor bigint not null check (source_amount_minor > 0),
  currency text not null check (currency in ('UYU', 'ARS')),
  uyu_per_ars numeric check (uyu_per_ars is null or uyu_per_ars > 0),
  payment_method text not null check (payment_method in ('Efectivo', 'Débito', 'Crédito', 'Transferencia')),
  paid_on date not null,
  note text check (note is null or char_length(note) <= 500),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  check ((currency = 'UYU' and uyu_per_ars is null and source_amount_minor = amount_minor)
    or (currency = 'ARS' and uyu_per_ars is not null))
);
create index customer_account_receipts_contact_idx on public.customer_account_receipts(contact_id, paid_on desc);

create table public.customer_account_allocations (
  id uuid primary key,
  receipt_id uuid not null references public.customer_account_receipts(id),
  order_id uuid not null references public.orders(id),
  amount_minor bigint not null check (amount_minor > 0),
  allocated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);
create index customer_account_allocations_receipt_idx on public.customer_account_allocations(receipt_id);
create index customer_account_allocations_order_idx on public.customer_account_allocations(order_id);

alter table public.customer_account_receipts enable row level security;
alter table public.customer_account_allocations enable row level security;
revoke all on public.customer_account_receipts, public.customer_account_allocations from public, anon, authenticated;
grant select on public.customer_account_receipts, public.customer_account_allocations to authenticated;
grant all on public.customer_account_receipts, public.customer_account_allocations to service_role;
create policy customer_account_receipts_staff_read on public.customer_account_receipts
  for select to authenticated using ((select auth.uid()) is not null
    and ((select private.is_pricing_admin()) or (select private.is_commerce_admin())));
create policy customer_account_allocations_staff_read on public.customer_account_allocations
  for select to authenticated using ((select auth.uid()) is not null
    and ((select private.is_pricing_admin()) or (select private.is_commerce_admin())));

create function public.gestion_record_customer_account_receipt(
  p_receipt_id uuid, p_contact_id uuid, p_source_amount_minor bigint,
  p_currency text, p_uyu_per_ars numeric, p_payment_method text,
  p_paid_on date, p_note text default null
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_existing public.customer_account_receipts%rowtype;
  v_amount_minor bigint;
begin
  perform private.require_internal_staff();
  if p_receipt_id is null or p_contact_id is null or p_source_amount_minor is null or p_source_amount_minor <= 0
    or p_currency is null or p_currency not in ('UYU', 'ARS')
    or p_payment_method is null or p_payment_method not in ('Efectivo', 'Débito', 'Crédito', 'Transferencia')
    or p_paid_on is null or p_paid_on > (now() at time zone 'America/Montevideo')::date
    or char_length(coalesce(p_note, '')) > 500 then
    raise exception 'Revisá los datos de la entrega' using errcode = '22023';
  end if;
  if (p_currency = 'UYU' and p_uyu_per_ars is not null)
    or (p_currency = 'ARS' and (p_uyu_per_ars is null or p_uyu_per_ars <= 0)) then
    raise exception 'Revisá la cotización de la entrega' using errcode = '22023';
  end if;
  if not exists (select 1 from public.contacts where id = p_contact_id) then
    raise exception 'El cliente no existe' using errcode = '22023';
  end if;
  v_amount_minor := case when p_currency = 'ARS' then round(p_source_amount_minor * p_uyu_per_ars)::bigint else p_source_amount_minor end;
  if v_amount_minor <= 0 then raise exception 'El equivalente en UYU debe ser mayor que cero' using errcode = '22023'; end if;
  select * into v_existing from public.customer_account_receipts where id = p_receipt_id;
  if found then
    if v_existing.contact_id = p_contact_id and v_existing.source_amount_minor = p_source_amount_minor
      and v_existing.currency = p_currency and v_existing.uyu_per_ars is not distinct from p_uyu_per_ars
      and v_existing.payment_method = p_payment_method and v_existing.paid_on = p_paid_on
      and v_existing.note is not distinct from nullif(btrim(p_note), '') then
      return jsonb_build_object('id', v_existing.id, 'amount_minor', v_existing.amount_minor);
    end if;
    raise exception 'El identificador de la entrega ya fue usado' using errcode = '23505';
  end if;
  insert into public.customer_account_receipts
    (id, contact_id, amount_minor, source_amount_minor, currency, uyu_per_ars, payment_method, paid_on, note, created_by)
  values (p_receipt_id, p_contact_id, v_amount_minor, p_source_amount_minor, p_currency,
    p_uyu_per_ars, p_payment_method, p_paid_on, nullif(btrim(p_note), ''), auth.uid());
  return jsonb_build_object('id', p_receipt_id, 'amount_minor', v_amount_minor);
end;
$$;
revoke all on function public.gestion_record_customer_account_receipt(uuid,uuid,bigint,text,numeric,text,date,text) from public, anon;
grant execute on function public.gestion_record_customer_account_receipt(uuid,uuid,bigint,text,numeric,text,date,text) to authenticated;

create function public.gestion_allocate_customer_account_receipt(
  p_allocation_id uuid, p_receipt_id uuid, p_order_id uuid, p_amount_minor bigint
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_order public.orders%rowtype;
  v_receipt public.customer_account_receipts%rowtype;
  v_existing public.customer_account_allocations%rowtype;
  v_available bigint;
  v_total bigint;
  v_initial bigint;
  v_direct bigint;
  v_allocated bigint;
  v_opening bigint;
begin
  perform private.require_internal_staff();
  if p_allocation_id is null or p_receipt_id is null or p_order_id is null
    or p_amount_minor is null or p_amount_minor <= 0 then
    raise exception 'La asignación debe tener un importe positivo' using errcode = '22023';
  end if;
  select * into v_order from public.orders where id = p_order_id
    and channel in ('Mayorista', 'Local', 'Feria', 'WhatsApp', 'Instagram', 'Facebook')
    and status not in ('cancelled', 'refunded', 'payment_failed') for update;
  if not found then raise exception 'El pedido no admite cobros' using errcode = '22023'; end if;
  select * into v_receipt from public.customer_account_receipts where id = p_receipt_id for update;
  if not found or v_order.contact_id is distinct from v_receipt.contact_id then
    raise exception 'La entrega y el pedido deben pertenecer al mismo cliente' using errcode = '22023';
  end if;
  select * into v_existing from public.customer_account_allocations where id = p_allocation_id;
  if found then
    if v_existing.receipt_id = p_receipt_id and v_existing.order_id = p_order_id
      and v_existing.amount_minor = p_amount_minor then
      return jsonb_build_object('id', v_existing.id, 'amount_minor', v_existing.amount_minor);
    end if;
    raise exception 'El identificador de la asignación ya fue usado' using errcode = '23505';
  end if;
  select coalesce(sum(amount_minor), 0) into v_allocated
    from public.customer_account_allocations where receipt_id = p_receipt_id;
  v_available := v_receipt.amount_minor - v_allocated;
  if p_amount_minor > v_available then raise exception 'La entrega no tiene ese saldo a favor' using errcode = '22023'; end if;

  if v_order.channel = 'Mayorista' then
    v_total := v_order.total_minor;
    select collected_minor into v_opening from public.wholesale_order_payment_openings where sale_id = p_order_id;
    if found and v_opening is null then
      raise exception 'Primero conciliá los cobros anteriores del pedido' using errcode = '22023';
    end if;
    v_initial := coalesce(v_opening, 0);
    select coalesce(sum(amount_minor), 0) into v_direct from public.wholesale_order_receipts where sale_id = p_order_id;
  else
    if v_order.status <> 'internal_completed' then raise exception 'La venta no admite cobros' using errcode = '22023'; end if;
    select coalesce(sum(total_minor), 0) into v_total from public.order_items where order_id = p_order_id;
    v_initial := v_order.total_minor;
    select coalesce(sum(amount_minor), 0) into v_direct from public.local_sale_receipts where sale_id = p_order_id;
  end if;
  select coalesce(sum(amount_minor), 0) into v_allocated from public.customer_account_allocations where order_id = p_order_id;
  if p_amount_minor > v_total - v_initial - v_direct - v_allocated then
    raise exception 'La asignación supera el saldo del pedido' using errcode = '22023';
  end if;
  insert into public.customer_account_allocations(id, receipt_id, order_id, amount_minor, created_by)
    values (p_allocation_id, p_receipt_id, p_order_id, p_amount_minor, auth.uid());
  return jsonb_build_object('id', p_allocation_id, 'amount_minor', p_amount_minor);
end;
$$;
revoke all on function public.gestion_allocate_customer_account_receipt(uuid,uuid,uuid,bigint) from public, anon;
grant execute on function public.gestion_allocate_customer_account_receipt(uuid,uuid,uuid,bigint) to authenticated;

-- Un cobro directo posterior no puede pasar por alto lo ya asignado desde la cuenta.
create function private.customer_account_direct_receipt_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_order public.orders%rowtype;
  v_total bigint;
  v_initial bigint;
  v_direct bigint;
  v_allocated bigint;
begin
  select * into v_order from public.orders where id = new.sale_id for update;
  if tg_table_name = 'wholesale_order_receipts' then
    v_total := v_order.total_minor;
    select coalesce(collected_minor, 0) into v_initial from public.wholesale_order_payment_openings where sale_id = new.sale_id;
    v_initial := coalesce(v_initial, 0);
    select coalesce(sum(amount_minor), 0) into v_direct from public.wholesale_order_receipts where sale_id = new.sale_id;
  else
    select coalesce(sum(total_minor), 0) into v_total from public.order_items where order_id = new.sale_id;
    v_initial := v_order.total_minor;
    select coalesce(sum(amount_minor), 0) into v_direct from public.local_sale_receipts where sale_id = new.sale_id;
  end if;
  select coalesce(sum(amount_minor), 0) into v_allocated from public.customer_account_allocations where order_id = new.sale_id;
  if v_initial + v_direct + v_allocated + new.amount_minor > v_total then
    raise exception 'El cobro supera el saldo pendiente del pedido' using errcode = '22023';
  end if;
  return new;
end;
$$;
revoke all on function private.customer_account_direct_receipt_guard() from public, anon, authenticated;
create trigger local_sale_receipt_account_guard before insert on public.local_sale_receipts
  for each row execute function private.customer_account_direct_receipt_guard();
create trigger wholesale_receipt_account_guard before insert on public.wholesale_order_receipts
  for each row execute function private.customer_account_direct_receipt_guard();

create function private.customer_account_order_contact_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.contact_id is distinct from old.contact_id
    and exists (select 1 from public.customer_account_allocations where order_id = old.id) then
    raise exception 'Primero revisá las entregas a cuenta asignadas a este pedido' using errcode = '22023';
  end if;
  return new;
end;
$$;
revoke all on function private.customer_account_order_contact_guard() from public, anon, authenticated;
create trigger orders_customer_account_contact_guard before update of contact_id on public.orders
  for each row execute function private.customer_account_order_contact_guard();

-- Los fiados usan la venta local normal, con cobro inicial cero y cliente obligatorio.
do $$
declare
  v_create text;
  v_local_write text;
  v_update text;
  v_wholesale_guard text;
  v_old text;
begin
  v_create := pg_get_functiondef('public.gestion_create_local_sale_with_items(uuid,date,text,jsonb,bigint,text)'::regprocedure);
  v_old := 'if p_payment_method not in (''Efectivo'', ''Débito'', ''Crédito'', ''Transferencia'', ''Seña'') then';
  if position(v_old in v_create) = 0 then raise exception 'Cambió la validación de venta local'; end if;
  v_create := replace(v_create, v_old,
    'if p_payment_method not in (''Efectivo'', ''Débito'', ''Crédito'', ''Transferencia'', ''Seña'', ''Cuenta corriente'') then');
  v_old := 'if p_payment_method = ''Seña'' and p_deposit_minor is null then raise exception ''El monto de la seña no es válido'' using errcode = ''22023''; end if; if p_deposit_minor is not null then';
  if position(v_old in v_create) = 0 then raise exception 'Cambió la validación de seña local'; end if;
  v_create := replace(v_create, v_old,
    'if p_payment_method = ''Seña'' and p_deposit_minor is null then raise exception ''El monto de la seña no es válido'' using errcode = ''22023''; end if;
     if p_payment_method = ''Cuenta corriente'' and (p_customer_id is null or p_deposit_minor is distinct from 0) then
       raise exception ''El fiado necesita un cliente y cobro inicial cero'' using errcode = ''22023'';
     end if; if p_deposit_minor is not null then');
  v_old := 'if p_deposit_minor not between 1 and least(v_items_total_minor, 1000000000) then';
  if position(v_old in v_create) = 0 then raise exception 'Cambió el límite de seña local'; end if;
  v_create := replace(v_create, v_old,
    'if p_deposit_minor not between (case when p_payment_method = ''Cuenta corriente'' then 0 else 1 end) and least(v_items_total_minor, 1000000000) then');
  execute v_create;

  v_local_write := pg_get_functiondef('private.local_sales_write()'::regprocedure);
  v_old := 'if new.payment_method not in (''Efectivo'', ''Débito'', ''Crédito'', ''Transferencia'', ''Seña'') then';
  if position(v_old in v_local_write) = 0 then raise exception 'Cambió la validación de la vista local'; end if;
  execute replace(v_local_write, v_old,
    'if new.payment_method not in (''Efectivo'', ''Débito'', ''Crédito'', ''Transferencia'', ''Seña'', ''Cuenta corriente'') then');

  v_update := pg_get_functiondef('public.gestion_update_local_sale(uuid,uuid,date,text,bigint,jsonb)'::regprocedure);
  v_old := 'p_payment_method not in (''Efectivo'', ''Débito'', ''Crédito'', ''Transferencia'', ''Seña'')';
  if position(v_old in v_update) = 0 then raise exception 'Cambió la validación de edición local'; end if;
  v_update := replace(v_update, v_old,
    'p_payment_method not in (''Efectivo'', ''Débito'', ''Crédito'', ''Transferencia'', ''Seña'', ''Cuenta corriente'')');
  v_old := 'if v_charged + coalesce((select sum(amount_minor) from public.local_sale_receipts where sale_id = p_sale_id), 0) > v_items_total then';
  if position(v_old in v_update) = 0 then raise exception 'Cambió el control de cobros en edición local'; end if;
  v_update := replace(v_update, v_old,
    'if v_charged + coalesce((select sum(amount_minor) from public.local_sale_receipts where sale_id = p_sale_id), 0)
      + coalesce((select sum(amount_minor) from public.customer_account_allocations where order_id = p_sale_id), 0) > v_items_total then');
  execute v_update;

  v_wholesale_guard := pg_get_functiondef('private.wholesale_collected_must_fit_total()'::regprocedure);
  v_old := 'if v_collected > new.total_minor then';
  if position(v_old in v_wholesale_guard) = 0 then raise exception 'Cambió el control de total mayorista'; end if;
  execute replace(v_wholesale_guard, v_old,
    'if v_collected + coalesce((select sum(amount_minor) from public.customer_account_allocations where order_id = new.id), 0) > new.total_minor then');
end;
$$;
