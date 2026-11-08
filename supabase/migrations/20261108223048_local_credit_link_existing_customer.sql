create function public.gestion_create_local_credit_order_for_customer(
  p_linked_customer_id text,
  p_customer_name text,
  p_customer_email text,
  p_customer_phone text,
  p_sold_on date,
  p_categories jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer_id uuid;
  v_name text := nullif(btrim(coalesce(p_customer_name, '')), '');
begin
  if not ((select private.is_pricing_admin()) or (select private.is_commerce_admin())) then
    raise exception 'Acceso no autorizado' using errcode = '42501';
  end if;
  if nullif(btrim(coalesce(p_linked_customer_id, '')), '') is null
    or v_name is null or char_length(v_name) > 160 then
    raise exception 'Elegí un cliente existente' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'local-credit-customer:' || p_linked_customer_id, 0));
  select id into v_customer_id from public.local_sales_customers
    where linked_customer_id = p_linked_customer_id order by created_at limit 1;
  if v_customer_id is null then
    insert into public.local_sales_customers(
      full_name, email, phone, linked_customer_id, created_by, origin_channel)
    values (v_name, nullif(btrim(coalesce(p_customer_email, '')), ''),
      nullif(btrim(coalesce(p_customer_phone, '')), ''), p_linked_customer_id,
      auth.uid(), 'Local')
    returning id into v_customer_id;
  end if;
  return public.gestion_create_local_credit_order(
    v_customer_id, null, null, p_sold_on, p_categories);
end;
$$;

revoke all on function public.gestion_create_local_credit_order_for_customer(text,text,text,text,date,jsonb)
  from public, anon, authenticated;
grant execute on function public.gestion_create_local_credit_order_for_customer(text,text,text,text,date,jsonb)
  to authenticated;
