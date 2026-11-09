-- Las altas de Fiados Local necesitan una clave de reintento porque la función
-- original crea un pedido nuevo cada vez que se la invoca.
create table private.gestion_mcp_local_credit_requests (
  request_id uuid primary key,
  user_id uuid not null references auth.users(id),
  payload_hash text not null,
  order_id uuid not null references public.orders(id),
  created_at timestamptz not null default now()
);
revoke all on private.gestion_mcp_local_credit_requests from public, anon, authenticated;

create function public.gestion_mcp_create_local_credit_order(
  p_request_id uuid, p_customer_id uuid, p_linked_customer_id text,
  p_customer_name text, p_customer_email text, p_customer_phone text,
  p_sold_on date, p_categories jsonb
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_hash text;
  v_previous private.gestion_mcp_local_credit_requests%rowtype;
  v_order_id uuid;
begin
  perform private.require_internal_staff();
  if auth.uid() is distinct from '5afbc94d-aecf-44e8-b12e-e136f49abb62'::uuid then
    raise insufficient_privilege using message = 'Solo Richard puede registrar fiados desde el MCP';
  end if;
  if p_request_id is null or p_sold_on is null or
     ((p_customer_id is not null)::integer +
      (p_linked_customer_id is not null)::integer +
      (p_customer_id is null and p_linked_customer_id is null and nullif(btrim(p_customer_name), '') is not null)::integer) <> 1 then
    raise exception 'Elegí exactamente un cliente existente o uno nuevo' using errcode = '22023';
  end if;
  if p_linked_customer_id is not null and nullif(btrim(p_customer_name), '') is null then
    raise exception 'El cliente vinculado necesita nombre' using errcode = '22023';
  end if;
  v_hash := md5(jsonb_build_array(p_customer_id, p_linked_customer_id, p_customer_name,
    p_customer_email, p_customer_phone, p_sold_on, p_categories)::text);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('mcp-local-credit:' || p_request_id::text, 0));
  select * into v_previous from private.gestion_mcp_local_credit_requests where request_id = p_request_id;
  if found then
    if v_previous.user_id is distinct from auth.uid() or v_previous.payload_hash <> v_hash then
      raise exception 'La clave ya corresponde a otro pedido' using errcode = '23505';
    end if;
    return jsonb_build_object('order_id', v_previous.order_id, 'already_created', true);
  end if;
  if p_linked_customer_id is not null then
    v_order_id := public.gestion_create_local_credit_order_for_customer(
      p_linked_customer_id, p_customer_name, p_customer_email, p_customer_phone,
      p_sold_on, p_categories);
  else
    v_order_id := public.gestion_create_local_credit_order(
      p_customer_id, case when p_customer_id is null then p_customer_name else null end,
      case when p_customer_id is null then p_customer_phone else null end,
      p_sold_on, p_categories);
  end if;
  insert into private.gestion_mcp_local_credit_requests(request_id, user_id, payload_hash, order_id)
    values (p_request_id, auth.uid(), v_hash, v_order_id);
  return jsonb_build_object('order_id', v_order_id, 'already_created', false);
end;
$$;
revoke all on function public.gestion_mcp_create_local_credit_order(uuid,uuid,text,text,text,text,date,jsonb)
  from public, anon, authenticated;
grant execute on function public.gestion_mcp_create_local_credit_order(uuid,uuid,text,text,text,text,date,jsonb)
  to authenticated;

-- El vínculo de producto e insumos se guarda en una transacción de la base.
create function public.gestion_mcp_save_manufactured_product(
  p_id uuid, p_catalog_product_id uuid, p_reference_cost_minor bigint, p_supplies jsonb
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_catalog public.commerce_products%rowtype;
  v_existing public.inventory_manufactured_products%rowtype;
  v_supply jsonb;
  v_ids uuid[] := '{}';
  v_line_id uuid;
  v_quantity numeric;
begin
  perform private.require_internal_staff();
  if auth.uid() is distinct from '5afbc94d-aecf-44e8-b12e-e136f49abb62'::uuid then
    raise insufficient_privilege using message = 'Solo Richard puede guardar costos desde el MCP';
  end if;
  if p_id is null or p_catalog_product_id is null or p_reference_cost_minor < 0 or
    jsonb_typeof(p_supplies) is distinct from 'array' or jsonb_array_length(p_supplies) > 100 then
    raise exception 'Revisá producto, costo e insumos' using errcode = '22023';
  end if;
  select * into v_catalog from public.commerce_products where id = p_catalog_product_id;
  if not found or nullif(btrim(v_catalog.category_code), '') is null then
    raise exception 'El producto de catálogo no existe o no tiene categoría' using errcode = '22023';
  end if;
  select * into v_existing from public.inventory_manufactured_products where id = p_id for update;
  if found and v_existing.catalog_product_id is distinct from p_catalog_product_id then
    raise exception 'El identificador ya corresponde a otro producto' using errcode = '23505';
  end if;
  for v_supply in select value from jsonb_array_elements(p_supplies) loop
    v_line_id := (v_supply->>'cost_line_id')::uuid;
    v_quantity := (v_supply->>'quantity')::numeric;
    if v_line_id is null or v_line_id = any(v_ids) or v_quantity <= 0 or v_quantity > 100000 then
      raise exception 'Revisá los insumos y sus cantidades' using errcode = '22023';
    end if;
    v_ids := array_append(v_ids, v_line_id);
    if not exists (
      select 1 from public.inventory_cost_lines line
      join public.inventory_cost_profiles profile on profile.id = line.profile_id
      where line.id = v_line_id and profile.category_code = v_catalog.category_code
        and line.kind in ('material', 'supply')
    ) then raise exception 'El insumo no corresponde a la categoría' using errcode = '22023'; end if;
  end loop;
  insert into public.inventory_manufactured_products
    (id, name, category_code, catalog_product_id, reference_variable_cost_minor)
  values (p_id, v_catalog.name, v_catalog.category_code, p_catalog_product_id, p_reference_cost_minor)
  on conflict (id) do update set
    catalog_product_id = excluded.catalog_product_id,
    category_code = excluded.category_code,
    name = case when public.inventory_manufactured_products.source_key is null
      then excluded.name else public.inventory_manufactured_products.name end,
    reference_variable_cost_minor = coalesce(excluded.reference_variable_cost_minor,
      public.inventory_manufactured_products.reference_variable_cost_minor),
    updated_at = now();
  delete from public.inventory_manufactured_supplies
    where product_id = p_id and not (cost_line_id = any(v_ids));
  for v_supply in select value from jsonb_array_elements(p_supplies) loop
    insert into public.inventory_manufactured_supplies(product_id, cost_line_id, quantity)
    values (p_id, (v_supply->>'cost_line_id')::uuid, (v_supply->>'quantity')::numeric)
    on conflict (product_id, cost_line_id) do update set quantity = excluded.quantity;
  end loop;
  return jsonb_build_object('id', p_id, 'catalog_product_id', p_catalog_product_id,
    'supplies_count', array_length(v_ids, 1));
end;
$$;
revoke all on function public.gestion_mcp_save_manufactured_product(uuid,uuid,bigint,jsonb)
  from public, anon, authenticated;
grant execute on function public.gestion_mcp_save_manufactured_product(uuid,uuid,bigint,jsonb)
  to authenticated;

-- La credencial OAuth solo puede usar operaciones enumeradas y firmadas por
-- gestion-mcp. Los permisos RLS y las comprobaciones internas siguen vigentes.
create or replace function public.gestion_data_api_access()
returns void language plpgsql security definer set search_path = '' as $$
declare
  route text := current_setting('request.path', true);
  method text := current_setting('request.method', true);
  richard boolean := auth.uid() = '5afbc94d-aecf-44e8-b12e-e136f49abb62'::uuid;
begin
  if not private.gestion_is_oauth_session() then return; end if;
  if private.gestion_mcp_signed_request() and (
    (method in ('GET', 'HEAD') and route in (
      '/orders', '/order_items', '/ad_reports', '/local_sales', '/local_sale_items', '/local_sale_receipts',
      '/commerce_payments', '/commerce_bank_transfer_receipts', '/order_lines', '/commerce_products',
      '/commerce_variants', '/commerce_product_images', '/local_sales_customers', '/customers',
      '/rural_raffle_entries', '/purchases', '/fixed_expenses', '/fixed_expense_payments', '/expense_categories',
      '/shipping_rates', '/commerce_international_shipping_rates', '/commerce_exchange_rates', '/settings',
      '/commerce_discounts', '/commerce_categories', '/commerce_attribute_definitions', '/commerce_attribute_options',
      '/commerce_category_attributes', '/site_announcements', '/commerce_admin_users', '/commerce_settings',
      '/commerce_bank_transfer_settings', '/finance_income_categories', '/finance_manual_incomes',
      '/finance_monthly_openings', '/finance_monthly_adjustments', '/finance_accounts', '/finance_monthly_closes',
      '/contacts', '/customer_account_receipts', '/customer_account_allocations', '/wholesale_order_receipts',
      '/wholesale_order_payment_openings', '/wholesale_consignments', '/wholesale_consignment_lines',
      '/wholesale_consignment_movements', '/wholesale_consignment_allocations', '/inventory_cost_profiles',
      '/inventory_cost_lines', '/inventory_manufactured_products', '/inventory_manufactured_supplies'
    ))
    or (method = 'POST' and route in ('/rpc/gestion_customer_profile_details_full', '/rpc/gestion_web_leads'))
    or (richard and (
      (method = 'POST' and route in (
        '/purchases', '/fixed_expenses', '/fixed_expense_payments', '/expense_categories',
        '/finance_income_categories', '/finance_manual_incomes', '/finance_monthly_openings',
        '/finance_monthly_adjustments', '/inventory_cost_profiles', '/inventory_cost_lines',
        '/commerce_exchange_rates', '/rpc/gestion_mcp_create_catalog_product',
        '/rpc/gestion_record_wholesale_payment', '/rpc/gestion_record_local_sale_payment',
        '/rpc/gestion_record_customer_account_receipt', '/rpc/gestion_allocate_customer_account_receipt',
        '/rpc/gestion_mcp_create_local_credit_order', '/rpc/gestion_create_wholesale_consignment',
        '/rpc/gestion_record_wholesale_consignment_movement',
        '/rpc/gestion_record_wholesale_consignment_payment',
        '/rpc/gestion_allocate_wholesale_consignment_receipt',
        '/rpc/gestion_mcp_save_manufactured_product'
      )) or (method = 'PATCH' and route = '/settings')
    ))
  ) then return; end if;
  raise insufficient_privilege using message = 'Usá las herramientas del MCP con esta credencial.';
end;
$$;
notify pgrst, 'reload config';
