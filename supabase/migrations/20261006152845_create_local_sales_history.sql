create table public.local_sales (
  id uuid primary key default gen_random_uuid(),
  sale_number bigint generated always as identity unique,
  customer_id uuid references public.local_sales_customers(id) on delete set null,
  customer_name text not null default 'Cliente sin registrar'
    check (char_length(btrim(customer_name)) between 1 and 120),
  sold_on date not null default current_date check (sold_on <= current_date),
  payment_method text not null
    check (payment_method in ('Efectivo', 'Débito', 'Crédito', 'Transferencia')),
  total_minor bigint not null check (total_minor >= 0),
  currency text not null default 'UYU' check (currency = 'UYU'),
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.local_sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.local_sales(id) on delete cascade,
  variant_id uuid references public.commerce_variants(id) on delete set null,
  sku text not null check (char_length(btrim(sku)) between 1 and 120),
  product_name text not null check (char_length(btrim(product_name)) between 1 and 200),
  variant_name text not null check (char_length(btrim(variant_name)) between 1 and 200),
  quantity integer not null check (quantity between 1 and 1000),
  unit_price_minor bigint not null check (unit_price_minor between 0 and 1000000000),
  line_total_minor bigint generated always as (quantity::bigint * unit_price_minor) stored,
  created_at timestamptz not null default now()
);

comment on table public.local_sales is
  'Cabeceras del historial de ventas presenciales registradas en la herramienta localventas.';
comment on table public.local_sale_items is
  'Productos de cada venta presencial, con datos de catálogo preservados como instantánea.';

create index local_sales_sold_on_idx on public.local_sales (sold_on desc, created_at desc);
create index local_sales_customer_id_idx on public.local_sales (customer_id);
create index local_sales_created_by_idx on public.local_sales (created_by);
create index local_sale_items_sale_id_idx on public.local_sale_items (sale_id);
create index local_sale_items_variant_id_idx on public.local_sale_items (variant_id);

alter table public.local_sales enable row level security;
alter table public.local_sale_items enable row level security;

revoke all on table public.local_sales from anon, authenticated;
revoke all on table public.local_sale_items from anon, authenticated;
grant select, insert on table public.local_sales to authenticated;
grant select, insert on table public.local_sale_items to authenticated;

create policy "staff can read local sales"
  on public.local_sales for select to authenticated
  using ((select private.is_pricing_admin()) or (select private.is_commerce_admin()));

create policy "staff can create local sales"
  on public.local_sales for insert to authenticated
  with check (
    (select auth.uid()) = created_by
    and ((select private.is_pricing_admin()) or (select private.is_commerce_admin()))
  );

create policy "staff can read local sale items"
  on public.local_sale_items for select to authenticated
  using ((select private.is_pricing_admin()) or (select private.is_commerce_admin()));

create policy "staff can create local sale items"
  on public.local_sale_items for insert to authenticated
  with check (
    ((select private.is_pricing_admin()) or (select private.is_commerce_admin()))
    and exists (
      select 1 from public.local_sales sale
      where sale.id = sale_id and sale.created_by = (select auth.uid())
    )
  );

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
  if p_payment_method not in ('Efectivo', 'Débito', 'Crédito', 'Transferencia') then
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
  where variant.id = p_variant_id and variant.active and product.published;

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
