-- El pedido mayorista organiza la producción. Solo las unidades conservadas
-- generan un cargo; los cobros siguen siendo movimientos de la cuenta ARS.
create table public.wholesale_consignments (
  id uuid primary key,
  order_id uuid not null unique references public.orders(id) on delete restrict,
  contact_id uuid not null references public.contacts(id) on delete restrict,
  exchange_rate numeric not null check (exchange_rate > 0),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);
create index wholesale_consignments_contact_idx on public.wholesale_consignments(contact_id, created_at desc);

create table public.wholesale_consignment_lines (
  id uuid primary key default gen_random_uuid(),
  consignment_id uuid not null references public.wholesale_consignments(id) on delete restrict,
  order_item_id uuid not null unique references public.order_items(id) on delete restrict,
  variant_id uuid not null references public.commerce_variants(id) on delete restrict,
  sku text not null,
  title text not null,
  quantity integer not null check (quantity > 0),
  unit_price_arg_minor bigint not null check (unit_price_arg_minor > 0)
);
create index wholesale_consignment_lines_parent_idx on public.wholesale_consignment_lines(consignment_id);

create table public.wholesale_consignment_movements (
  id uuid primary key,
  line_id uuid not null references public.wholesale_consignment_lines(id) on delete restrict,
  kind text not null check (kind in ('dispatch', 'return', 'kept')),
  quantity integer not null check (quantity > 0),
  occurred_on date not null,
  carrier text,
  tracking text,
  note text check (note is null or char_length(note) <= 500),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  check (kind = 'dispatch' or (carrier is null and tracking is null))
);
create index wholesale_consignment_movements_line_idx on public.wholesale_consignment_movements(line_id, occurred_on, created_at);

create table public.wholesale_consignment_allocations (
  id uuid primary key,
  consignment_id uuid not null references public.wholesale_consignments(id) on delete restrict,
  receipt_id uuid not null references public.customer_account_receipts(id) on delete restrict,
  source_amount_minor bigint not null check (source_amount_minor > 0),
  allocated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);
create index wholesale_consignment_allocations_parent_idx on public.wholesale_consignment_allocations(consignment_id);
create index wholesale_consignment_allocations_receipt_idx on public.wholesale_consignment_allocations(receipt_id);

alter table public.wholesale_consignments enable row level security;
alter table public.wholesale_consignment_lines enable row level security;
alter table public.wholesale_consignment_movements enable row level security;
alter table public.wholesale_consignment_allocations enable row level security;
revoke all on public.wholesale_consignments, public.wholesale_consignment_lines,
  public.wholesale_consignment_movements, public.wholesale_consignment_allocations from public, anon, authenticated;
grant select on public.wholesale_consignments, public.wholesale_consignment_lines,
  public.wholesale_consignment_movements, public.wholesale_consignment_allocations to authenticated;
grant all on public.wholesale_consignments, public.wholesale_consignment_lines,
  public.wholesale_consignment_movements, public.wholesale_consignment_allocations to service_role;
create policy wholesale_consignments_staff_read on public.wholesale_consignments for select to authenticated
  using ((select auth.uid()) is not null and ((select private.is_pricing_admin()) or (select private.is_commerce_admin())));
create policy wholesale_consignment_lines_staff_read on public.wholesale_consignment_lines for select to authenticated
  using ((select auth.uid()) is not null and ((select private.is_pricing_admin()) or (select private.is_commerce_admin())));
create policy wholesale_consignment_movements_staff_read on public.wholesale_consignment_movements for select to authenticated
  using ((select auth.uid()) is not null and ((select private.is_pricing_admin()) or (select private.is_commerce_admin())));
create policy wholesale_consignment_allocations_staff_read on public.wholesale_consignment_allocations for select to authenticated
  using ((select auth.uid()) is not null and ((select private.is_pricing_admin()) or (select private.is_commerce_admin())));

-- No se puede cambiar la cantidad o el producto de un pedido que ya tiene
-- movimientos de consignación. El estado de producción sigue siendo editable.
create function private.guard_wholesale_consignment_item()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.wholesale_consignment_lines where order_item_id = old.id) then
    if tg_op = 'DELETE' then
      raise exception 'No se puede eliminar una línea de consignación' using errcode = '22023';
    end if;
    if (new.order_id, new.quantity, new.source_variant_id, new.sku, new.title,
        new.unit_price_minor, new.total_minor, new.unit_price_arg, new.total_arg, new.no_cost)
       is distinct from
       (old.order_id, old.quantity, old.source_variant_id, old.sku, old.title,
        old.unit_price_minor, old.total_minor, old.unit_price_arg, old.total_arg, old.no_cost) then
      raise exception 'La línea de consignación conserva producto, cantidad y precio pactados' using errcode = '22023';
    end if;
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
revoke all on function private.guard_wholesale_consignment_item() from public, anon, authenticated;
create trigger order_items_guard_wholesale_consignment before update or delete on public.order_items
  for each row execute function private.guard_wholesale_consignment_item();

create function public.gestion_create_wholesale_consignment(
  p_id uuid, p_contact_id uuid, p_items jsonb
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_customer text;
  v_code text;
  v_order_id uuid;
  v_rate numeric;
  v_item jsonb;
  v_variant record;
  v_variant_id uuid;
  v_seen uuid[] := '{}';
  v_quantity integer;
  v_price bigint;
  v_line_id text;
  v_order_item_id uuid;
begin
  perform private.require_internal_staff();
  if p_id is null or p_contact_id is null or jsonb_typeof(p_items) is distinct from 'array'
    or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 100 then
    raise exception 'Seleccioná cliente y productos para la consignación' using errcode = '22023';
  end if;
  select order_id into v_order_id from public.wholesale_consignments where id = p_id;
  if found then return jsonb_build_object('id', p_id, 'order_id', v_order_id); end if;
  select wholesale_name into v_customer from public.contacts where id = p_contact_id;
  if nullif(btrim(coalesce(v_customer, '')), '') is null
    or not exists (select 1 from public.customers where full_name = v_customer) then
    raise exception 'Seleccioná un cliente mayorista existente' using errcode = '22023';
  end if;
  select exchange_rate into v_rate from public.settings where id = 1;
  if v_rate is null or v_rate <= 0 then raise exception 'Falta la cotización ARS' using errcode = '22023'; end if;
  v_code := public.gestion_next_wholesale_order_code();
  for v_item in select value from jsonb_array_elements(p_items) as value loop
    v_variant_id := (v_item ->> 'variant_id')::uuid;
    v_quantity := (v_item ->> 'quantity')::integer;
    v_price := (v_item ->> 'unit_price_arg_minor')::bigint;
    if v_variant_id is null or v_variant_id = any(v_seen) or v_quantity is null or v_quantity <= 0
      or v_price is null or v_price <= 0 then
      raise exception 'Revisá producto, cantidad y precio ARS' using errcode = '22023';
    end if;
    v_seen := array_append(v_seen, v_variant_id);
    select product.name as model, variant.name as variant, variant.sku as sku
      into v_variant from public.commerce_variants variant
      join public.commerce_products product on product.id = variant.product_id
      where variant.id = v_variant_id and variant.available_wholesale = true;
    if not found or nullif(btrim(coalesce(v_variant.sku, '')), '') is null then
      raise exception 'El producto mayorista necesita un SKU vigente' using errcode = '22023';
    end if;
    v_line_id := 'line-' || gen_random_uuid()::text;
    insert into public.order_lines
      (line_id, order_id, created_at, customer, model, variant, quantity, status,
       order_type, sale_channel, unit_price_arg, unit_price_uyu, exchange_rate, total_arg, total_uyu)
    values (v_line_id, v_code, now(), v_customer, v_variant.model, v_variant.variant,
      v_quantity, 'Pendiente', 'no_cost', 'WhatsApp', 0, 0, v_rate, 0, 0);
    select i.id, i.order_id into v_order_item_id, v_order_id
      from public.order_items i where i.immutable_snapshot ->> 'lineId' = v_line_id;
    if v_order_item_id is null then raise exception 'No se pudo crear el trabajo de taller' using errcode = '22023'; end if;
    if not exists (select 1 from public.wholesale_consignments where id = p_id) then
      insert into public.wholesale_consignments(id, order_id, contact_id, exchange_rate, created_by)
      values (p_id, v_order_id, p_contact_id, v_rate, auth.uid());
      update public.orders set customer_snapshot = customer_snapshot || jsonb_build_object('purchaseFlow', 'consignment')
        where id = v_order_id;
    end if;
    insert into public.wholesale_consignment_lines
      (consignment_id, order_item_id, variant_id, sku, title, quantity, unit_price_arg_minor)
    values (p_id, v_order_item_id, v_variant_id, v_variant.sku,
      v_variant.model || ' — ' || v_variant.variant, v_quantity, v_price);
  end loop;
  return jsonb_build_object('id', p_id, 'order_id', v_order_id, 'reference_code', v_code);
end;
$$;
revoke all on function public.gestion_create_wholesale_consignment(uuid,uuid,jsonb) from public, anon;
grant execute on function public.gestion_create_wholesale_consignment(uuid,uuid,jsonb) to authenticated;

create function public.gestion_record_wholesale_consignment_movement(
  p_id uuid, p_line_id uuid, p_kind text, p_quantity integer, p_occurred_on date,
  p_carrier text default null, p_tracking text default null, p_note text default null
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_line public.wholesale_consignment_lines%rowtype;
  v_existing public.wholesale_consignment_movements%rowtype;
  v_sent integer;
  v_returned integer;
  v_kept integer;
begin
  perform private.require_internal_staff();
  if p_id is null or p_line_id is null or p_kind not in ('dispatch', 'return', 'kept')
    or p_quantity is null or p_quantity <= 0 or p_occurred_on is null
    or p_occurred_on > (now() at time zone 'America/Montevideo')::date
    or char_length(coalesce(p_note, '')) > 500 then
    raise exception 'Revisá el movimiento de la consignación' using errcode = '22023';
  end if;
  if p_kind <> 'dispatch' and (nullif(btrim(coalesce(p_carrier, '')), '') is not null
    or nullif(btrim(coalesce(p_tracking, '')), '') is not null) then
    raise exception 'El transporte corresponde solamente a una entrega' using errcode = '22023';
  end if;
  select * into v_line from public.wholesale_consignment_lines where id = p_line_id for update;
  if not found then raise exception 'La línea de consignación no existe' using errcode = '22023'; end if;
  select * into v_existing from public.wholesale_consignment_movements where id = p_id;
  if found then
    if (v_existing.line_id, v_existing.kind, v_existing.quantity, v_existing.occurred_on)
      = (p_line_id, p_kind, p_quantity, p_occurred_on) then return jsonb_build_object('id', p_id); end if;
    raise exception 'El identificador del movimiento ya fue usado' using errcode = '23505';
  end if;
  select coalesce(sum(quantity) filter (where kind = 'dispatch'), 0),
         coalesce(sum(quantity) filter (where kind = 'return'), 0),
         coalesce(sum(quantity) filter (where kind = 'kept'), 0)
    into v_sent, v_returned, v_kept
    from public.wholesale_consignment_movements where line_id = p_line_id;
  if p_kind = 'dispatch' then
    if not exists (select 1 from public.order_items where id = v_line.order_item_id and production_status = 'completed') then
      raise exception 'Terminá la producción antes de enviar estas unidades' using errcode = '22023';
    end if;
    if p_quantity > v_line.quantity - v_sent then
      raise exception 'No hay tantas unidades terminadas sin enviar' using errcode = '22023'; end if;
  elsif p_quantity > v_sent - v_returned - v_kept then
    raise exception 'El cliente no tiene tantas unidades disponibles' using errcode = '22023';
  end if;
  insert into public.wholesale_consignment_movements
    (id, line_id, kind, quantity, occurred_on, carrier, tracking, note, created_by)
  values (p_id, p_line_id, p_kind, p_quantity, p_occurred_on,
    case when p_kind = 'dispatch' then nullif(btrim(p_carrier), '') end,
    case when p_kind = 'dispatch' then nullif(btrim(p_tracking), '') end,
    nullif(btrim(p_note), ''), auth.uid());
  return jsonb_build_object('id', p_id);
end;
$$;
revoke all on function public.gestion_record_wholesale_consignment_movement(uuid,uuid,text,integer,date,text,text,text) from public, anon;
grant execute on function public.gestion_record_wholesale_consignment_movement(uuid,uuid,text,integer,date,text,text,text) to authenticated;

create function public.gestion_allocate_wholesale_consignment_receipt(
  p_id uuid, p_receipt_id uuid, p_consignment_id uuid, p_source_amount_minor bigint
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_consignment public.wholesale_consignments%rowtype;
  v_receipt public.customer_account_receipts%rowtype;
  v_existing public.wholesale_consignment_allocations%rowtype;
  v_charge bigint;
  v_applied bigint;
  v_used bigint;
begin
  perform private.require_internal_staff();
  if p_id is null or p_receipt_id is null or p_consignment_id is null
    or p_source_amount_minor is null or p_source_amount_minor <= 0 then
    raise exception 'La asignación necesita un importe ARS positivo' using errcode = '22023';
  end if;
  select * into v_receipt from public.customer_account_receipts where id = p_receipt_id for update;
  select * into v_consignment from public.wholesale_consignments where id = p_consignment_id for update;
  if v_receipt.id is null or v_consignment.id is null or v_receipt.currency <> 'ARS'
    or v_receipt.contact_id <> v_consignment.contact_id then
    raise exception 'La entrega ARS debe pertenecer al cliente de la consignación' using errcode = '22023';
  end if;
  select * into v_existing from public.wholesale_consignment_allocations where id = p_id;
  if found then
    if (v_existing.receipt_id, v_existing.consignment_id, v_existing.source_amount_minor)
      = (p_receipt_id, p_consignment_id, p_source_amount_minor) then return jsonb_build_object('id', p_id); end if;
    raise exception 'El identificador de la asignación ya fue usado' using errcode = '23505';
  end if;
  select coalesce(sum(m.quantity * l.unit_price_arg_minor), 0) into v_charge
    from public.wholesale_consignment_lines l
    join public.wholesale_consignment_movements m on m.line_id = l.id and m.kind = 'kept'
    where l.consignment_id = p_consignment_id;
  select coalesce(sum(source_amount_minor), 0) into v_applied
    from public.wholesale_consignment_allocations where consignment_id = p_consignment_id;
  if p_source_amount_minor > v_charge - v_applied then
    raise exception 'La asignación supera el saldo confirmado' using errcode = '22023'; end if;
  select coalesce(sum(source_amount_minor), 0) into v_used
    from public.customer_account_allocations where receipt_id = p_receipt_id;
  v_used := v_used + coalesce((select sum(source_amount_minor)
    from public.wholesale_consignment_allocations where receipt_id = p_receipt_id), 0);
  if p_source_amount_minor > v_receipt.source_amount_minor - v_used then
    raise exception 'La entrega no tiene ese saldo a favor' using errcode = '22023'; end if;
  insert into public.wholesale_consignment_allocations
    (id, consignment_id, receipt_id, source_amount_minor, created_by)
  values (p_id, p_consignment_id, p_receipt_id, p_source_amount_minor, auth.uid());
  return jsonb_build_object('id', p_id);
end;
$$;
revoke all on function public.gestion_allocate_wholesale_consignment_receipt(uuid,uuid,uuid,bigint) from public, anon;
grant execute on function public.gestion_allocate_wholesale_consignment_receipt(uuid,uuid,uuid,bigint) to authenticated;

-- El mismo cobro tampoco puede gastarse otra vez en un pedido mayorista común.
create function private.guard_customer_receipt_consignment_capacity()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_receipt public.customer_account_receipts%rowtype; v_used bigint;
begin
  select * into v_receipt from public.customer_account_receipts where id = new.receipt_id for update;
  if v_receipt.currency = 'ARS' then
    select coalesce(sum(source_amount_minor), 0) into v_used
      from public.customer_account_allocations where receipt_id = new.receipt_id;
    v_used := v_used + coalesce((select sum(source_amount_minor)
      from public.wholesale_consignment_allocations where receipt_id = new.receipt_id), 0);
    if new.source_amount_minor is null or new.source_amount_minor + v_used > v_receipt.source_amount_minor then
      raise exception 'La entrega ARS no tiene ese saldo a favor' using errcode = '22023'; end if;
  end if;
  return new;
end;
$$;
revoke all on function private.guard_customer_receipt_consignment_capacity() from public, anon, authenticated;
create trigger customer_account_allocation_consignment_capacity before insert on public.customer_account_allocations
  for each row execute function private.guard_customer_receipt_consignment_capacity();

create function public.gestion_record_wholesale_consignment_payment(
  p_receipt_id uuid, p_allocation_id uuid, p_consignment_id uuid,
  p_source_amount_minor bigint, p_uyu_per_ars numeric, p_payment_method text,
  p_paid_on date, p_note text default null
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_contact_id uuid; v_charge bigint; v_applied bigint; v_to_apply bigint;
begin
  perform private.require_internal_staff();
  select contact_id into v_contact_id from public.wholesale_consignments where id = p_consignment_id;
  if v_contact_id is null then raise exception 'La consignación no existe' using errcode = '22023'; end if;
  perform public.gestion_record_customer_account_receipt(p_receipt_id, v_contact_id,
    p_source_amount_minor, 'ARS', p_uyu_per_ars, p_payment_method, p_paid_on, p_note);
  if exists (select 1 from public.wholesale_consignment_allocations where id = p_allocation_id) then
    return jsonb_build_object('receipt_id', p_receipt_id, 'allocation_id', p_allocation_id);
  end if;
  select coalesce(sum(m.quantity * l.unit_price_arg_minor), 0) into v_charge
    from public.wholesale_consignment_lines l
    join public.wholesale_consignment_movements m on m.line_id = l.id and m.kind = 'kept'
    where l.consignment_id = p_consignment_id;
  select coalesce(sum(source_amount_minor), 0) into v_applied
    from public.wholesale_consignment_allocations where consignment_id = p_consignment_id;
  v_to_apply := least(p_source_amount_minor, greatest(0, v_charge - v_applied));
  if v_to_apply > 0 then
    perform public.gestion_allocate_wholesale_consignment_receipt(p_allocation_id,
      p_receipt_id, p_consignment_id, v_to_apply);
  end if;
  return jsonb_build_object('receipt_id', p_receipt_id, 'allocated_arg_minor', v_to_apply,
    'credit_arg_minor', p_source_amount_minor - v_to_apply);
end;
$$;
revoke all on function public.gestion_record_wholesale_consignment_payment(uuid,uuid,uuid,bigint,numeric,text,date,text) from public, anon;
grant execute on function public.gestion_record_wholesale_consignment_payment(uuid,uuid,uuid,bigint,numeric,text,date,text) to authenticated;
