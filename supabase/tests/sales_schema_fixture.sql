-- Minimal isolated PostgreSQL fixture. NEVER run against a Supabase project.
create role anon;
create role authenticated;
create role service_role bypassrls;
create schema auth;
create schema private;
create schema storage;
create table auth.users(id uuid primary key);
create table public.commerce_admin_users(user_id uuid primary key,active boolean);
create table public.carts(id uuid primary key,status text);
create table public.orders(
 id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id),
 cart_id uuid references public.carts(id), status text not null,
 paypal_order_id text unique, paypal_amount_usd_minor bigint, paid_at timestamptz,
 reservation_expires_at timestamptz, customer_snapshot jsonb default '{}',
 checkout_idempotency_key uuid, discount_minor bigint default 0,
 order_number bigint default 1,items_subtotal_minor bigint default 410000,
 shipping_minor bigint default 0,total_minor bigint default 410000,payment_fee_minor bigint default 0,
 discount_code text, discount_id uuid, discount_type text,discount_value numeric
);
create table public.order_items(id uuid primary key default gen_random_uuid(),order_id uuid references public.orders(id),requires_review boolean,review_status text,review_reason text);
create table public.commerce_payments(
 id uuid primary key default gen_random_uuid(),order_id uuid references public.orders(id),
 provider text,provider_payment_id text unique,status text,status_detail text,
 amount_minor bigint,currency text,raw_payload jsonb,approved_at timestamptz
);
create table public.payment_webhook_events(id uuid primary key default gen_random_uuid(),provider text,provider_event_id text,event_type text,signature_valid boolean,payload jsonb,processed_at timestamptz,processing_error text,unique(provider,provider_event_id));
create table public.commerce_discount_usages(checkout_key uuid,status text);
create function private.redeem_commerce_discount(uuid,uuid,uuid) returns void language sql as 'select';
create function public.create_paypal_international_order(uuid,uuid,jsonb,jsonb,jsonb,uuid,bigint,bigint,integer)
returns jsonb language sql as 'select ''{"existing":true}''::jsonb';
create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);
alter table storage.objects enable row level security;
grant usage on schema storage to authenticated;
grant all on storage.objects to authenticated;
create policy fixture_storage_access on storage.objects for all to authenticated using(true) with check(true);
create table public.design_assets(id uuid);
alter table public.design_assets enable row level security;
grant all on public.design_assets to authenticated;
create policy design_assets_insert_own on public.design_assets for insert to authenticated with check(true);
create policy design_assets_update_own on public.design_assets for update to authenticated using(true);
