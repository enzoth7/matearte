-- Disposable local database only. Minimal schema for argentina_retail.sql; never run against a populated database.
do $$ begin
 if not exists(select 1 from pg_roles where rolname='anon') then create role anon; end if;
 if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
 if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role bypassrls; end if;
end $$;
create schema auth; create schema private;
create function private.is_commerce_admin() returns boolean language sql as $$ select current_setting('test.admin',true)='yes' $$;
revoke all on function private.is_commerce_admin() from public,anon;
grant usage on schema private to authenticated,service_role;
grant execute on function private.is_commerce_admin() to authenticated,service_role;
create function private.set_updated_at() returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end $$;
create table public.commerce_admin_users(user_id uuid primary key,active boolean);
create table public.settings(id integer primary key, exchange_rate numeric);
create table public.commerce_settings(singleton boolean,commerce_enabled boolean,wholesale_mate_discount_enabled boolean,wholesale_mate_discount_percent numeric,wholesale_mate_quantity_threshold integer,wholesale_discount_categories text[]);
create table public.carts(id uuid primary key,user_id uuid,status text);
create table public.commerce_products(id uuid primary key,name text,published boolean,category_code text,category text);
create table public.commerce_variants(id uuid primary key,product_id uuid,active boolean,available_web boolean,price_minor bigint,sku text,name text,option_values jsonb);
create table public.designs(id uuid primary key,user_id uuid,title text,schema_version integer,configuration jsonb,fleje_configuration jsonb,preview_path text);
create table public.design_assets(id uuid,design_id uuid);
create table public.cart_items(id uuid primary key,cart_id uuid,item_type text,variant_id uuid,design_id uuid,quantity integer,option_values_override jsonb);
create table public.orders(id uuid primary key default gen_random_uuid(),order_number bigint generated always as identity,user_id uuid,cart_id uuid,status text,currency text default 'UYU' constraint orders_currency_check check(currency='UYU'),items_subtotal_minor bigint,total_minor bigint,shipping_minor bigint default 0,payment_fee_minor bigint default 0,shipping_method text,shipping_snapshot jsonb,customer_snapshot jsonb,checkout_idempotency_key uuid unique,reservation_expires_at timestamptz,paid_at timestamptz,check(total_minor=items_subtotal_minor+shipping_minor+payment_fee_minor));
create table public.order_items(id uuid primary key default gen_random_uuid(),order_id uuid,item_type text,source_variant_id uuid,source_design_id uuid,sku text,title text,quantity integer,unit_price_minor bigint,total_minor bigint,immutable_snapshot jsonb,requires_review boolean,review_status text,check(total_minor=quantity*unit_price_minor));
create table public.commerce_payments(order_id uuid,provider text,provider_payment_id text unique,status text,status_detail text,amount_minor bigint,currency text constraint commerce_payments_currency_check check(currency in ('UYU','USD')),raw_payload jsonb,approved_at timestamptz);
create table public.commerce_bank_transfer_receipts(id uuid primary key,order_id uuid unique,user_id uuid,storage_path text unique,original_name text,mime_type text check(mime_type in ('image/jpeg','image/png','image/webp','application/pdf')),byte_size bigint check(byte_size between 1 and 5242880),status text default 'pending',rejection_reason text,reviewed_by uuid,reviewed_at timestamptz,submitted_at timestamptz default now(),check((status='pending' and reviewed_by is null and reviewed_at is null and rejection_reason is null) or (status='approved' and reviewed_by is not null and reviewed_at is not null and rejection_reason is null) or (status='rejected' and reviewed_by is not null and reviewed_at is not null and rejection_reason is not null)));
grant all on all tables in schema public to service_role;
grant usage,select on all sequences in schema public to service_role;
