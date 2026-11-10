-- Una consignación parte de un pedido mayorista existente y conserva sus precios.
alter table public.wholesale_consignment_lines
  drop constraint wholesale_consignment_lines_unit_price_arg_minor_check;
alter table public.wholesale_consignment_lines
  add constraint wholesale_consignment_lines_unit_price_arg_minor_check
  check (unit_price_arg_minor >= 0);

create function public.gestion_link_wholesale_consignment(p_id uuid, p_order_id uuid)
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
  if p_id is null or p_order_id is null then
    raise exception 'Elegí un pedido mayorista' using errcode = '22023';
  end if;
  select * into v_previous from public.wholesale_consignments where id = p_id;
  if found then
    if v_previous.order_id = p_order_id then
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
      or v_line.quantity is null or v_line.quantity <= 0 or v_line.total_arg is null
      or v_line.total_arg < 0 or v_line.exchange_rate is null or v_line.exchange_rate <= 0 then
      raise exception 'Las líneas del pedido necesitan SKU, precio ARS y cotización guardados' using errcode = '22023';
    end if;
    if v_rate is null then v_rate := v_line.exchange_rate;
    elsif v_rate <> v_line.exchange_rate then
      raise exception 'Las líneas del pedido tienen cotizaciones diferentes' using errcode = '22023';
    end if;
    v_price_minor := v_line.total_arg * 100 / v_line.quantity;
    if v_price_minor <> trunc(v_price_minor) or v_price_minor > 9223372036854775807 then
      raise exception 'El precio ARS del pedido no se puede repartir por unidad' using errcode = '22023';
    end if;
  end loop;
  if v_count = 0 then raise exception 'El pedido mayorista no tiene productos' using errcode = '22023'; end if;
  insert into public.wholesale_consignments(id, order_id, contact_id, exchange_rate, created_by)
  values (p_id, p_order_id, v_order.contact_id, v_rate, auth.uid());
  insert into public.wholesale_consignment_lines
    (consignment_id, order_item_id, variant_id, sku, title, quantity, unit_price_arg_minor)
  select p_id, i.id, i.source_variant_id, i.sku, i.title, i.quantity,
    (i.total_arg * 100 / i.quantity)::bigint
  from public.order_items i where i.order_id = p_order_id;
  update public.orders set customer_snapshot = coalesce(customer_snapshot, '{}'::jsonb)
    || jsonb_build_object('purchaseFlow', 'consignment') where id = p_order_id;
  return jsonb_build_object('id', p_id, 'order_id', p_order_id, 'reference_code', v_order.reference_code);
end;
$$;
revoke all on function public.gestion_link_wholesale_consignment(uuid,uuid) from public, anon;
grant execute on function public.gestion_link_wholesale_consignment(uuid,uuid) to authenticated;

-- El cobro ordinario de un pedido consignado duplicaría el cargo confirmado.
create function private.guard_wholesale_consignment_collection()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.wholesale_consignments where order_id = new.sale_id) then
    raise exception 'Registrá el pago desde la cuenta de la consignación' using errcode = '22023';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_wholesale_consignment_collection() from public, anon, authenticated;
create trigger wholesale_receipt_consignment_guard before insert on public.wholesale_order_receipts
  for each row execute function private.guard_wholesale_consignment_collection();

create function private.guard_wholesale_consignment_allocation()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.wholesale_consignments where order_id = new.order_id) then
    raise exception 'Asigná el cobro desde la consignación' using errcode = '22023';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_wholesale_consignment_allocation() from public, anon, authenticated;
create trigger wholesale_allocation_consignment_guard before insert or update of order_id on public.customer_account_allocations
  for each row execute function private.guard_wholesale_consignment_allocation();

notify pgrst, 'reload schema';

-- Permitir que el conector de Richard vincule pedidos existentes.
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
        '/rpc/gestion_mcp_create_local_credit_order', '/rpc/gestion_create_wholesale_consignment', '/rpc/gestion_link_wholesale_consignment',
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

