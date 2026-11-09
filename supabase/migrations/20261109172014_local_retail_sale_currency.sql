-- Internal orders record the initial collection in orders.total_minor, which
-- can be less than the freight charge. Keep the quoted freight separate.
alter table public.orders
  add column retail_shipping_minor bigint not null default 0 check (retail_shipping_minor between 0 and 1000000000),
  add column retail_rate_to_uyu numeric check (retail_rate_to_uyu > 0 and retail_rate_to_uyu < 'Infinity'::numeric);

create or replace view public.local_sales with (security_invoker = true) as
select
  o.id,
  coalesce((o.customer_snapshot ->> 'legacySaleNumber')::bigint, o.order_number) as sale_number,
  nullif(o.customer_snapshot ->> 'localCustomerId', '')::uuid as customer_id,
  o.customer_name, o.sold_on, o.payment_method, o.total_minor, o.currency,
  nullif(o.customer_snapshot ->> 'createdBy', '')::uuid as created_by,
  o.created_at, o.reference_code, o.channel, o.deposit_minor, o.status,
  o.shipping_method, o.shipping_carrier, o.tracking_code,
  o.retail_shipping_minor, o.retail_rate_to_uyu
from public.orders o
where o.channel in ('Local', 'Feria', 'WhatsApp', 'Instagram', 'Facebook');

create function pg_temp.retail_replace(definition text, anchor text, replacement text, expected integer default 1)
returns text language plpgsql as $$
begin
  if (length(definition) - length(replace(definition, anchor, ''))) / length(anchor) <> expected then
    raise exception 'Unexpected retail sale function definition near %', anchor;
  end if;
  return replace(definition, anchor, replacement);
end;
$$;

do $$
declare definition text;
begin
  definition := pg_get_functiondef('private.local_sales_write()'::regprocedure);
  definition := pg_temp.retail_replace(definition, '  insert into public.orders (status,',
    $sql$  new.currency := coalesce(new.currency, 'UYU');
  new.retail_shipping_minor := coalesce(new.retail_shipping_minor, 0);
  if new.currency = 'UYU' then
    if new.retail_shipping_minor <> 0 or new.retail_rate_to_uyu is not null then
      raise exception 'Revisá la moneda y el envío' using errcode = '22023';
    end if;
  elsif new.currency not in ('ARS', 'USD', 'BRL') or new.payment_method = 'Cuenta corriente'
    or new.retail_rate_to_uyu is null or not exists (
      select 1 from public.commerce_exchange_rates
      where currency_code = new.currency and rate_to_uyu = new.retail_rate_to_uyu and rate_to_uyu > 0
    ) then
    raise exception 'La moneda o la cotización cambió. Actualizá Gestión y revisá los importes.' using errcode = '22023';
  end if;
  insert into public.orders (currency, retail_shipping_minor, retail_rate_to_uyu, status,$sql$);
  definition := pg_temp.retail_replace(definition, $sql$values ('internal_completed', new.total_minor, new.total_minor, 'pickup',$sql$,
    $sql$values (new.currency, new.retail_shipping_minor, new.retail_rate_to_uyu, 'internal_completed',
    new.total_minor, new.total_minor, case when new.retail_shipping_minor > 0 then 'international_coordination' else 'pickup' end,$sql$);
  execute definition;

  -- The existing six-argument RPC still serves UYU sales and customer accounts.
  definition := pg_get_functiondef('public.gestion_create_local_sale_with_items(uuid,date,text,jsonb,bigint,text)'::regprocedure);
  definition := pg_temp.retail_replace(definition, 'p_channel text)',
    'p_channel text, p_currency text, p_rate_to_uyu numeric, p_shipping_minor bigint)');
  definition := pg_temp.retail_replace(definition, '  v_discount numeric;',
    '  v_discount numeric; v_sale_unit_price_minor bigint;');
  definition := pg_temp.retail_replace(definition, '  if p_items is null',
    $sql$  if p_currency is null or p_currency not in ('ARS', 'USD', 'BRL')
    or p_rate_to_uyu is null or p_rate_to_uyu <= 0 or p_rate_to_uyu >= 'Infinity'::numeric
    or p_shipping_minor is null or p_shipping_minor not between 0 and 1000000000 then
    raise exception 'Revisá la moneda, la cotización y el envío' using errcode = '22023';
  end if;
  if p_items is null$sql$);
  definition := pg_temp.retail_replace(definition,
    '    v_items_total_minor := v_items_total_minor + (v_quantity::bigint * v_unit_price_minor);',
    $sql$    v_sale_unit_price_minor := (v_item ->> 'sale_unit_price_minor')::bigint;
    if v_sale_unit_price_minor is null or v_sale_unit_price_minor not between 0 and 1000000000
      or (v_customization is not null and v_sale_unit_price_minor <> round(v_unit_price_minor / p_rate_to_uyu)) then
      raise exception 'Revisá los precios en la moneda de la venta' using errcode = '22023';
    end if;
    v_items_total_minor := v_items_total_minor + v_quantity::bigint * v_sale_unit_price_minor;$sql$);
  definition := pg_temp.retail_replace(definition, 'least(v_items_total_minor, 1000000000)', 'least(v_items_total_minor + p_shipping_minor, 1000000000)');
  definition := pg_temp.retail_replace(definition, 'v_charged_total_minor := v_items_total_minor;',
    'v_charged_total_minor := v_items_total_minor + p_shipping_minor;');
  definition := pg_temp.retail_replace(definition, 'total_minor, channel, deposit_minor)',
    'total_minor, channel, deposit_minor, currency, retail_shipping_minor, retail_rate_to_uyu)');
  definition := pg_temp.retail_replace(definition, 'v_charged_total_minor, p_channel, p_deposit_minor)',
    'v_charged_total_minor, p_channel, p_deposit_minor, p_currency, p_shipping_minor, p_rate_to_uyu)');
  definition := pg_temp.retail_replace(definition, 'v_quantity, v_unit_price_minor, v_customization, v_notes);',
    $sql$v_quantity, (v_item ->> 'sale_unit_price_minor')::bigint, v_customization, v_notes);$sql$);
  execute definition;

  -- Check custom mate prices against their published UYU quote converted at
  -- the rate stored on the sale. Keep the existing UYU rounding tolerance.
  definition := pg_get_functiondef('private.local_sale_items_write()'::regprocedure);
  definition := pg_temp.retail_replace(definition, 'v_discount numeric;', 'v_discount numeric; v_rate numeric; v_quoted_minor numeric;');
  definition := pg_temp.retail_replace(definition, 'select channel into v_channel', 'select channel, retail_rate_to_uyu into v_channel, v_rate');
  definition := pg_temp.retail_replace(definition,
    $sql$if (case when v_discount = 0 then new.unit_price_minor is distinct from (v_quote->>'totalMinor')::bigint
             else abs(new.unit_price_minor - round((v_quote->>'totalMinor')::numeric * (1 - v_discount / 100))::bigint) > 1 end)$sql$,
    $sql$v_quoted_minor := round((v_quote->>'totalMinor')::numeric * (1 - v_discount / 100));
    if (case when v_rate is not null then
               new.unit_price_minor not between round((v_quoted_minor - case when v_discount > 0 then 1 else 0 end) / v_rate)
                 and round((v_quoted_minor + case when v_discount > 0 then 1 else 0 end) / v_rate)
             when v_discount = 0 then new.unit_price_minor is distinct from v_quoted_minor
             else abs(new.unit_price_minor - v_quoted_minor) > 1 end)$sql$);
  execute definition;

  definition := pg_get_functiondef('public.gestion_update_local_sale(uuid,uuid,date,text,bigint,jsonb)'::regprocedure);
  definition := pg_temp.retail_replace(definition, 'v_items_total <> v_charged', 'v_items_total + v_order.retail_shipping_minor <> v_charged');
  definition := pg_temp.retail_replace(definition,
    '+ coalesce((select sum(amount_minor) from public.customer_account_allocations where order_id = p_sale_id), 0) > v_items_total then',
    $sql$+ round(coalesce((select sum(amount_minor) from public.customer_account_allocations where order_id = p_sale_id), 0)
        / coalesce(v_order.retail_rate_to_uyu, 1)) > v_items_total + v_order.retail_shipping_minor then$sql$);
  execute definition;

  definition := pg_get_functiondef('public.gestion_record_local_sale_payment(uuid,uuid,bigint,text,date)'::regprocedure);
  definition := pg_temp.retail_replace(definition, 'and currency = ''UYU''', 'and (currency = ''UYU'' or retail_rate_to_uyu is not null)');
  definition := pg_temp.retail_replace(definition, 'p_amount_minor > v_items_total -', 'p_amount_minor > v_items_total + v_order.retail_shipping_minor -');
  execute definition;

  definition := pg_get_functiondef('private.customer_account_direct_receipt_guard()'::regprocedure);
  definition := pg_temp.retail_replace(definition, 'v_initial + v_direct + v_allocated + new.amount_minor > v_total',
    'v_initial + v_direct + round(v_allocated / coalesce(v_order.retail_rate_to_uyu, 1)) + new.amount_minor > v_total + v_order.retail_shipping_minor');
  execute definition;

  definition := pg_get_functiondef('public.gestion_allocate_customer_account_receipt(uuid,uuid,uuid,bigint)'::regprocedure);
  definition := pg_temp.retail_replace(definition, '  if p_source_amount_minor > v_total - v_initial - v_direct - v_allocated then',
    $sql$  if v_order.channel <> 'Mayorista' then
    v_total := floor((v_total + v_order.retail_shipping_minor - v_initial - v_direct) * coalesce(v_order.retail_rate_to_uyu, 1));
    v_initial := 0;
    v_direct := 0;
  end if;
  if p_source_amount_minor > v_total - v_initial - v_direct - v_allocated then$sql$);
  execute definition;
end;
$$;

revoke all on function public.gestion_create_local_sale_with_items(uuid,date,text,jsonb,bigint,text,text,numeric,bigint) from public, anon;
grant execute on function public.gestion_create_local_sale_with_items(uuid,date,text,jsonb,bigint,text,text,numeric,bigint) to authenticated;
drop function pg_temp.retail_replace(text,text,text,integer);
