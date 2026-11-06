-- Minimal Supabase contracts for a disposable PostgreSQL test database.
do $$
declare role_name text;
begin
  foreach role_name in array array['anon', 'authenticated', 'service_role', 'authenticator'] loop
    if not exists (select 1 from pg_roles where rolname = role_name) then
      execute format('create role %I', role_name);
    end if;
  end loop;
end;
$$;
create schema auth;
create schema private;
create schema storage;
create schema vault;
create schema extensions;
create extension pgcrypto with schema extensions;
create function auth.jwt() returns jsonb language sql stable as
$$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
create function auth.uid() returns uuid language sql stable as $$ select (auth.jwt()->>'sub')::uuid $$;
create function auth.role() returns text language sql stable as $$ select auth.jwt()->>'role' $$;
create table auth.sessions (id uuid primary key, user_id uuid not null, oauth_client_id uuid, not_after timestamptz default null);
create table vault.secrets (name text primary key, decrypted_secret text not null);
create view vault.decrypted_secrets as select * from vault.secrets;
create function vault.create_secret(p_secret text, p_name text, p_description text)
returns uuid language sql as $$ insert into vault.secrets values (p_name, p_secret) returning gen_random_uuid() $$;
create table public.commerce_admin_users (user_id uuid primary key, active boolean not null, access_user_id text);
create table public.commerce_categories (code text primary key, active boolean not null);
create table public.commerce_products (
  id uuid primary key, editorial_slug text not null unique, name text not null, category text not null,
  category_code text not null references commerce_categories, description text not null, sale_mode text not null,
  peso integer not null, attributes jsonb not null, published boolean not null, apply_catalog_price_adjustment boolean not null default true
);
create table public.commerce_variants (
  product_id uuid not null references commerce_products, sku text primary key, name text not null,
  price_minor bigint not null check (price_minor >= 0), base_price_minor bigint not null,
  color text, option_values jsonb not null, active boolean not null, available_local boolean not null,
  available_web boolean not null, available_wholesale boolean not null
);
create table storage.objects (name text primary key);
alter table storage.objects enable row level security;
grant usage on schema storage to authenticated;
grant select, insert on storage.objects to authenticated;
create policy baseline_storage_access on storage.objects for all to authenticated using (true) with check (true);
insert into public.commerce_admin_users values
  ('5afbc94d-aecf-44e8-b12e-e136f49abb62', true, 't1'),
  ('10000000-0000-4000-8000-000000000002', true, 't1');
insert into public.commerce_categories values ('bombillas', true), ('servicios', true);
insert into auth.sessions (id, user_id, oauth_client_id) values
  ('20000000-0000-4000-8000-000000000001', '5afbc94d-aecf-44e8-b12e-e136f49abb62', '30000000-0000-4000-8000-000000000001'),
  ('20000000-0000-4000-8000-000000000002', '5afbc94d-aecf-44e8-b12e-e136f49abb62', null),
  ('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000001');
