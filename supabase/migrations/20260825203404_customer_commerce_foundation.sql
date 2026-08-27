-- MateArte customer accounts, saved designs and isolated commerce domain.
-- Legacy operational tables are intentionally untouched.

create schema if not exists private;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.customer_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '' check (char_length(full_name) <= 120),
  phone text check (phone is null or char_length(phone) <= 40),
  company text check (company is null or char_length(company) <= 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.designs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Diseño sin título' check (char_length(title) between 1 and 120),
  schema_version integer not null default 1 check (schema_version > 0),
  configuration jsonb not null default '{}'::jsonb,
  fleje_configuration jsonb not null default '{}'::jsonb,
  preview_path text,
  status text not null default 'draft' check (status in ('draft', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);
create index designs_user_updated_idx on public.designs (user_id, updated_at desc);

create table public.design_assets (
  id uuid primary key default gen_random_uuid(),
  design_id uuid not null,
  user_id uuid not null,
  bucket_id text not null check (bucket_id in ('design-assets', 'design-previews')),
  object_path text not null,
  original_name text not null check (char_length(original_name) <= 240),
  mime_type text not null check (mime_type in ('image/png', 'image/jpeg', 'image/svg+xml')),
  byte_size bigint not null check (byte_size between 1 and 5242880),
  sha256 text check (sha256 is null or sha256 ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  foreign key (design_id, user_id) references public.designs(id, user_id) on delete cascade,
  unique (bucket_id, object_path)
);
create index design_assets_design_idx on public.design_assets (design_id);
create index design_assets_user_idx on public.design_assets (user_id);

create table public.auth_handoffs (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  user_id uuid not null references auth.users(id) on delete cascade,
  target_path text not null check (target_path like '/%' and target_path not like '//%'),
  action text not null default 'continue' check (action in ('continue', 'open_cart', 'add_design', 'checkout')),
  payload jsonb not null default '{}'::jsonb,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  check (expires_at <= created_at + interval '5 minutes')
);
create index auth_handoffs_expiry_idx on public.auth_handoffs (expires_at) where consumed_at is null;
revoke all on public.auth_handoffs from anon, authenticated;
grant all on public.auth_handoffs to service_role;

create table public.commerce_admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create or replace function private.is_commerce_admin(check_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.commerce_admin_users
    where user_id = check_user_id and active
  );
$$;
revoke all on function private.is_commerce_admin(uuid) from public, anon;
grant execute on function private.is_commerce_admin(uuid) to authenticated, service_role;

create table public.commerce_products (
  id uuid primary key default gen_random_uuid(),
  editorial_slug text not null unique check (editorial_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 1 and 160),
  category text not null default 'mates',
  description text not null default '',
  sale_mode text not null default 'standard' check (sale_mode in ('standard', 'made_to_order')),
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index commerce_products_published_idx on public.commerce_products (published, category);

create table public.commerce_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.commerce_products(id) on delete cascade,
  sku text not null unique check (char_length(sku) between 1 and 80),
  name text not null check (char_length(name) between 1 and 120),
  price_minor bigint not null check (price_minor >= 0),
  currency text not null default 'UYU' check (currency = 'UYU'),
  weight_grams integer check (weight_grams is null or weight_grams > 0),
  inventory_tracked boolean not null default true,
  stock_on_hand integer not null default 0 check (stock_on_hand >= 0),
  stock_reserved integer not null default 0 check (stock_reserved >= 0 and stock_reserved <= stock_on_hand),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index commerce_variants_product_idx on public.commerce_variants (product_id);
create index commerce_variants_sellable_idx on public.commerce_variants (active, product_id);

create table public.shipping_rates (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  departments text[] not null default '{}',
  rate_minor bigint not null check (rate_minor >= 0),
  is_pickup boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((is_pickup and rate_minor = 0) or not is_pickup)
);
create unique index shipping_rates_one_pickup_idx on public.shipping_rates (is_pickup) where is_pickup and active;

create table public.carts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'converted', 'abandoned')),
  merge_keys text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index carts_one_active_per_user_idx on public.carts (user_id) where status = 'active';
create index carts_user_idx on public.carts (user_id);

create table public.cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.carts(id) on delete cascade,
  item_type text not null check (item_type in ('catalog', 'design')),
  variant_id uuid references public.commerce_variants(id) on delete cascade,
  design_id uuid references public.designs(id) on delete cascade,
  quantity integer not null default 1 check (quantity between 1 and 99),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (item_type = 'catalog' and variant_id is not null and design_id is null) or
    (item_type = 'design' and design_id is not null and variant_id is null and quantity = 1)
  )
);
create index cart_items_cart_idx on public.cart_items (cart_id);
create index cart_items_variant_idx on public.cart_items (variant_id) where variant_id is not null;
create index cart_items_design_idx on public.cart_items (design_id) where design_id is not null;
create unique index cart_items_variant_unique_idx on public.cart_items (cart_id, variant_id) where variant_id is not null;
create unique index cart_items_design_unique_idx on public.cart_items (cart_id, design_id) where design_id is not null;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number bigint generated always as identity unique,
  user_id uuid not null references auth.users(id) on delete restrict,
  cart_id uuid references public.carts(id) on delete set null,
  status text not null default 'pending_payment' check (status in (
    'pending_payment', 'paid_pending_review', 'ready_for_fulfillment',
    'ready_for_production', 'payment_failed', 'cancelled', 'refunded', 'manual_review'
  )),
  currency text not null default 'UYU' check (currency = 'UYU'),
  items_subtotal_minor bigint not null check (items_subtotal_minor >= 0),
  shipping_minor bigint not null default 0 check (shipping_minor >= 0),
  payment_fee_minor bigint not null default 0 check (payment_fee_minor >= 0),
  total_minor bigint not null check (total_minor >= 0),
  shipping_method text not null check (shipping_method in ('pickup', 'national_shipping')),
  shipping_snapshot jsonb not null default '{}'::jsonb,
  customer_snapshot jsonb not null default '{}'::jsonb,
  mercado_pago_preference_id text,
  checkout_idempotency_key uuid not null unique default gen_random_uuid(),
  reservation_expires_at timestamptz,
  paid_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (total_minor = items_subtotal_minor + shipping_minor + payment_fee_minor)
);
create index orders_user_created_idx on public.orders (user_id, created_at desc);
create index orders_status_idx on public.orders (status, created_at);
create index orders_cart_idx on public.orders (cart_id) where cart_id is not null;
create index orders_reservation_expiry_idx on public.orders (reservation_expires_at) where status = 'pending_payment';

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  item_type text not null check (item_type in ('catalog', 'design')),
  source_variant_id uuid references public.commerce_variants(id) on delete set null,
  source_design_id uuid references public.designs(id) on delete set null,
  sku text,
  title text not null,
  quantity integer not null check (quantity > 0),
  unit_price_minor bigint not null check (unit_price_minor >= 0),
  total_minor bigint not null check (total_minor = unit_price_minor * quantity),
  immutable_snapshot jsonb not null,
  requires_review boolean not null default false,
  review_status text check (review_status is null or review_status in ('pending', 'approved', 'rejected')),
  review_reason text,
  created_at timestamptz not null default now()
);
create index order_items_order_idx on public.order_items (order_id);
create index order_items_variant_idx on public.order_items (source_variant_id) where source_variant_id is not null;
create index order_items_design_idx on public.order_items (source_design_id) where source_design_id is not null;

create table public.inventory_reservations (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  variant_id uuid not null references public.commerce_variants(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  status text not null default 'active' check (status in ('active', 'committed', 'released')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (order_id, variant_id)
);
create index inventory_reservations_order_idx on public.inventory_reservations (order_id);
create index inventory_reservations_variant_idx on public.inventory_reservations (variant_id);
create index inventory_reservations_expiry_idx on public.inventory_reservations (expires_at) where status = 'active';

create table public.commerce_payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  provider text not null default 'mercado_pago' check (provider = 'mercado_pago'),
  provider_payment_id text not null unique,
  status text not null,
  status_detail text,
  amount_minor bigint not null check (amount_minor >= 0),
  currency text not null default 'UYU' check (currency = 'UYU'),
  raw_payload jsonb not null default '{}'::jsonb,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index commerce_payments_order_idx on public.commerce_payments (order_id);

create table public.payment_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'mercado_pago' check (provider = 'mercado_pago'),
  provider_event_id text not null,
  event_type text not null,
  signature_valid boolean not null,
  payload jsonb not null,
  processed_at timestamptz,
  processing_error text,
  created_at timestamptz not null default now(),
  unique (provider, provider_event_id)
);
create index payment_webhook_events_unprocessed_idx on public.payment_webhook_events (created_at) where processed_at is null;

create table public.commerce_settings (
  singleton boolean primary key default true check (singleton),
  commerce_enabled boolean not null default false,
  mercado_pago_enabled boolean not null default false,
  payment_fee_enabled boolean not null default false,
  payment_fee_legal_approval boolean not null default false,
  reservation_minutes integer not null default 30 check (reservation_minutes between 5 and 120),
  updated_at timestamptz not null default now(),
  check (not payment_fee_enabled or payment_fee_legal_approval)
);
insert into public.commerce_settings (singleton) values (true) on conflict do nothing;

insert into public.shipping_rates (code, name, departments, rate_minor, is_pickup, active)
values ('pickup-taller', 'Retiro sin costo', '{}', 0, true, true)
on conflict (code) do nothing;

-- Profiles are provisioned from trusted auth data; metadata is display-only.
create or replace function private.handle_new_customer()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.customer_profiles (user_id, full_name)
  values (new.id, left(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''), 120))
  on conflict (user_id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created_customer on auth.users;
create trigger on_auth_user_created_customer
  after insert on auth.users
  for each row execute function private.handle_new_customer();

insert into public.customer_profiles (user_id, full_name)
select id, left(coalesce(raw_user_meta_data ->> 'full_name', raw_user_meta_data ->> 'name', ''), 120)
from auth.users
on conflict (user_id) do nothing;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'customer_profiles', 'designs', 'commerce_products', 'commerce_variants',
    'shipping_rates', 'carts', 'cart_items', 'orders', 'inventory_reservations',
    'commerce_payments', 'commerce_settings'
  ] loop
    execute format('create trigger %I before update on public.%I for each row execute function private.set_updated_at()', table_name || '_updated_at', table_name);
  end loop;
end $$;

-- Explicit Data API grants. Legacy tables keep their existing access unchanged;
-- server-only payment/handoff tables remain service_role-only.
revoke all on table
  public.customer_profiles, public.designs, public.design_assets, public.auth_handoffs,
  public.commerce_admin_users, public.commerce_products, public.commerce_variants,
  public.shipping_rates, public.carts, public.cart_items, public.orders,
  public.order_items, public.inventory_reservations, public.commerce_payments,
  public.payment_webhook_events, public.commerce_settings
from anon, authenticated;
grant usage on schema public to anon, authenticated;
grant select, insert, update on public.customer_profiles to authenticated;
grant select, insert, update, delete on public.designs, public.design_assets to authenticated;
grant select on public.commerce_products, public.commerce_variants, public.shipping_rates, public.commerce_settings to anon, authenticated;
grant select, insert, update, delete on public.carts, public.cart_items to authenticated;
grant select on public.orders, public.order_items, public.commerce_payments to authenticated;
grant select on public.commerce_admin_users to authenticated;
grant select, insert, update, delete on public.commerce_products, public.commerce_variants, public.shipping_rates to authenticated;
grant select, update on public.orders, public.order_items, public.commerce_settings to authenticated;
grant all on public.auth_handoffs, public.inventory_reservations, public.commerce_payments, public.payment_webhook_events to service_role;
grant usage, select on sequence public.orders_order_number_seq to service_role;

alter table public.customer_profiles enable row level security;
alter table public.designs enable row level security;
alter table public.design_assets enable row level security;
alter table public.auth_handoffs enable row level security;
alter table public.commerce_admin_users enable row level security;
alter table public.commerce_products enable row level security;
alter table public.commerce_variants enable row level security;
alter table public.shipping_rates enable row level security;
alter table public.carts enable row level security;
alter table public.cart_items enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.inventory_reservations enable row level security;
alter table public.commerce_payments enable row level security;
alter table public.payment_webhook_events enable row level security;
alter table public.commerce_settings enable row level security;

create policy customer_profiles_select_own on public.customer_profiles for select to authenticated using ((select auth.uid()) = user_id);
create policy customer_profiles_insert_own on public.customer_profiles for insert to authenticated with check ((select auth.uid()) = user_id);
create policy customer_profiles_update_own on public.customer_profiles for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy designs_select_own on public.designs for select to authenticated using ((select auth.uid()) = user_id);
create policy designs_insert_own on public.designs for insert to authenticated with check ((select auth.uid()) = user_id);
create policy designs_update_own on public.designs for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy designs_delete_own on public.designs for delete to authenticated using ((select auth.uid()) = user_id);
create policy design_assets_select_own on public.design_assets for select to authenticated using ((select auth.uid()) = user_id);
create policy design_assets_insert_own on public.design_assets for insert to authenticated with check ((select auth.uid()) = user_id);
create policy design_assets_update_own on public.design_assets for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy design_assets_delete_own on public.design_assets for delete to authenticated using ((select auth.uid()) = user_id);

create policy commerce_admin_self on public.commerce_admin_users for select to authenticated using ((select auth.uid()) = user_id and active);
create policy products_public_read on public.commerce_products for select to anon, authenticated using (published or (select private.is_commerce_admin()));
create policy products_admin_write on public.commerce_products for all to authenticated using ((select private.is_commerce_admin())) with check ((select private.is_commerce_admin()));
create policy variants_public_read on public.commerce_variants for select to anon, authenticated using (
  (active and exists (select 1 from public.commerce_products p where p.id = product_id and p.published))
  or (select private.is_commerce_admin())
);
create policy variants_admin_write on public.commerce_variants for all to authenticated using ((select private.is_commerce_admin())) with check ((select private.is_commerce_admin()));
create policy shipping_public_read on public.shipping_rates for select to anon, authenticated using (active or (select private.is_commerce_admin()));
create policy shipping_admin_write on public.shipping_rates for all to authenticated using ((select private.is_commerce_admin())) with check ((select private.is_commerce_admin()));
create policy settings_public_read on public.commerce_settings for select to anon, authenticated using (true);
create policy settings_admin_update on public.commerce_settings for update to authenticated using ((select private.is_commerce_admin())) with check ((select private.is_commerce_admin()));

create policy carts_own_all on public.carts for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy cart_items_own_all on public.cart_items for all to authenticated
using (exists (select 1 from public.carts c where c.id = cart_id and c.user_id = (select auth.uid())))
with check (
  exists (select 1 from public.carts c where c.id = cart_id and c.user_id = (select auth.uid()))
  and (design_id is null or exists (select 1 from public.designs d where d.id = design_id and d.user_id = (select auth.uid())))
);
create policy orders_own_or_admin_read on public.orders for select to authenticated using ((select auth.uid()) = user_id or (select private.is_commerce_admin()));
create policy orders_admin_update on public.orders for update to authenticated using ((select private.is_commerce_admin())) with check ((select private.is_commerce_admin()));
create policy order_items_own_or_admin_read on public.order_items for select to authenticated using (
  exists (select 1 from public.orders o where o.id = order_id and (o.user_id = (select auth.uid()) or (select private.is_commerce_admin())))
);
create policy order_items_admin_update on public.order_items for update to authenticated using ((select private.is_commerce_admin())) with check ((select private.is_commerce_admin()));
create policy payments_own_or_admin_read on public.commerce_payments for select to authenticated using (
  exists (select 1 from public.orders o where o.id = order_id and (o.user_id = (select auth.uid()) or (select private.is_commerce_admin())))
);

-- Private storage. The first two path segments must be user_id/design_id.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('design-assets', 'design-assets', false, 5242880, array['image/png', 'image/jpeg', 'image/svg+xml']),
  ('design-previews', 'design-previews', false, 5242880, array['image/png', 'image/jpeg']),
  ('order-assets', 'order-assets', false, 10485760, array['image/png', 'image/jpeg', 'image/svg+xml', 'application/pdf'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy design_storage_select_own on storage.objects for select to authenticated using (
  bucket_id in ('design-assets', 'design-previews') and (storage.foldername(name))[1] = (select auth.uid())::text
);
create policy design_storage_insert_own on storage.objects for insert to authenticated with check (
  bucket_id in ('design-assets', 'design-previews') and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (select 1 from public.designs d where d.id::text = (storage.foldername(name))[2] and d.user_id = (select auth.uid()))
);
create policy design_storage_update_own on storage.objects for update to authenticated using (
  bucket_id in ('design-assets', 'design-previews') and (storage.foldername(name))[1] = (select auth.uid())::text
) with check (
  bucket_id in ('design-assets', 'design-previews') and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (select 1 from public.designs d where d.id::text = (storage.foldername(name))[2] and d.user_id = (select auth.uid()))
);
create policy design_storage_delete_own on storage.objects for delete to authenticated using (
  bucket_id in ('design-assets', 'design-previews') and (storage.foldername(name))[1] = (select auth.uid())::text
);

-- Only complete variants may be exposed for sale.
create or replace function private.enforce_commerce_product_publishable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.published and not exists (
    select 1 from public.commerce_variants v
    where v.product_id = new.id and v.active and v.price_minor > 0 and v.sku <> ''
      and (new.sale_mode = 'made_to_order' or v.weight_grams is not null)
  ) then
    raise exception 'El producto necesita una variante activa con SKU, precio y datos de entrega antes de publicarse';
  end if;
  return new;
end;
$$;
create trigger commerce_products_publishable before insert or update of published on public.commerce_products
for each row execute function private.enforce_commerce_product_publishable();

comment on table public.auth_handoffs is 'Server-only one-time cross-origin session handoff codes; token values are stored only as hashes.';
comment on table public.order_items is 'Immutable commercial snapshots. Editing or deleting a saved design never changes an order.';
comment on table public.commerce_settings is 'Kill switches stay off until sandbox, catalog, credentials and fee legality are approved.';
