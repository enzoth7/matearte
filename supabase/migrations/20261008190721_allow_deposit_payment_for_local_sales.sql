alter table public.local_sales
  drop constraint if exists local_sales_payment_method_check;

alter table public.local_sales
  add constraint local_sales_payment_method_check
  check (payment_method in ('Efectivo', 'Débito', 'Crédito', 'Transferencia', 'Seña'));

create or replace function public.create_local_sale(
  p_customer_id uuid,
  p_sold_on date,
  p_payment_method text,
  p_variant_id uuid,
  p_quantity integer,
  p_unit_price_minor bigint
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
  v_sku text;
  v_product_name text;
  v_variant_name text;
  v_total_minor bigint;
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
  if p_quantity is null or p_quantity not between 1 and 1000 then
    raise exception 'La cantidad no es válida' using errcode = '22023';
  end if;
  if p_unit_price_minor is null or p_unit_price_minor not between 0 and 1000000000 then
    raise exception 'El precio no es válido' using errcode = '22023';
  end if;

  select variant.sku, product.name, variant.name
  into v_sku, v_product_name, v_variant_name
  from public.commerce_variants variant
  join public.commerce_products product on product.id = variant.product_id
  where variant.id = p_variant_id and variant.active;

  if not found then
    raise exception 'El producto seleccionado no está disponible' using errcode = '22023';
  end if;

  if p_customer_id is not null then
    select customer.full_name into v_customer_name
    from public.local_sales_customers customer
    where customer.id = p_customer_id;
    if not found then
      raise exception 'El cliente seleccionado no existe' using errcode = '22023';
    end if;
  end if;

  v_total_minor := p_quantity::bigint * p_unit_price_minor;

  insert into public.local_sales (customer_id, customer_name, sold_on, payment_method, total_minor)
  values (p_customer_id, v_customer_name, p_sold_on, p_payment_method, v_total_minor)
  returning id, sale_number, created_at into v_sale_id, v_sale_number, v_created_at;

  insert into public.local_sale_items (
    sale_id, variant_id, sku, product_name, variant_name, quantity, unit_price_minor
  ) values (
    v_sale_id, p_variant_id, v_sku, v_product_name, v_variant_name, p_quantity, p_unit_price_minor
  );

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

  return jsonb_build_object('id', v_sale_id, 'sale_number', v_sale_number, 'created_at', v_created_at);
end;
$$;

revoke all on function public.create_local_sale(uuid, date, text, uuid, integer, bigint) from public, anon;
grant execute on function public.create_local_sale(uuid, date, text, uuid, integer, bigint) to authenticated;
