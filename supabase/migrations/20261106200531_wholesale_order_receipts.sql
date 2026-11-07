-- Los pedidos anteriores no tienen cobros verificables. Se concilian una vez,
-- sin registrar ese importe histórico como un ingreso nuevo.
create table public.wholesale_order_payment_openings (
  sale_id uuid primary key references public.orders(id) on delete cascade,
  collected_minor bigint check (collected_minor is null or collected_minor >= 0),
  confirmed_at timestamptz,
  confirmed_by uuid references auth.users(id) on delete set null
);

insert into public.wholesale_order_payment_openings (sale_id)
select id from public.orders where channel = 'Mayorista';

create table public.wholesale_order_receipts (
  id uuid primary key,
  sale_id uuid not null references public.orders(id),
  amount_minor bigint not null check (amount_minor > 0),
  source_amount_minor bigint not null check (source_amount_minor > 0),
  currency text not null check (currency in ('UYU', 'ARS')),
  uyu_per_ars numeric check (uyu_per_ars is null or uyu_per_ars > 0),
  payment_method text not null check (payment_method in ('Efectivo', 'Débito', 'Crédito', 'Transferencia')),
  paid_on date not null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  check ((currency = 'UYU' and uyu_per_ars is null and source_amount_minor = amount_minor)
    or (currency = 'ARS' and uyu_per_ars is not null))
);

create index wholesale_order_receipts_sale_id_idx on public.wholesale_order_receipts(sale_id);
create index wholesale_order_receipts_created_by_idx on public.wholesale_order_receipts(created_by);

alter table public.wholesale_order_payment_openings enable row level security;
alter table public.wholesale_order_receipts enable row level security;
revoke all on public.wholesale_order_payment_openings, public.wholesale_order_receipts from public, anon, authenticated;
grant select on public.wholesale_order_payment_openings, public.wholesale_order_receipts to authenticated;
grant all on public.wholesale_order_payment_openings, public.wholesale_order_receipts to service_role;

create policy wholesale_payment_openings_staff_read on public.wholesale_order_payment_openings
  for select to authenticated
  using ((select auth.uid()) is not null
    and ((select private.is_pricing_admin()) or (select private.is_commerce_admin())));
create policy wholesale_order_receipts_staff_read on public.wholesale_order_receipts
  for select to authenticated
  using ((select auth.uid()) is not null
    and ((select private.is_pricing_admin()) or (select private.is_commerce_admin())));

create function public.gestion_record_wholesale_payment(
  p_receipt_id uuid,
  p_sale_id uuid,
  p_source_amount_minor bigint,
  p_currency text,
  p_uyu_per_ars numeric,
  p_payment_method text,
  p_paid_on date,
  p_opening_collected_minor bigint default null
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_order public.orders%rowtype;
  v_opening public.wholesale_order_payment_openings%rowtype;
  v_existing public.wholesale_order_receipts%rowtype;
  v_opening_paid bigint;
  v_later_paid bigint;
  v_amount_minor bigint;
begin
  perform private.require_internal_staff();
  if p_sale_id is null or p_receipt_id is null then
    raise exception 'Falta el identificador del pedido o del cobro' using errcode = '22023';
  end if;
  select * into v_order from public.orders
    where id = p_sale_id and channel = 'Mayorista' and currency = 'UYU'
      and status not in ('cancelled', 'refunded') for update;
  if not found then raise exception 'El pedido mayorista no existe o no admite cobros' using errcode = '22023'; end if;

  select * into v_existing from public.wholesale_order_receipts where id = p_receipt_id;
  if found then
    if v_existing.sale_id = p_sale_id and v_existing.source_amount_minor = p_source_amount_minor
      and v_existing.currency = p_currency and v_existing.uyu_per_ars is not distinct from p_uyu_per_ars
      and v_existing.payment_method = p_payment_method and v_existing.paid_on = p_paid_on then
      return jsonb_build_object('id', v_existing.id, 'sale_id', v_existing.sale_id, 'amount_minor', v_existing.amount_minor);
    end if;
    raise exception 'El identificador del cobro ya se usó con otros datos' using errcode = '22023';
  end if;

  if p_source_amount_minor is null or p_source_amount_minor < 0 then
    raise exception 'El importe del cobro no es válido' using errcode = '22023';
  end if;
  if p_currency not in ('UYU', 'ARS')
    or (p_source_amount_minor > 0 and p_payment_method not in ('Efectivo', 'Débito', 'Crédito', 'Transferencia'))
    or (p_source_amount_minor > 0 and p_payment_method is null)
    or (p_source_amount_minor > 0 and p_paid_on is null)
    or (p_paid_on is not null and p_paid_on > (now() at time zone 'America/Montevideo')::date) then
    raise exception 'Revisá la moneda, el medio de pago y la fecha' using errcode = '22023';
  end if;
  if p_currency = 'ARS' and (p_uyu_per_ars is null or p_uyu_per_ars <= 0) then
    raise exception 'Ingresá la cotización UYU por ARS del cobro' using errcode = '22023';
  end if;
  if p_currency = 'UYU' and p_uyu_per_ars is not null then
    raise exception 'La cotización solo corresponde a cobros en ARS' using errcode = '22023';
  end if;
  v_amount_minor := case when p_currency = 'ARS' then round(p_source_amount_minor * p_uyu_per_ars)::bigint else p_source_amount_minor end;
  if p_source_amount_minor > 0 and v_amount_minor <= 0 then
    raise exception 'El equivalente en UYU debe ser mayor que cero' using errcode = '22023';
  end if;

  select * into v_opening from public.wholesale_order_payment_openings where sale_id = p_sale_id for update;
  if found and v_opening.collected_minor is null then
    if p_opening_collected_minor is null or p_opening_collected_minor < 0 or p_opening_collected_minor > v_order.total_minor then
      raise exception 'Confirmá cuánto se había cobrado antes en este pedido' using errcode = '22023';
    end if;
    update public.wholesale_order_payment_openings
      set collected_minor = p_opening_collected_minor, confirmed_at = now(), confirmed_by = auth.uid()
      where sale_id = p_sale_id;
    v_opening_paid := p_opening_collected_minor;
  else
    v_opening_paid := coalesce(v_opening.collected_minor, 0);
    if p_opening_collected_minor is not null and p_opening_collected_minor <> v_opening_paid then
      raise exception 'El saldo anterior ya fue confirmado con otro importe' using errcode = '22023';
    end if;
  end if;

  select coalesce(sum(amount_minor), 0) into v_later_paid from public.wholesale_order_receipts where sale_id = p_sale_id;
  if v_opening_paid + v_later_paid + v_amount_minor > v_order.total_minor then
    raise exception 'El cobro supera el saldo pendiente' using errcode = '22023';
  end if;
  if p_source_amount_minor = 0 then
    if p_opening_collected_minor is null then raise exception 'El cobro debe ser mayor que cero' using errcode = '22023'; end if;
    return jsonb_build_object('sale_id', p_sale_id, 'opening_collected_minor', v_opening_paid);
  end if;

  insert into public.wholesale_order_receipts
    (id, sale_id, amount_minor, source_amount_minor, currency, uyu_per_ars, payment_method, paid_on, created_by)
    values (p_receipt_id, p_sale_id, v_amount_minor, p_source_amount_minor, p_currency, p_uyu_per_ars, p_payment_method, p_paid_on, auth.uid());
  return jsonb_build_object('id', p_receipt_id, 'sale_id', p_sale_id, 'amount_minor', v_amount_minor);
end;
$$;
revoke all on function public.gestion_record_wholesale_payment(uuid,uuid,bigint,text,numeric,text,date,bigint) from public, anon;
grant execute on function public.gestion_record_wholesale_payment(uuid,uuid,bigint,text,numeric,text,date,bigint) to authenticated;

create function private.wholesale_collected_must_fit_total()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_collected bigint;
begin
  if new.channel <> 'Mayorista' or new.total_minor is not distinct from old.total_minor then return new; end if;
  select coalesce(opening.collected_minor, 0) + coalesce((
    select sum(receipt.amount_minor) from public.wholesale_order_receipts receipt where receipt.sale_id = new.id
  ), 0) into v_collected
  from public.wholesale_order_payment_openings opening where opening.sale_id = new.id;
  if not found then
    select coalesce(sum(amount_minor), 0) into v_collected from public.wholesale_order_receipts where sale_id = new.id;
  end if;
  if v_collected > new.total_minor then
    raise exception 'El nuevo total no puede ser menor que los cobros confirmados' using errcode = '22023';
  end if;
  return new;
end;
$$;
revoke all on function private.wholesale_collected_must_fit_total() from public, anon, authenticated;
create trigger orders_wholesale_collected_must_fit_total
before update of total_minor on public.orders
for each row execute function private.wholesale_collected_must_fit_total();
