-- El saldo arrastrado se carga desde Egresos, pero no es un gasto del mes.
create table public.finance_monthly_openings (
  month date primary key check (extract(day from month) = 1),
  amount_minor bigint not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

alter table public.finance_monthly_openings enable row level security;
revoke all on public.finance_monthly_openings from public, anon, authenticated;
grant select, insert, update on public.finance_monthly_openings to authenticated;
grant all on public.finance_monthly_openings to service_role;

create policy finance_monthly_openings_read on public.finance_monthly_openings
  for select to authenticated using (
    exists (
      select 1 from public.commerce_admin_users admin
      where admin.user_id = (select auth.uid()) and admin.active
        and (admin.access_user_id = 't1' or admin.allowed_paths is null
          or admin.allowed_paths && array['/finanzas/resumen', '/finanzas/egresos', '/finanzas/conciliacion']::text[])
    )
  );
create policy finance_monthly_openings_insert on public.finance_monthly_openings
  for insert to authenticated with check ((select private.can_write_finance_close()));
create policy finance_monthly_openings_update on public.finance_monthly_openings
  for update to authenticated using ((select private.can_write_finance_close()))
  with check ((select private.can_write_finance_close()));
