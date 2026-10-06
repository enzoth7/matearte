create table public.local_sales_customers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (char_length(btrim(full_name)) between 1 and 120),
  email text check (email is null or char_length(email) <= 320),
  phone text check (phone is null or char_length(phone) <= 40),
  birth_date date check (birth_date is null or birth_date between date '1900-01-01' and current_date),
  first_purchase_date date check (first_purchase_date is null or first_purchase_date <= current_date),
  last_purchase_date date check (last_purchase_date is null or last_purchase_date <= current_date),
  source_user_id uuid unique references auth.users(id) on delete set null,
  notes text not null default '' check (char_length(notes) <= 2000),
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (first_purchase_date is null or last_purchase_date is null or first_purchase_date <= last_purchase_date)
);

comment on table public.local_sales_customers is
  'Clientes del punto de venta físico. source_user_id permite vincularlos con una identidad autenticada más adelante.';

create unique index local_sales_customers_email_unique_idx
  on public.local_sales_customers (lower(email))
  where email is not null and btrim(email) <> '';

create index local_sales_customers_name_idx
  on public.local_sales_customers (lower(full_name) text_pattern_ops);

create index local_sales_customers_phone_idx
  on public.local_sales_customers (phone)
  where phone is not null and btrim(phone) <> '';

create trigger local_sales_customers_set_updated_at
  before update on public.local_sales_customers
  for each row execute function private.set_updated_at();

alter table public.local_sales_customers enable row level security;

revoke all on table public.local_sales_customers from anon, authenticated;
grant select, insert on table public.local_sales_customers to authenticated;
grant update (full_name, email, phone, birth_date, first_purchase_date, last_purchase_date, notes)
  on table public.local_sales_customers to authenticated;

create policy "staff can read local customers"
  on public.local_sales_customers
  for select
  to authenticated
  using ((select private.is_pricing_admin()) or (select private.is_commerce_admin()));

create policy "staff can create local customers"
  on public.local_sales_customers
  for insert
  to authenticated
  with check (
    (select auth.uid()) = created_by
    and ((select private.is_pricing_admin()) or (select private.is_commerce_admin()))
  );

create policy "staff can update local customers"
  on public.local_sales_customers
  for update
  to authenticated
  using ((select private.is_pricing_admin()) or (select private.is_commerce_admin()))
  with check ((select private.is_pricing_admin()) or (select private.is_commerce_admin()));
