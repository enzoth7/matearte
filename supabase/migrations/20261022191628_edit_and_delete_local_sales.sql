-- Corregir o eliminar ventas internas (Local, Feria, WhatsApp, Instagram, Facebook).
-- El canal y la referencia no se editan: la referencia depende del canal.

create or replace function private.refresh_local_customer_purchase_dates(p_contact_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.local_sales_customers customer
  set first_purchase_date = purchase.first_on, last_purchase_date = purchase.last_on
  from (
    select min(o.sold_on) first_on, max(o.sold_on) last_on
    from public.orders o
    where o.contact_id = p_contact_id
      and o.channel in ('Local', 'Feria', 'WhatsApp', 'Facebook', 'Instagram')
  ) purchase
  where customer.id = p_contact_id and p_contact_id is not null;
$$;

create or replace function public.gestion_update_local_sale(
  p_sale_id uuid,
  p_customer_id uuid,
  p_sold_on date,
  p_payment_method text,
  p_deposit_minor bigint,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_customer_name text := 'Cliente sin registrar';
  v_item jsonb;
  v_item_id uuid;
  v_quantity integer;
  v_price bigint;
  v_notes text;
  v_kept uuid[] := array[]::uuid[];
  v_items_total bigint := 0;
  v_charged bigint;
begin
  perform private.require_internal_staff();
  select * into v_order from public.orders
    where id = p_sale_id
      and channel in ('Local', 'Feria', 'WhatsApp', 'Facebook', 'Instagram')
      and status = 'internal_completed'
    for update;
  if not found then raise exception 'La venta no existe o no se puede modificar' using errcode = '22023'; end if;
  if p_sold_on is null or p_sold_on > current_date then raise exception 'La fecha de venta no es válida' using errcode = '22023'; end if;
  if p_payment_method is null or p_payment_method not in ('Efectivo', 'Débito', 'Crédito', 'Transferencia', 'Seña') then
    raise exception 'La forma de pago no es válida' using errcode = '22023';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 100 then
    raise exception 'La venta debe conservar al menos un producto' using errcode = '22023';
  end if;

  for v_item in select value from jsonb_array_elements(p_items) loop
    v_item_id := nullif(v_item ->> 'id', '')::uuid;
    v_quantity := (v_item ->> 'quantity')::integer;
    v_price := (v_item ->> 'unit_price_minor')::bigint;
    v_notes := nullif(btrim(coalesce(v_item ->> 'production_notes', '')), '');
    if not exists (select 1 from public.order_items where id = v_item_id and order_id = p_sale_id) then
      raise exception 'Una línea no pertenece a esta venta' using errcode = '22023';
    end if;
    if v_item_id = any(v_kept) then raise exception 'Línea repetida' using errcode = '22023'; end if;
    if v_quantity is null or v_quantity not between 1 and 1000 then raise exception 'La cantidad no es válida' using errcode = '22023'; end if;
    if v_price is null or v_price not between 0 and 1000000000 then raise exception 'El precio no es válido' using errcode = '22023'; end if;
    if v_notes is not null and char_length(v_notes) > 1000 then raise exception 'Las notas de producción son demasiado largas' using errcode = '22023'; end if;
    if v_notes is not null and not exists (
      select 1 from public.order_items i
      join public.commerce_variants variant on variant.id = i.source_variant_id
      join public.commerce_products product on product.id = variant.product_id
      where i.id = v_item_id and coalesce(product.category_code, product.category) = 'servicios'
    ) then raise exception 'Las notas de producción solo aplican a servicios' using errcode = '22023'; end if;
    v_kept := v_kept || v_item_id;
    v_items_total := v_items_total + v_quantity::bigint * v_price;
  end loop;

  if p_payment_method = 'Seña' then
    if p_deposit_minor is null or p_deposit_minor not between 0 and v_items_total then
      raise exception 'El monto de la seña no es válido' using errcode = '22023';
    end if;
    v_charged := p_deposit_minor;
  else
    v_charged := v_items_total;
  end if;

  if p_customer_id is not null then
    select customer.full_name into v_customer_name from public.local_sales_customers customer where customer.id = p_customer_id;
    if not found then raise exception 'El cliente seleccionado no existe' using errcode = '22023'; end if;
  end if;

  -- Las líneas omitidas se eliminan; las conservadas actualizan cantidad, precio y nota.
  delete from public.order_items where order_id = p_sale_id and id <> all(v_kept);
  for v_item in select value from jsonb_array_elements(p_items) loop
    v_notes := nullif(btrim(coalesce(v_item ->> 'production_notes', '')), '');
    update public.order_items
    set quantity = (v_item ->> 'quantity')::integer,
        unit_price_minor = (v_item ->> 'unit_price_minor')::bigint,
        total_minor = (v_item ->> 'quantity')::integer * (v_item ->> 'unit_price_minor')::bigint,
        immutable_snapshot = case
          when v_notes is not null then immutable_snapshot || jsonb_build_object('productionNotes', v_notes)
          else immutable_snapshot - 'productionNotes' end
    where id = (v_item ->> 'id')::uuid;
  end loop;

  update public.orders
  set customer_name = v_customer_name,
      contact_id = (select id from public.contacts where id = p_customer_id),
      customer_snapshot = case when p_customer_id is null then customer_snapshot - 'localCustomerId'
        else customer_snapshot || jsonb_build_object('localCustomerId', p_customer_id) end,
      sold_on = p_sold_on,
      payment_method = p_payment_method,
      items_subtotal_minor = v_charged,
      total_minor = v_charged,
      deposit_minor = case when p_payment_method = 'Seña' then v_charged end
  where id = p_sale_id;

  perform private.refresh_local_customer_purchase_dates(v_order.contact_id);
  perform private.refresh_local_customer_purchase_dates((select id from public.contacts where id = p_customer_id));

  return jsonb_build_object('id', p_sale_id, 'items_total_minor', v_items_total, 'charged_total_minor', v_charged);
end;
$$;

create or replace function public.gestion_delete_local_sale(p_sale_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_contact uuid;
begin
  perform private.require_internal_staff();
  select contact_id into v_contact from public.orders
    where id = p_sale_id
      and channel in ('Local', 'Feria', 'WhatsApp', 'Facebook', 'Instagram')
      and status = 'internal_completed'
    for update;
  if not found then raise exception 'La venta no existe o no se puede eliminar' using errcode = '22023'; end if;
  delete from public.gestion_customer_contact_history where order_id = p_sale_id;
  delete from public.commerce_payments where order_id = p_sale_id;
  delete from public.order_items where order_id = p_sale_id;
  delete from public.orders where id = p_sale_id;
  perform private.refresh_local_customer_purchase_dates(v_contact);
end;
$$;

revoke all on function private.refresh_local_customer_purchase_dates(uuid) from public, anon, authenticated;
revoke all on function public.gestion_update_local_sale(uuid, uuid, date, text, bigint, jsonb) from public, anon;
grant execute on function public.gestion_update_local_sale(uuid, uuid, date, text, bigint, jsonb) to authenticated;
revoke all on function public.gestion_delete_local_sale(uuid) from public, anon;
grant execute on function public.gestion_delete_local_sale(uuid) to authenticated;
