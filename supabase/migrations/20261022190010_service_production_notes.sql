-- Notas para producción: campo propio de las líneas de servicios en ventas de Local.
-- local_sale_items es una vista sobre order_items; la nota vive en immutable_snapshot->'productionNotes'.
create or replace view public.local_sale_items with (security_invoker = true) as
 SELECT id,
    order_id AS sale_id,
    source_variant_id AS variant_id,
    COALESCE(sku, ''::text) AS sku,
    COALESCE(immutable_snapshot ->> 'productName'::text, split_part(title, ' — '::text, 1)) AS product_name,
    COALESCE(immutable_snapshot ->> 'variantName'::text, split_part(title, ' — '::text, 2)) AS variant_name,
    quantity,
    unit_price_minor,
    total_minor AS line_total_minor,
    created_at,
    production_status,
    immutable_snapshot -> 'customization'::text AS customization,
    immutable_snapshot ->> 'productionNotes'::text AS production_notes
   FROM order_items i
  WHERE (EXISTS ( SELECT 1
           FROM orders o
          WHERE o.id = i.order_id AND (o.channel = ANY (ARRAY['Local'::text, 'Feria'::text, 'WhatsApp'::text, 'Instagram'::text, 'Facebook'::text]))));

create or replace function private.local_sale_items_write()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare v_channel text;
begin
  perform private.require_internal_staff();
  if tg_op = 'DELETE' then raise exception 'Los ítems de una venta no se eliminan desde aquí' using errcode = '42501'; end if;
  if tg_op = 'UPDATE' then
    update public.order_items set production_status = new.production_status,
      immutable_snapshot = case when new.customization is distinct from old.customization
        then immutable_snapshot || jsonb_build_object('customization', new.customization) else immutable_snapshot end
    where id = old.id;
    return new;
  end if;
  select channel into v_channel from public.orders where id = new.sale_id;
  if v_channel is null or v_channel not in ('Local', 'Feria', 'WhatsApp', 'Facebook', 'Instagram') then
    raise exception 'La venta no existe' using errcode = '22023';
  end if;
  if not exists (select 1 from public.commerce_variants variant where variant.id = new.variant_id and variant.active and variant.available_local) then
    raise exception 'La variante ya no está disponible en Local' using errcode = '22023';
  end if;
  if v_channel <> 'Local' and exists (select 1 from public.commerce_variants variant join public.commerce_products product on product.id = variant.product_id
      where variant.id = new.variant_id and coalesce(product.category_code, product.category) = 'servicios') then
    raise exception 'Los servicios solo se registran en Local' using errcode = '22023';
  end if;
  new.id := coalesce(new.id, gen_random_uuid());
  new.production_status := coalesce(new.production_status, 'pending');
  new.created_at := coalesce(new.created_at, now());
  new.line_total_minor := new.unit_price_minor * new.quantity;
  insert into public.order_items (id, order_id, item_type, source_variant_id, sku, title, quantity, unit_price_minor, total_minor,
    immutable_snapshot, requires_review, created_at, production_status)
  values (new.id, new.sale_id, 'catalog', new.variant_id, new.sku, new.product_name || ' — ' || new.variant_name, new.quantity,
    new.unit_price_minor, new.line_total_minor,
    jsonb_build_object('source', 'local', 'productName', new.product_name, 'variantName', new.variant_name)
      || case when new.customization is not null then jsonb_build_object('customization', new.customization) else '{}'::jsonb end
      || case when new.production_notes is not null then jsonb_build_object('productionNotes', new.production_notes) else '{}'::jsonb end,
    false, new.created_at, new.production_status);
  return new;
end $function$;

create or replace function public.gestion_create_local_sale_with_items(
  p_customer_id uuid,
  p_sold_on date,
  p_payment_method text,
  p_items jsonb,
  p_deposit_minor bigint,
  p_channel text
)
returns jsonb
language plpgsql
set search_path = ''
as $$
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
  v_sku text;
  v_product_name text;
  v_variant_name text;
  v_items_total_minor bigint := 0;
  v_charged_total_minor bigint;
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
    v_customization := v_item -> 'customization';
    v_notes := nullif(btrim(coalesce(v_item ->> 'production_notes', '')), '');
    if v_notes is not null and char_length(v_notes) > 1000 then
      raise exception 'Las notas de producción son demasiado largas' using errcode = '22023';
    end if;
    if v_variant_id is null then
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
    perform 1
      from public.commerce_variants variant
      join public.commerce_products product on product.id = variant.product_id
      where variant.id = v_variant_id and variant.active;
    if not found then
      raise exception 'Uno de los productos seleccionados no está disponible' using errcode = '22023';
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

  insert into public.local_sales
    (customer_id, customer_name, sold_on, payment_method, total_minor, channel)
  values
    (p_customer_id, v_customer_name, p_sold_on, p_payment_method, v_charged_total_minor, p_channel)
  returning id, sale_number, reference_code, created_at
    into v_sale_id, v_sale_number, v_reference_code, v_created_at;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_variant_id := (v_item ->> 'variant_id')::uuid;
    v_quantity := (v_item ->> 'quantity')::integer;
    v_unit_price_minor := (v_item ->> 'unit_price_minor')::bigint;
    v_customization := v_item -> 'customization';
    v_notes := nullif(btrim(coalesce(v_item ->> 'production_notes', '')), '');
    select variant.sku, product.name, variant.name
      into v_sku, v_product_name, v_variant_name
      from public.commerce_variants variant
      join public.commerce_products product on product.id = variant.product_id
      where variant.id = v_variant_id and variant.active;
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
$$;

revoke all on function public.gestion_create_local_sale_with_items(uuid, date, text, jsonb, bigint, text)
  from public, anon;
grant execute on function public.gestion_create_local_sale_with_items(uuid, date, text, jsonb, bigint, text)
  to authenticated;
