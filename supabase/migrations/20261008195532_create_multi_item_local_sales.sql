create or replace function public.create_local_sale_with_items(
  p_customer_id uuid,
  p_sold_on date,
  p_payment_method text,
  p_items jsonb,
  p_deposit_minor bigint
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_sale_id uuid;
  v_sale_number bigint;
  v_created_at timestamptz;
  v_customer_name text := 'Cliente sin registrar';
  v_item jsonb;
  v_variant_id uuid;
  v_quantity integer;
  v_unit_price_minor bigint;
  v_sku text;
  v_product_name text;
  v_variant_name text;
  v_items_total_minor bigint := 0;
  v_charged_total_minor bigint;
begin
  if not ((select private.is_pricing_admin()) or (select private.is_commerce_admin())) then
    raise exception 'Acceso no autorizado' using errcode = '42501';
  end if;

  if p_sold_on is null or p_sold_on > current_date then
    raise exception 'La fecha de venta no es válida' using errcode = '22023';
  end if;
  if p_payment_method not in ('Efectivo', 'Débito', 'Crédito', 'Transferencia', 'Seña') then
    raise exception 'La forma de pago no es válida' using errcode = '22023';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array'
    or jsonb_array_length(p_items) not between 1 and 100 then
    raise exception 'La venta debe incluir entre 1 y 100 productos' using errcode = '22023';
  end if;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    if jsonb_typeof(v_item) <> 'object' then
      raise exception 'Los productos de la venta no son válidos' using errcode = '22023';
    end if;

    v_variant_id := nullif(v_item ->> 'variant_id', '')::uuid;
    v_quantity := (v_item ->> 'quantity')::integer;
    v_unit_price_minor := (v_item ->> 'unit_price_minor')::bigint;

    if v_variant_id is null then
      raise exception 'Falta el producto de una línea' using errcode = '22023';
    end if;
    if v_quantity is null or v_quantity not between 1 and 1000 then
      raise exception 'La cantidad no es válida' using errcode = '22023';
    end if;
    if v_unit_price_minor is null or v_unit_price_minor not between 0 and 1000000000 then
      raise exception 'El precio no es válido' using errcode = '22023';
    end if;

    perform 1
    from public.commerce_variants variant
    join public.commerce_products product on product.id = variant.product_id
    where variant.id = v_variant_id and variant.active;

    if not found then
      raise exception 'Uno de los productos seleccionados no está disponible' using errcode = '22023';
    end if;

    v_items_total_minor := v_items_total_minor + (v_quantity::bigint * v_unit_price_minor);
  end loop;

  if p_payment_method = 'Seña' then
    if p_deposit_minor is null or p_deposit_minor not between 0 and 1000000000 then
      raise exception 'El monto de la seña no es válido' using errcode = '22023';
    end if;
    v_charged_total_minor := p_deposit_minor;
  else
    v_charged_total_minor := v_items_total_minor;
  end if;

  if p_customer_id is not null then
    select customer.full_name into v_customer_name
    from public.local_sales_customers customer
    where customer.id = p_customer_id;
    if not found then
      raise exception 'El cliente seleccionado no existe' using errcode = '22023';
    end if;
  end if;

  insert into public.local_sales (customer_id, customer_name, sold_on, payment_method, total_minor)
  values (p_customer_id, v_customer_name, p_sold_on, p_payment_method, v_charged_total_minor)
  returning id, sale_number, created_at into v_sale_id, v_sale_number, v_created_at;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_variant_id := (v_item ->> 'variant_id')::uuid;
    v_quantity := (v_item ->> 'quantity')::integer;
    v_unit_price_minor := (v_item ->> 'unit_price_minor')::bigint;

    select variant.sku, product.name, variant.name
    into v_sku, v_product_name, v_variant_name
    from public.commerce_variants variant
    join public.commerce_products product on product.id = variant.product_id
    where variant.id = v_variant_id and variant.active;

    insert into public.local_sale_items (
      sale_id, variant_id, sku, product_name, variant_name, quantity, unit_price_minor
    ) values (
      v_sale_id, v_variant_id, v_sku, v_product_name, v_variant_name, v_quantity, v_unit_price_minor
    );
  end loop;

  if p_customer_id is not null then
    update public.local_sales_customers
    set
      first_purchase_date = case
        when first_purchase_date is null or p_sold_on < first_purchase_date then p_sold_on
        else first_purchase_date
      end,
      last_purchase_date = case
        when last_purchase_date is null or p_sold_on > last_purchase_date then p_sold_on
        else last_purchase_date
      end
    where id = p_customer_id;
  end if;

  return jsonb_build_object(
    'id', v_sale_id,
    'sale_number', v_sale_number,
    'created_at', v_created_at,
    'items_total_minor', v_items_total_minor,
    'charged_total_minor', v_charged_total_minor
  );
end;
$$;

revoke all on function public.create_local_sale_with_items(uuid, date, text, jsonb, bigint) from public, anon;
grant execute on function public.create_local_sale_with_items(uuid, date, text, jsonb, bigint) to authenticated;

comment on function public.create_local_sale_with_items(uuid, date, text, jsonb, bigint) is
  'Creates one local sale with multiple catalog items; deposits record the amount charged while preserving full line values.';
