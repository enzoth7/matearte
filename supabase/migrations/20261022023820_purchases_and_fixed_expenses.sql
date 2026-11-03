-- Compras y gastos fijos de Gestión (Inventario y compras → Compras).
-- Solo pueden verlas y editarlas Richard (t1) y quienes tengan /inventario/compras entre sus permisos.

create or replace function private.can_manage_purchases()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.commerce_admin_users as admin
    where admin.user_id = (select auth.uid())
      and admin.active
      and (
        admin.access_user_id = 't1'
        or admin.allowed_paths is null
        or '/inventario/compras' = any(admin.allowed_paths)
      )
  );
$$;
revoke all on function private.can_manage_purchases() from public, anon;
grant execute on function private.can_manage_purchases() to authenticated;

create table public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 60),
  kind text not null default 'ambas' check (kind in ('compra', 'gasto_fijo', 'ambas')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index expense_categories_name_key on public.expense_categories (lower(btrim(name)));

create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  purchased_on date not null default current_date,
  supplier text check (supplier is null or char_length(supplier) <= 120),
  description text not null check (char_length(btrim(description)) between 1 and 200),
  category text not null check (char_length(btrim(category)) between 1 and 60),
  amount_minor bigint not null check (amount_minor >= 0),
  currency text not null default 'UYU' check (currency in ('UYU', 'USD')),
  payment_method text check (payment_method is null or char_length(payment_method) <= 60),
  status text not null default 'pagada' check (status in ('pendiente', 'pagada')),
  paid_on date,
  invoice_number text check (invoice_number is null or char_length(invoice_number) <= 60),
  notes text check (notes is null or char_length(notes) <= 1000),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index purchases_purchased_on_idx on public.purchases (purchased_on desc);
create index purchases_category_idx on public.purchases (category);

create table public.fixed_expenses (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  category text not null check (char_length(btrim(category)) between 1 and 60),
  amount_minor bigint not null check (amount_minor >= 0),
  currency text not null default 'UYU' check (currency in ('UYU', 'USD')),
  due_day smallint check (due_day is null or due_day between 1 and 31),
  payment_method text check (payment_method is null or char_length(payment_method) <= 60),
  starts_on date not null default current_date,
  ends_on date,
  active boolean not null default true,
  notes text check (notes is null or char_length(notes) <= 1000),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on is null or ends_on >= starts_on)
);

-- Un registro por gasto fijo y mes (month siempre es el primer día del mes).
create table public.fixed_expense_payments (
  id uuid primary key default gen_random_uuid(),
  fixed_expense_id uuid not null references public.fixed_expenses (id) on delete cascade,
  month date not null check (extract(day from month) = 1),
  amount_minor bigint not null check (amount_minor >= 0),
  paid_on date not null default current_date,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (fixed_expense_id, month)
);

create or replace function private.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
create trigger purchases_touch_updated_at before update on public.purchases for each row execute function private.touch_updated_at();
create trigger fixed_expenses_touch_updated_at before update on public.fixed_expenses for each row execute function private.touch_updated_at();

alter table public.expense_categories enable row level security;
alter table public.purchases enable row level security;
alter table public.fixed_expenses enable row level security;
alter table public.fixed_expense_payments enable row level security;

create policy "expense_categories_manage" on public.expense_categories for all to authenticated
  using ((select private.can_manage_purchases())) with check ((select private.can_manage_purchases()));
create policy "purchases_manage" on public.purchases for all to authenticated
  using ((select private.can_manage_purchases())) with check ((select private.can_manage_purchases()));
create policy "fixed_expenses_manage" on public.fixed_expenses for all to authenticated
  using ((select private.can_manage_purchases())) with check ((select private.can_manage_purchases()));
create policy "fixed_expense_payments_manage" on public.fixed_expense_payments for all to authenticated
  using ((select private.can_manage_purchases())) with check ((select private.can_manage_purchases()));

insert into public.expense_categories (name, kind) values
  ('Materia prima', 'compra'),
  ('Insumos', 'compra'),
  ('Herramientas y equipos', 'compra'),
  ('Packaging', 'compra'),
  ('Mercadería para reventa', 'compra'),
  ('Marketing y publicidad', 'ambas'),
  ('Envíos y logística', 'ambas'),
  ('Servicios', 'ambas'),
  ('Alquiler', 'gasto_fijo'),
  ('Sueldos y cargas sociales', 'gasto_fijo'),
  ('Impuestos y contador', 'gasto_fijo'),
  ('Software y suscripciones', 'gasto_fijo'),
  ('Otros', 'ambas');

-- Solo usuarios autenticados; las políticas RLS deciden quién puede usarlas.
grant select, insert, update, delete on public.expense_categories, public.purchases, public.fixed_expenses, public.fixed_expense_payments to authenticated;
