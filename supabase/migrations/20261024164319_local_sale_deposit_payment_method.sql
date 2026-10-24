-- A deposit is independent of how it was paid. Keep legacy "Seña" rows readable,
-- while new sales retain their actual payment method and charged amount.
create or replace view public.local_sales with (security_invoker = true) as
select
  o.id,
  coalesce((o.customer_snapshot ->> 'legacySaleNumber')::bigint, o.order_number) as sale_number,
  nullif(o.customer_snapshot ->> 'localCustomerId', '')::uuid as customer_id,
  o.customer_name,
  o.sold_on,
  o.payment_method,
  o.total_minor,
  o.currency,
  nullif(o.customer_snapshot ->> 'createdBy', '')::uuid as created_by,
  o.created_at,
  o.reference_code,
  o.channel,
  o.deposit_minor
from public.orders o
where o.channel in ('Local', 'Feria', 'WhatsApp', 'Instagram', 'Facebook');

do $$
declare
  target record;
  definition text;
  occurrences integer;
begin
  for target in
    select * from (values
      ('private.local_sales_write()',
       'case when new.payment_method = ''Seña'' then new.total_minor end',
       'coalesce(new.deposit_minor, case when new.payment_method = ''Seña'' then new.total_minor end)'),
      ('public.gestion_create_local_sale_with_items(uuid,date,text,jsonb,bigint,text)',
       'if p_payment_method = ''Seña'' then',
       'if p_payment_method = ''Seña'' and p_deposit_minor is null then raise exception ''El monto de la seña no es válido'' using errcode = ''22023''; end if; if p_deposit_minor is not null then'),
      ('public.gestion_create_local_sale_with_items(uuid,date,text,jsonb,bigint,text)',
       'p_deposit_minor is null or p_deposit_minor not between 0 and 1000000000',
       'p_deposit_minor not between 1 and least(v_items_total_minor, 1000000000)'),
      ('public.gestion_create_local_sale_with_items(uuid,date,text,jsonb,bigint,text)',
       '(customer_id, customer_name, sold_on, payment_method, total_minor, channel)',
       '(customer_id, customer_name, sold_on, payment_method, total_minor, channel, deposit_minor)'),
      ('public.gestion_create_local_sale_with_items(uuid,date,text,jsonb,bigint,text)',
       '(p_customer_id, v_customer_name, p_sold_on, p_payment_method, v_charged_total_minor, p_channel)',
       '(p_customer_id, v_customer_name, p_sold_on, p_payment_method, v_charged_total_minor, p_channel, p_deposit_minor)'),
      ('public.gestion_update_local_sale(uuid,uuid,date,text,bigint,jsonb)',
       'if p_payment_method = ''Seña'' then',
       'if p_payment_method = ''Seña'' and p_deposit_minor is null then raise exception ''El monto de la seña no es válido'' using errcode = ''22023''; end if; if p_deposit_minor is not null then'),
      ('public.gestion_update_local_sale(uuid,uuid,date,text,bigint,jsonb)',
       'p_deposit_minor is null or p_deposit_minor not between 0 and v_items_total',
       'p_deposit_minor not between 1 and v_items_total'),
      ('public.gestion_update_local_sale(uuid,uuid,date,text,bigint,jsonb)',
       'deposit_minor = case when p_payment_method = ''Seña'' then v_charged end',
       'deposit_minor = p_deposit_minor')
    ) as changes(signature, previous_text, replacement_text)
  loop
    definition := pg_get_functiondef(to_regprocedure(target.signature));
    if definition is null then raise exception 'Missing sale function: %', target.signature; end if;
    occurrences := (length(definition) - length(replace(definition, target.previous_text, '')))
      / length(target.previous_text);
    if occurrences <> 1 then
      raise exception 'Unexpected sale function definition in %: found % occurrences of %',
        target.signature, occurrences, target.previous_text;
    end if;
    execute replace(definition, target.previous_text, target.replacement_text);
  end loop;
end;
$$;
