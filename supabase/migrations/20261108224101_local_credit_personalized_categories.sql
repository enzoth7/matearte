create or replace function public.gestion_create_local_credit_order(
  p_customer_id uuid,
  p_new_customer_name text,
  p_new_customer_phone text,
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
  v_customer_name text;
  v_sale_id uuid;
  v_item jsonb;
  v_category_code text;
  v_category_label text;
  v_amount bigint;
begin
  if not ((select private.is_pricing_admin()) or (select private.is_commerce_admin())) then
    raise exception 'Acceso no autorizado' using errcode = '42501';
  end if;
  if p_sold_on is null or p_sold_on > current_date then
    raise exception 'La fecha del pedido no es válida' using errcode = '22023';
  end if;
  if p_categories is null or jsonb_typeof(p_categories) <> 'array'
    or jsonb_array_length(p_categories) not between 1 and 30 then
    raise exception 'Agregá al menos una categoría' using errcode = '22023';
  end if;
  for v_item in select value from jsonb_array_elements(p_categories) loop
    if jsonb_typeof(v_item) <> 'object' then
      raise exception 'La categoría no es válida' using errcode = '22023';
    end if;
    v_category_code := v_item->>'category_code';
    v_category_label := case v_category_code
      when 'mates-personalizados' then 'Mates personalizados'
      when 'bombillas-personalizadas' then 'Bombillas personalizadas'
      when 'materas-personalizadas' then 'Materas personalizadas'
      else null end;
    if v_category_label is null then
      select label_es into v_category_label from public.commerce_categories
        where code = v_category_code and active;
    end if;
    if v_category_label is null then
      raise exception 'La categoría seleccionada no está activa' using errcode = '22023';
    end if;
    v_amount := nullif(v_item->>'amount_minor', '')::bigint;
    if v_amount is null or v_amount <= 0 or v_amount > 1000000000 then
      raise exception 'El importe de la categoría no es válido' using errcode = '22023';
    end if;
  end loop;

  if p_customer_id is not null then
    if nullif(btrim(coalesce(p_new_customer_name, '')), '') is not null then
      raise exception 'Elegí un cliente existente o creá uno nuevo' using errcode = '22023';
    end if;
    select id, full_name into v_customer_id, v_customer_name
      from public.local_sales_customers where id = p_customer_id;
    if not found then raise exception 'El cliente no existe' using errcode = '22023'; end if;
  else
    v_customer_name := nullif(btrim(coalesce(p_new_customer_name, '')), '');
    if v_customer_name is null or char_length(v_customer_name) > 160 then
      raise exception 'Ingresá el nombre del cliente' using errcode = '22023';
    end if;
    insert into public.local_sales_customers(full_name, phone, created_by, origin_channel)
      values (v_customer_name, nullif(btrim(coalesce(p_new_customer_phone, '')), ''), auth.uid(), 'Local')
      returning id into v_customer_id;
  end if;

  insert into public.local_sales(customer_id, customer_name, sold_on, payment_method,
      total_minor, deposit_minor, channel)
    values (v_customer_id, v_customer_name, p_sold_on, 'Cuenta corriente', 0, 0, 'Local')
    returning id into v_sale_id;

  for v_item in select value from jsonb_array_elements(p_categories) loop
    v_category_code := v_item->>'category_code';
    v_category_label := case v_category_code
      when 'mates-personalizados' then 'Mates personalizados'
      when 'bombillas-personalizadas' then 'Bombillas personalizadas'
      when 'materas-personalizadas' then 'Materas personalizadas'
      else null end;
    if v_category_label is null then
      select label_es into v_category_label from public.commerce_categories
        where code = v_category_code and active;
    end if;
    v_amount := (v_item->>'amount_minor')::bigint;
    insert into public.order_items(order_id, item_type, title, quantity, unit_price_minor,
      total_minor, immutable_snapshot, requires_review, production_status)
    values (v_sale_id, 'catalog', v_category_label, 1, v_amount, v_amount,
      jsonb_build_object('source', 'local_credit_category', 'productName', v_category_label,
        'categoryCode', v_category_code), false, 'completed');
  end loop;

  update public.orders set customer_snapshot = customer_snapshot ||
    jsonb_build_object('localCreditCategoryOnly', true)
    where id = v_sale_id;

  update public.local_sales_customers
    set first_purchase_date = least(coalesce(first_purchase_date, p_sold_on), p_sold_on),
        last_purchase_date = greatest(coalesce(last_purchase_date, p_sold_on), p_sold_on)
    where id = v_customer_id;
  return v_sale_id;
end;
$$;
