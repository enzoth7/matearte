-- Descuento en artículos personalizados de ventas del local.
-- El precio unitario de la línea se guarda ya descontado (order_items exige total = precio x cantidad).
-- Para los armados (custom_mate) la base valida contra la cotización oficial: ahora acepta la cotización
-- menos item.discount_percent (con 1 centavo de tolerancia por redondeo). Sin descuento, la validación es exacta.
CREATE OR REPLACE FUNCTION public.gestion_create_local_sale_with_items(p_customer_id uuid, p_sold_on date, p_payment_method text, p_items jsonb, p_deposit_minor bigint, p_channel text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_sale_id uuid;
  v_sale_number bigint;
  v_reference_code text;
  v_created_at timestamptz;
  v_customer_name text := 'Cliente sin registrar';
  v_item jsonb;
  v_variant_id uuid;
  v_quantity integer;
  v_unit_price_minor bigint;
  v_customization jsonb;
  v_notes text;
  v_quote jsonb;
  v_custom boolean;
  v_sku text;
  v_product_name text;
  v_variant_name text;
  v_items_total_minor bigint := 0;
  v_charged_total_minor bigint;
  v_discount numeric;
begin
  if not ((select private.is_pricing_admin()) or (select private.is_commerce_admin())) then
    raise exception 'Acceso no autorizado' using errcode = '42501';
  end if;
  if p_channel not in ('Local', 'Feria', 'WhatsApp', 'Facebook', 'Instagram') or p_channel is null then
    raise exception 'El canal no es válido' using errcode = '22023';
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
    v_customization := nullif(v_item -> 'customization', 'null'::jsonb);
    v_notes := nullif(btrim(coalesce(v_item ->> 'production_notes', '')), '');
    v_discount := coalesce(nullif(v_item ->> 'discount_percent', '')::numeric, 0);
    if v_discount < 0 or v_discount > 100 then
      raise exception 'El descuento tiene que estar entre 0%% y 100%%' using errcode = '22023';
    end if;
    if v_discount > 0 and v_customization is null then
      raise exception 'El descuento solo aplica a artículos personalizados' using errcode = '22023';
    end if;
    if v_notes is not null and char_length(v_notes) > 1000 then
      raise exception 'Las notas de producción son demasiado largas' using errcode = '22023';
    end if;
    v_custom := coalesce(v_item->>'item_kind','catalog')='custom_mate';
    if coalesce(v_item->>'item_kind','catalog') not in ('catalog','custom_mate') then raise exception 'Tipo de línea inválido' using errcode='22023'; end if;
    if v_custom then
      if v_variant_id is not null or v_customization is null then raise exception 'El armado debe guardarse sin SKU' using errcode='22023'; end if;
      v_quote:=public.gestion_quote_mate_assembly(v_customization->'assembly'->'selections',v_customization);
      if v_quote->>'versionId' is distinct from v_customization->'localPricing'->>'versionId'
        or (case when v_discount = 0 then v_unit_price_minor is distinct from (v_quote->>'totalMinor')::bigint
                 else abs(v_unit_price_minor - round((v_quote->>'totalMinor')::numeric * (1 - v_discount / 100))::bigint) > 1 end)
      then raise exception 'Las tarifas cambiaron. Actualizá los precios del armado antes de guardar.' using errcode='22023'; end if;
    end if;
    if not v_custom and v_variant_id is null then
      raise exception 'Falta el producto de una línea' using errcode = '22023';
    end if;
    if v_quantity is null or v_quantity not between 1 and 1000 then
      raise exception 'La cantidad no es válida' using errcode = '22023';
    end if;
    if v_unit_price_minor is null or v_unit_price_minor not between 0 and 1000000000 then
      raise exception 'El precio no es válido' using errcode = '22023';
    end if;
    if v_customization is not null and jsonb_typeof(v_customization) <> 'object' then
      raise exception 'La personalización no es válida' using errcode = '22023';
    end if;
    if not v_custom then
    perform 1
      from public.commerce_variants variant
      join public.commerce_products product on product.id = variant.product_id
      where variant.id = v_variant_id and variant.available_local;
    if not found then
      raise exception 'Uno de los productos seleccionados no está disponible' using errcode = '22023';
    end if;
    end if;
    if v_notes is not null and not exists (
      select 1 from public.commerce_variants variant
      join public.commerce_products product on product.id = variant.product_id
      where variant.id = v_variant_id and coalesce(product.category_code, product.category) = 'servicios'
    ) then
      raise exception 'Las notas de producción solo aplican a servicios' using errcode = '22023';
    end if;
    v_items_total_minor := v_items_total_minor + (v_quantity::bigint * v_unit_price_minor);
  end loop;

  if p_payment_method = 'Seña' and p_deposit_minor is null then raise exception 'El monto de la seña no es válido' using errcode = '22023'; end if; if p_deposit_minor is not null then
    if p_deposit_minor not between 1 and least(v_items_total_minor, 1000000000) then
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

  insert into public.local_sales
    (customer_id, customer_name, sold_on, payment_method, total_minor, channel, deposit_minor)
  values
    (p_customer_id, v_customer_name, p_sold_on, p_payment_method, v_charged_total_minor, p_channel, p_deposit_minor)
  returning id, sale_number, reference_code, created_at
    into v_sale_id, v_sale_number, v_reference_code, v_created_at;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_variant_id := (v_item ->> 'variant_id')::uuid;
    v_quantity := (v_item ->> 'quantity')::integer;
    v_unit_price_minor := (v_item ->> 'unit_price_minor')::bigint;
    v_customization := nullif(v_item -> 'customization', 'null'::jsonb);
    v_notes := nullif(btrim(coalesce(v_item ->> 'production_notes', '')), '');
    if v_item->>'item_kind'='custom_mate' then
      v_quote:=public.gestion_quote_mate_assembly(v_customization->'assembly'->'selections',v_customization);
      v_sku:=null; v_product_name:=v_quote->>'name'; v_variant_name:=v_quote->>'summary';
      v_customization:=v_customization || jsonb_build_object('itemKind','custom_mate','assembly',v_customization->'assembly'||jsonb_build_object('labels',v_quote->'labels'),
        'localPricing',jsonb_build_object('source','published-personalizer','versionId',v_quote->>'versionId','version',v_quote->'version','baseUnitPriceMinor',v_quote->'baseMinor','extrasUnitPriceMinor',v_quote->'extrasMinor','assemblyItems',v_quote->'baseItems','items',v_quote->'extrasItems'));
    else
    select variant.sku, product.name, variant.name
      into v_sku, v_product_name, v_variant_name
      from public.commerce_variants variant
      join public.commerce_products product on product.id = variant.product_id
      where variant.id = v_variant_id and variant.available_local;
    end if;
    insert into public.local_sale_items
      (sale_id, variant_id, sku, product_name, variant_name, quantity, unit_price_minor, customization, production_notes)
    values
      (v_sale_id, v_variant_id, v_sku, v_product_name, v_variant_name,
       v_quantity, v_unit_price_minor, v_customization, v_notes);
  end loop;

  if p_customer_id is not null then
    update public.local_sales_customers
    set first_purchase_date = case
          when first_purchase_date is null or p_sold_on < first_purchase_date then p_sold_on
          else first_purchase_date end,
        last_purchase_date = case
          when last_purchase_date is null or p_sold_on > last_purchase_date then p_sold_on
          else last_purchase_date end
    where id = p_customer_id;
  end if;

  return jsonb_build_object(
    'id', v_sale_id,
    'sale_number', v_sale_number,
    'reference_code', v_reference_code,
    'created_at', v_created_at,
    'items_total_minor', v_items_total_minor,
    'charged_total_minor', v_charged_total_minor
  );
end;
$function$;
