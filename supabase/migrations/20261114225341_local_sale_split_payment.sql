-- NULL preserves every historical sale as a single initial payment.
alter table public.orders add column retail_payment_split jsonb;

create function private.valid_local_initial_payment_split(p_split jsonb, p_total bigint, p_primary text)
returns boolean language plpgsql immutable set search_path = '' as $$
declare
  v_first numeric;
  v_second numeric;
  v_first_method text;
  v_second_method text;
begin
  if p_split is null then return false; end if;
  if jsonb_typeof(p_split) <> 'array' or jsonb_array_length(p_split) <> 2 then return false; end if;
  if jsonb_typeof(p_split->0->'amountMinor') <> 'number'
    or jsonb_typeof(p_split->1->'amountMinor') <> 'number' then return false; end if;
  v_first := (p_split->0->>'amountMinor')::numeric;
  v_second := (p_split->1->>'amountMinor')::numeric;
  v_first_method := p_split->0->>'method';
  v_second_method := p_split->1->>'method';
  return v_first_method in ('Efectivo', 'Débito', 'Crédito', 'Transferencia')
    and v_second_method in ('Efectivo', 'Débito', 'Crédito', 'Transferencia')
    and v_first_method <> v_second_method and v_first_method = p_primary
    and v_first = trunc(v_first) and v_second = trunc(v_second)
    and v_first > 0 and v_second > 0 and v_first + v_second = p_total;
exception when others then
  return false;
end;
$$;

alter table public.orders add constraint orders_retail_payment_split_valid
  check (retail_payment_split is null or
    (channel in ('Local', 'Feria', 'WhatsApp', 'Instagram', 'Facebook')
      and private.valid_local_initial_payment_split(retail_payment_split, total_minor, payment_method)));

create or replace view public.local_sales with (security_invoker = true) as
select
  o.id,
  coalesce((o.customer_snapshot ->> 'legacySaleNumber')::bigint, o.order_number) as sale_number,
  nullif(o.customer_snapshot ->> 'localCustomerId', '')::uuid as customer_id,
  o.customer_name, o.sold_on, o.payment_method, o.total_minor, o.currency,
  nullif(o.customer_snapshot ->> 'createdBy', '')::uuid as created_by,
  o.created_at, o.reference_code, o.channel, o.deposit_minor, o.status,
  o.shipping_method, o.shipping_carrier, o.tracking_code,
  o.retail_shipping_minor, o.retail_rate_to_uyu, o.retail_payment_split
from public.orders o
where o.channel in ('Local', 'Feria', 'WhatsApp', 'Instagram', 'Facebook');

create function public.gestion_create_local_sale_with_split_payment(
  p_customer_id uuid, p_sold_on date, p_payment_method text, p_items jsonb,
  p_deposit_minor bigint, p_channel text, p_currency text, p_rate_to_uyu numeric,
  p_shipping_minor bigint, p_payments jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_sale jsonb;
  v_sale_id uuid;
begin
  if not ((select private.is_pricing_admin()) or (select private.is_commerce_admin())) then
    raise exception 'Acceso no autorizado' using errcode = '42501';
  end if;
  if p_currency not in ('UYU', 'ARS', 'USD', 'BRL') or p_currency is null then
    raise exception 'La moneda no es válida' using errcode = '22023';
  end if;
  -- Validate both methods, positive integer cents and exact sum at the database boundary.
  if p_deposit_minor is not null and not private.valid_local_initial_payment_split(p_payments, p_deposit_minor, p_payment_method) then
    raise exception 'Revisá el desglose del cobro inicial' using errcode = '22023';
  end if;
  if p_currency = 'UYU' then
    if p_rate_to_uyu is not null or p_shipping_minor <> 0 then
      raise exception 'Revisá la moneda y el envío' using errcode = '22023';
    end if;
    v_sale := public.gestion_create_local_sale_with_items(
      p_customer_id, p_sold_on, p_payment_method, p_items, p_deposit_minor, p_channel);
  else
    v_sale := public.gestion_create_local_sale_with_items(
      p_customer_id, p_sold_on, p_payment_method, p_items, p_deposit_minor,
      p_channel, p_currency, p_rate_to_uyu, p_shipping_minor);
  end if;
  v_sale_id := (v_sale->>'id')::uuid;
  if not private.valid_local_initial_payment_split(
    p_payments, (select total_minor from public.orders where id = v_sale_id), p_payment_method) then
    raise exception 'Los dos importes deben sumar exactamente el cobro inicial' using errcode = '22023';
  end if;
  update public.orders set retail_payment_split = p_payments where id = v_sale_id;
  if not found then raise exception 'No se pudo registrar el desglose del cobro' using errcode = '22023'; end if;
  return v_sale;
end;
$$;

revoke all on function public.gestion_create_local_sale_with_split_payment(uuid,date,text,jsonb,bigint,text,text,numeric,bigint,jsonb) from public, anon;
grant execute on function public.gestion_create_local_sale_with_split_payment(uuid,date,text,jsonb,bigint,text,text,numeric,bigint,jsonb) to authenticated;
