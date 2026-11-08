-- Finanzas: egresos unificados y cierres mensuales.

alter table public.purchases add column if not exists due_on date;
create index if not exists purchases_due_on_idx on public.purchases (due_on)
  where status = 'pendiente';

-- Conservar quién podía editar Compras. El permiso de edición no es una página.
update public.commerce_admin_users as admin
set allowed_paths = (
  select coalesce(array_agg(distinct path order by path), array[]::text[])
  from unnest(
    array_remove(array_remove(admin.allowed_paths, '/inventario/compras'), '/finanzas/por-pagar')
    || case when '/inventario/compras' = any(admin.allowed_paths)
      then array['/finanzas/egresos', '/finanzas/gastos-fijos', '/finanzas/editar-egresos']::text[]
      else array[]::text[] end
    || case when '/finanzas/por-pagar' = any(admin.allowed_paths)
      then array['/finanzas/egresos']::text[]
      else array[]::text[] end
  ) as granted(path)
)
where admin.allowed_paths is not null
  and ('/inventario/compras' = any(admin.allowed_paths)
    or '/finanzas/por-pagar' = any(admin.allowed_paths));

create or replace function private.can_read_finance_expenses()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.commerce_admin_users admin
    where admin.user_id = (select auth.uid()) and admin.active
      and (admin.access_user_id = 't1' or admin.allowed_paths is null
        or admin.allowed_paths && array[
          '/finanzas/egresos', '/finanzas/gastos-fijos', '/finanzas/conciliacion'
        ]::text[])
  );
$$;
revoke all on function private.can_read_finance_expenses() from public, anon;
grant execute on function private.can_read_finance_expenses() to authenticated;

create or replace function private.can_manage_purchases()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.commerce_admin_users admin
    where admin.user_id = (select auth.uid()) and admin.active
      and (admin.access_user_id = 't1' or admin.allowed_paths is null
        or '/finanzas/editar-egresos' = any(admin.allowed_paths))
  );
$$;
revoke all on function private.can_manage_purchases() from public, anon;
grant execute on function private.can_manage_purchases() to authenticated;

create or replace function private.can_view_finance_close()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.commerce_admin_users admin
    where admin.user_id = (select auth.uid()) and admin.active
      and (admin.access_user_id = 't1' or admin.allowed_paths is null
        or '/finanzas/conciliacion' = any(admin.allowed_paths))
  );
$$;
revoke all on function private.can_view_finance_close() from public, anon;
grant execute on function private.can_view_finance_close() to authenticated;

create or replace function private.can_write_finance_close()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.commerce_admin_users admin
    where admin.user_id = (select auth.uid()) and admin.active
      and admin.access_user_id = 't1'
  );
$$;
revoke all on function private.can_write_finance_close() from public, anon;
grant execute on function private.can_write_finance_close() to authenticated;

drop policy if exists expense_categories_manage on public.expense_categories;
drop policy if exists purchases_manage on public.purchases;
drop policy if exists fixed_expenses_manage on public.fixed_expenses;
drop policy if exists fixed_expense_payments_manage on public.fixed_expense_payments;

create policy expense_categories_read on public.expense_categories for select to authenticated
  using ((select private.can_read_finance_expenses()));
create policy expense_categories_write on public.expense_categories for all to authenticated
  using ((select private.can_manage_purchases()))
  with check ((select private.can_manage_purchases()));
create policy purchases_read on public.purchases for select to authenticated
  using ((select private.can_read_finance_expenses()));
create policy purchases_write on public.purchases for all to authenticated
  using ((select private.can_manage_purchases()))
  with check ((select private.can_manage_purchases()));
create policy fixed_expenses_read on public.fixed_expenses for select to authenticated
  using ((select private.can_read_finance_expenses()));
create policy fixed_expenses_write on public.fixed_expenses for all to authenticated
  using ((select private.can_manage_purchases()))
  with check ((select private.can_manage_purchases()));
create policy fixed_expense_payments_read on public.fixed_expense_payments for select to authenticated
  using ((select private.can_read_finance_expenses()));
create policy fixed_expense_payments_write on public.fixed_expense_payments for all to authenticated
  using ((select private.can_manage_purchases()))
  with check ((select private.can_manage_purchases()));

create table public.finance_accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  kind text not null check (kind in ('bank', 'cash', 'wallet')),
  currency text not null check (currency in ('UYU', 'USD', 'ARS')),
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index finance_accounts_name_currency_key
  on public.finance_accounts (lower(btrim(name)), currency);
alter table public.finance_accounts enable row level security;
create policy finance_accounts_read on public.finance_accounts for select to authenticated
  using ((select private.can_view_finance_close()));
create policy finance_accounts_insert on public.finance_accounts for insert to authenticated
  with check ((select private.can_write_finance_close()));
create policy finance_accounts_update on public.finance_accounts for update to authenticated
  using ((select private.can_write_finance_close()))
  with check ((select private.can_write_finance_close()));
revoke all on public.finance_accounts from public, anon;
grant select, insert, update on public.finance_accounts to authenticated;

create table public.finance_monthly_closes (
  id uuid primary key default gen_random_uuid(),
  month date not null check (extract(day from month) = 1 and month >= date '2026-11-01'),
  revision integer not null check (revision >= 0),
  status text not null check (status in ('draft', 'closed')),
  reason text,
  balances jsonb not null default '[]'::jsonb check (jsonb_typeof(balances) = 'array'),
  adjustments jsonb not null default '[]'::jsonb check (jsonb_typeof(adjustments) = 'array'),
  rates jsonb not null default '{"UYU":1}'::jsonb check (jsonb_typeof(rates) = 'object'),
  entries jsonb not null default '[]'::jsonb check (jsonb_typeof(entries) = 'array'),
  opening_balances jsonb not null default '[]'::jsonb check (jsonb_typeof(opening_balances) = 'array'),
  summary jsonb not null default '{}'::jsonb check (jsonb_typeof(summary) = 'object'),
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz,
  unique (month, revision),
  check ((status = 'draft' and revision = 0 and closed_at is null)
    or (status = 'closed' and revision > 0 and closed_at is not null)),
  check (revision <= 1 or nullif(btrim(reason), '') is not null)
);
create index finance_monthly_closes_month_idx on public.finance_monthly_closes (month desc, revision desc);

create function private.guard_finance_monthly_close()
returns trigger language plpgsql set search_path = '' as $$
declare last_day date;
begin
  if tg_op in ('UPDATE', 'DELETE') and old.status = 'closed' then
    raise exception 'Un cierre finalizado es inmutable' using errcode = '23514';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  last_day := (new.month + interval '1 month - 1 day')::date;
  if new.status = 'closed' and (now() at time zone 'America/Montevideo')::date < last_day then
    raise exception 'El mes aún no terminó' using errcode = '23514';
  end if;
  if new.status = 'closed' and new.month > date '2026-11-01'
    and not exists (
      select 1 from public.finance_monthly_closes previous
      where previous.month = (new.month - interval '1 month')::date and previous.status = 'closed'
    ) then
    raise exception 'Primero hay que cerrar el mes anterior' using errcode = '23514';
  end if;
  if new.status = 'closed' and new.revision <> (
    select coalesce(max(previous.revision), 0) + 1
    from public.finance_monthly_closes previous
    where previous.month = new.month and previous.status = 'closed'
  ) then
    raise exception 'La versión del cierre no es la siguiente' using errcode = '23514';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
create trigger finance_monthly_close_guard before insert or update or delete
  on public.finance_monthly_closes for each row execute function private.guard_finance_monthly_close();

alter table public.finance_monthly_closes enable row level security;
create policy finance_monthly_closes_read on public.finance_monthly_closes for select to authenticated
  using ((select private.can_view_finance_close()));
create policy finance_monthly_closes_insert on public.finance_monthly_closes for insert to authenticated
  with check ((select private.can_write_finance_close()));
create policy finance_monthly_closes_update_draft on public.finance_monthly_closes for update to authenticated
  using (status = 'draft' and (select private.can_write_finance_close()))
  with check (status = 'draft' and (select private.can_write_finance_close()));
create policy finance_monthly_closes_delete_draft on public.finance_monthly_closes for delete to authenticated
  using (status = 'draft' and (select private.can_write_finance_close()));
revoke all on public.finance_monthly_closes from public, anon;
grant select, insert, update, delete on public.finance_monthly_closes to authenticated;
