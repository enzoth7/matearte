-- Consignment accounts are separate from internal Gestion memberships.
create table public.consignment_portal_users (
  user_id uuid primary key references auth.users(id) on delete restrict,
  contact_id uuid not null references public.contacts(id) on delete restrict,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 120),
  active boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);
create index consignment_portal_users_contact_idx on public.consignment_portal_users(contact_id);
alter table public.consignment_portal_users enable row level security;
revoke all on public.consignment_portal_users from public, anon, authenticated;
grant all on public.consignment_portal_users to service_role;

create function private.guard_consignment_portal_role()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_name = 'consignment_portal_users' and exists (
    select 1 from public.commerce_admin_users where user_id = new.user_id
  ) then raise exception 'El usuario ya pertenece al equipo interno' using errcode = '23514'; end if;
  if tg_table_name = 'commerce_admin_users' and exists (
    select 1 from public.consignment_portal_users where user_id = new.user_id
  ) then raise exception 'El usuario ya es consignatario' using errcode = '23514'; end if;
  return new;
end;
$$;
revoke all on function private.guard_consignment_portal_role() from public, anon, authenticated;
create trigger consignment_portal_role_guard before insert or update of user_id
  on public.consignment_portal_users for each row execute function private.guard_consignment_portal_role();
create trigger commerce_admin_portal_role_guard before insert or update of user_id
  on public.commerce_admin_users for each row execute function private.guard_consignment_portal_role();

-- Keep the existing OAuth pre-request boundary and block every Data API route
-- for portal identities, including disabled users and direct RPC calls.
create function public.gestion_portal_data_api_access()
returns void language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is not null and exists (
    select 1 from public.consignment_portal_users where user_id = (select auth.uid())
  ) then
    raise insufficient_privilege using message = 'Usa el panel de Consignaciones.';
  end if;
  perform public.gestion_data_api_access();
end;
$$;
revoke all on function public.gestion_portal_data_api_access() from public, anon, authenticated, service_role;
grant execute on function public.gestion_portal_data_api_access() to anon, authenticated, service_role;
alter role authenticator set pgrst.db_pre_request = 'public.gestion_portal_data_api_access';
notify pgrst, 'reload config';

-- These legacy names are security-invoker views over tables that already use
-- RLS. Assert that shape before relying on their underlying policies.
do $$
declare target_view text;
begin
  foreach target_view in array array[
    'admin_users', 'customers', 'local_sale_items', 'local_sales',
    'local_sales_customers', 'order_lines', 'products', 'settings'
  ] loop
    if not exists (
      select 1 from pg_catalog.pg_class c
      join pg_catalog.pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = target_view and c.relkind = 'v'
        and 'security_invoker=true' = any(c.reloptions)
    ) then
      raise exception 'La vista % debe conservar security_invoker', target_view;
    end if;
  end loop;
end;
$$;

create or replace function private.require_internal_staff()
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if exists (select 1 from public.consignment_portal_users where user_id = (select auth.uid()))
    or not ((select private.is_pricing_admin()) or (select private.is_commerce_admin())) then
    raise insufficient_privilege using message = 'Acceso interno requerido';
  end if;
end;
$$;

-- Values in the consignment are immutable snapshots of the linked order.
alter table public.wholesale_consignments
  add column currency text not null default 'ARS' check (currency in ('UYU', 'ARS'));
alter table public.wholesale_consignment_lines
  rename column unit_price_arg_minor to unit_price_minor;
alter table public.wholesale_consignment_lines
  rename constraint wholesale_consignment_lines_unit_price_arg_minor_check
  to wholesale_consignment_lines_unit_price_minor_check;
alter table public.customer_account_receipts
  add column consignment_id uuid references public.wholesale_consignments(id) on delete restrict;
create index customer_account_receipts_consignment_idx
  on public.customer_account_receipts(consignment_id, paid_on desc)
  where consignment_id is not null;

create function private.guard_consignment_receipt_origin()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.consignment_id is not null and not exists (
    select 1 from public.wholesale_consignments c
    where c.id = new.consignment_id and c.contact_id = new.contact_id
      and c.currency = new.currency
  ) then raise exception 'El cobro no corresponde a la consignacion' using errcode = '23514'; end if;
  if new.consignment_id is not null and exists (
    select 1 from public.customer_account_allocations where receipt_id = new.id
  ) then raise exception 'El cobro ya fue aplicado a otro pedido' using errcode = '23514'; end if;
  return new;
end;
$$;
revoke all on function private.guard_consignment_receipt_origin() from public, anon, authenticated;
create trigger customer_receipt_consignment_origin before insert or update of consignment_id, contact_id, currency
  on public.customer_account_receipts for each row execute function private.guard_consignment_receipt_origin();

create function private.guard_consignment_receipt_ordinary_allocation()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.customer_account_receipts
    where id = new.receipt_id and consignment_id is not null) then
    raise exception 'El adelanto de consignación solo puede aplicarse a consignaciones' using errcode = '22023';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_consignment_receipt_ordinary_allocation() from public, anon, authenticated;
create trigger customer_allocation_consignment_origin before insert or update of receipt_id
  on public.customer_account_allocations for each row execute function private.guard_consignment_receipt_ordinary_allocation();

-- Retire the earlier independent consignment creation path. Every consignment
-- now starts from a saved wholesale order.
drop function public.gestion_create_wholesale_consignment(uuid,uuid,jsonb);

create function public.gestion_link_wholesale_consignment(p_id uuid, p_order_id uuid, p_currency text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_order public.orders%rowtype;
  v_previous public.wholesale_consignments%rowtype;
  v_line public.order_items%rowtype;
  v_rate numeric;
  v_price_minor numeric;
  v_count integer := 0;
begin
  perform private.require_internal_staff();
  if p_id is null or p_order_id is null or p_currency is null or p_currency not in ('UYU', 'ARS') then
    raise exception 'Elegí pedido y moneda de la consignación' using errcode = '22023';
  end if;
  select * into v_previous from public.wholesale_consignments where id = p_id;
  if found then
    if v_previous.order_id = p_order_id and v_previous.currency = p_currency then
      return jsonb_build_object('id', p_id, 'order_id', p_order_id);
    end if;
    raise exception 'El identificador ya corresponde a otra consignación' using errcode = '23505';
  end if;
  select * into v_order from public.orders where id = p_order_id for update;
  if not found or v_order.channel <> 'Mayorista' or v_order.status in ('cancelled', 'refunded', 'payment_failed')
    or v_order.contact_id is null or v_order.paid_at is not null
    or v_order.shipped_at is not null or v_order.delivered_at is not null then
    raise exception 'El pedido mayorista no está disponible para consignación' using errcode = '22023';
  end if;
  if exists (select 1 from public.wholesale_consignments where order_id = p_order_id)
    or exists (select 1 from public.wholesale_order_receipts where sale_id = p_order_id)
    or exists (select 1 from public.customer_account_allocations where order_id = p_order_id)
    or exists (select 1 from public.wholesale_order_payment_openings where sale_id = p_order_id
      and (coalesce(collected_arg_minor, 0) <> 0 or coalesce(collected_minor, 0) <> 0
        or paid_in_full_without_price or finance_paid_at_order)) then
    raise exception 'El pedido ya tiene cobros, entregas o una consignación' using errcode = '22023';
  end if;
  for v_line in select * from public.order_items where order_id = p_order_id order by id for update loop
    v_count := v_count + 1;
    if v_line.source_variant_id is null or nullif(btrim(coalesce(v_line.sku, '')), '') is null
      or v_line.quantity is null or v_line.quantity <= 0 then
      raise exception 'Las líneas del pedido necesitan SKU y cantidad' using errcode = '22023';
    end if;
    if p_currency = 'ARS' then
      if v_line.total_arg is null or v_line.total_arg < 0 or v_line.exchange_rate is null or v_line.exchange_rate <= 0 then
        raise exception 'Las líneas del pedido necesitan precio ARS y cotización guardados' using errcode = '22023';
      end if;
      if v_rate is null then v_rate := v_line.exchange_rate;
      elsif v_rate <> v_line.exchange_rate then
        raise exception 'Las líneas del pedido tienen cotizaciones diferentes' using errcode = '22023';
      end if;
      v_price_minor := v_line.total_arg * 100 / v_line.quantity;
    else
      v_rate := 1;
      v_price_minor := v_line.total_minor::numeric / v_line.quantity;
    end if;
    if v_price_minor is null or v_price_minor < 0 or v_price_minor <> trunc(v_price_minor)
      or v_price_minor > 9223372036854775807 then
      raise exception 'El precio del pedido no se puede repartir por unidad' using errcode = '22023';
    end if;
  end loop;
  if v_count = 0 then raise exception 'El pedido mayorista no tiene productos' using errcode = '22023'; end if;
  insert into public.wholesale_consignments(id, order_id, contact_id, exchange_rate, currency, created_by)
  values (p_id, p_order_id, v_order.contact_id, v_rate, p_currency, auth.uid());
  insert into public.wholesale_consignment_lines
    (consignment_id, order_item_id, variant_id, sku, title, quantity, unit_price_minor)
  select p_id, i.id, i.source_variant_id, i.sku, i.title, i.quantity,
    case when p_currency = 'ARS' then (i.total_arg * 100 / i.quantity)::bigint
      else (i.total_minor / i.quantity)::bigint end
  from public.order_items i where i.order_id = p_order_id;
  update public.orders set customer_snapshot = coalesce(customer_snapshot, '{}'::jsonb)
    || jsonb_build_object('purchaseFlow', 'consignment') where id = p_order_id;
  return jsonb_build_object('id', p_id, 'order_id', p_order_id, 'reference_code', v_order.reference_code);
end;
$$;
revoke all on function public.gestion_link_wholesale_consignment(uuid,uuid,text) from public, anon;
grant execute on function public.gestion_link_wholesale_consignment(uuid,uuid,text) to authenticated;

create or replace function public.gestion_link_wholesale_consignment(p_id uuid, p_order_id uuid)
returns jsonb language sql security definer set search_path = '' as $$
  select public.gestion_link_wholesale_consignment(p_id, p_order_id, 'ARS');
$$;

create or replace function public.gestion_allocate_wholesale_consignment_receipt(
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
    raise exception 'La asignación necesita un importe positivo' using errcode = '22023';
  end if;
  select * into v_receipt from public.customer_account_receipts where id = p_receipt_id for update;
  select * into v_consignment from public.wholesale_consignments where id = p_consignment_id for update;
  if v_receipt.id is null or v_consignment.id is null
    or v_receipt.currency <> v_consignment.currency
    or v_receipt.contact_id <> v_consignment.contact_id then
    raise exception 'El cobro debe pertenecer a la misma cuenta y moneda' using errcode = '22023';
  end if;
  select * into v_existing from public.wholesale_consignment_allocations where id = p_id;
  if found then
    if (v_existing.receipt_id, v_existing.consignment_id, v_existing.source_amount_minor)
      = (p_receipt_id, p_consignment_id, p_source_amount_minor) then return jsonb_build_object('id', p_id); end if;
    raise exception 'El identificador de la asignación ya fue usado' using errcode = '23505';
  end if;
  select coalesce(sum(m.quantity * l.unit_price_minor), 0) into v_charge
    from public.wholesale_consignment_lines l
    join public.wholesale_consignment_movements m on m.line_id = l.id and m.kind = 'kept'
    where l.consignment_id = p_consignment_id;
  select coalesce(sum(source_amount_minor), 0) into v_applied
    from public.wholesale_consignment_allocations where consignment_id = p_consignment_id;
  if p_source_amount_minor > v_charge - v_applied then
    raise exception 'La asignación supera el saldo confirmado' using errcode = '22023'; end if;
  select coalesce(sum(case when v_receipt.currency = 'ARS' then source_amount_minor else amount_minor end), 0)
    into v_used from public.customer_account_allocations where receipt_id = p_receipt_id;
  v_used := v_used + coalesce((select sum(source_amount_minor)
    from public.wholesale_consignment_allocations where receipt_id = p_receipt_id), 0);
  if p_source_amount_minor > v_receipt.source_amount_minor - v_used then
    raise exception 'El cobro no tiene ese saldo a favor' using errcode = '22023'; end if;
  insert into public.wholesale_consignment_allocations
    (id, consignment_id, receipt_id, source_amount_minor, created_by)
  values (p_id, p_consignment_id, p_receipt_id, p_source_amount_minor, auth.uid());
  return jsonb_build_object('id', p_id);
end;
$$;

create or replace function private.guard_customer_receipt_consignment_capacity()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_receipt public.customer_account_receipts%rowtype; v_used bigint;
begin
  select * into v_receipt from public.customer_account_receipts where id = new.receipt_id for update;
  select coalesce(sum(case when v_receipt.currency = 'ARS' then source_amount_minor else amount_minor end), 0)
    into v_used from public.customer_account_allocations where receipt_id = new.receipt_id;
  v_used := v_used + coalesce((select sum(source_amount_minor)
    from public.wholesale_consignment_allocations where receipt_id = new.receipt_id), 0);
  if new.amount_minor is null or (v_receipt.currency = 'ARS' and new.source_amount_minor is null) or
    (case when v_receipt.currency = 'ARS' then new.source_amount_minor else new.amount_minor end) + v_used > v_receipt.source_amount_minor then
    raise exception 'El cobro no tiene ese saldo a favor' using errcode = '22023'; end if;
  return new;
end;
$$;

create or replace function public.gestion_record_wholesale_consignment_payment(
  p_receipt_id uuid, p_allocation_id uuid, p_consignment_id uuid,
  p_source_amount_minor bigint, p_uyu_per_ars numeric, p_payment_method text,
  p_paid_on date, p_note text default null
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_consignment public.wholesale_consignments%rowtype;
  v_charge bigint;
  v_applied bigint;
  v_to_apply bigint;
  v_preexisting boolean;
begin
  perform private.require_internal_staff();
  select * into v_consignment from public.wholesale_consignments where id = p_consignment_id;
  if not found then raise exception 'La consignación no existe' using errcode = '22023'; end if;
  select exists (select 1 from public.customer_account_receipts where id = p_receipt_id) into v_preexisting;
  perform public.gestion_record_customer_account_receipt(p_receipt_id, v_consignment.contact_id,
    p_source_amount_minor, v_consignment.currency,
    case when v_consignment.currency = 'ARS' then p_uyu_per_ars else null end,
    p_payment_method, p_paid_on, p_note);
  if v_preexisting then
    if not exists (select 1 from public.customer_account_receipts
      where id = p_receipt_id and consignment_id = p_consignment_id) then
      raise exception 'El cobro ya corresponde a otra operación' using errcode = '23505';
    end if;
    return jsonb_build_object('receipt_id', p_receipt_id, 'already_recorded', true);
  end if;
  update public.customer_account_receipts set consignment_id = p_consignment_id where id = p_receipt_id;
  select coalesce(sum(m.quantity * l.unit_price_minor), 0) into v_charge
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
  return jsonb_build_object('receipt_id', p_receipt_id, 'allocated_minor', v_to_apply,
    'credit_minor', p_source_amount_minor - v_to_apply);
end;
$$;
