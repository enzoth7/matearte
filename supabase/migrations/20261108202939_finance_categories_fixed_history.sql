-- Los seis gastos fijos vigentes se pagaron también entre julio y septiembre de 2026.
alter table public.fixed_expense_payments
  add column exchange_rate_to_uyu numeric check (exchange_rate_to_uyu > 0);

update public.fixed_expenses
set starts_on = date '2026-07-01'
where starts_on = date '2026-10-25' and ends_on is null
  and name in ('Alquiler Galpón Colon', 'Alquiler local pdu', 'BPS',
    'Instagram', 'Monotributo Flor', 'Sueldo del taller');

insert into public.fixed_expense_payments (fixed_expense_id, month, amount_minor, paid_on, exchange_rate_to_uyu)
select fixed.id, months.month, fixed.amount_minor,
  (months.month + interval '1 month - 1 day')::date,
  case when fixed.currency = 'UYU' then 1 else rates.rate_to_uyu end
from public.fixed_expenses fixed
cross join (values (date '2026-07-01'), (date '2026-08-01'), (date '2026-09-01')) months(month)
left join public.commerce_exchange_rates rates on rates.currency_code = fixed.currency
where fixed.starts_on = date '2026-07-01' and fixed.ends_on is null
  and fixed.name in ('Alquiler Galpón Colon', 'Alquiler local pdu', 'BPS',
    'Instagram', 'Monotributo Flor', 'Sueldo del taller')
on conflict (fixed_expense_id, month) do nothing;

update public.fixed_expense_payments payment
set exchange_rate_to_uyu = rates.rate_to_uyu
from public.fixed_expenses fixed
join public.commerce_exchange_rates rates on rates.currency_code = fixed.currency
where payment.fixed_expense_id = fixed.id and payment.exchange_rate_to_uyu is null;

-- Unificar las etiquetas existentes sin alterar importes ni fechas.
update public.purchases set category = 'Envíos y logística' where category = 'envio';
update public.expense_categories set active = false where name = 'envio';
update public.purchases set category = 'Local' where category = 'LOCAL';
update public.expense_categories set name = 'Local' where name = 'LOCAL';

insert into public.expense_categories (name, kind)
select 'Alimentación', 'compra'
where not exists (select 1 from public.expense_categories where name = 'Alimentación');

update public.purchases set category = 'Alimentación'
where (category = 'Otros' and lower(btrim(description)) in ('comida', 'postre', 'tata'))
  or (category = 'Local' and upper(btrim(description)) = 'TATA');

update public.expense_categories set kind = 'ambas'
where name in ('Transporte', 'Sueldos y cargas sociales');
update public.purchases set category = 'Transporte'
where category = 'Otros' and (
  description like 'CRISBEL VIAJES%' or description like 'TAXI LUIS MORENI%');
update public.purchases set category = 'Servicios'
where category = 'Otros' and description like 'Teléfono - cuenta Flor%';
update public.purchases set category = 'Sueldos y cargas sociales'
where category = 'Otros' and description in (
  'Pago a Julio Cardozo - semana de taller',
  'Pago a Nicolás - sueldo del taller');
update public.fixed_expenses set category = 'Marketing y publicidad'
where name = 'Instagram' and category = 'Sueldos y cargas sociales';

-- Categorías para ingresos registrados fuera de ventas y cobros de pedidos.
create table public.finance_income_categories (
  name text primary key check (char_length(btrim(name)) between 1 and 60),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
insert into public.finance_income_categories (name) values
  ('Ingresos extraordinarios'), ('Otros'), ('Devolución impuestos');

create table public.finance_manual_incomes (
  id uuid primary key default gen_random_uuid(),
  received_on date not null,
  category text not null references public.finance_income_categories(name),
  description text not null check (char_length(btrim(description)) between 1 and 200),
  amount_minor bigint not null check (amount_minor > 0),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index finance_manual_incomes_received_on_idx on public.finance_manual_incomes (received_on);

alter table public.finance_income_categories enable row level security;
alter table public.finance_manual_incomes enable row level security;
revoke all on public.finance_income_categories, public.finance_manual_incomes from public, anon, authenticated;
grant select, insert on public.finance_income_categories, public.finance_manual_incomes to authenticated;
grant delete on public.finance_manual_incomes to authenticated;
grant all on public.finance_income_categories, public.finance_manual_incomes to service_role;

create policy finance_income_categories_read on public.finance_income_categories
  for select to authenticated using (
    exists (select 1 from public.commerce_admin_users admin
      where admin.user_id = (select auth.uid()) and admin.active
        and (admin.access_user_id = 't1' or admin.allowed_paths is null
          or '/finanzas/resumen' = any(admin.allowed_paths)))
  );
create policy finance_income_categories_insert on public.finance_income_categories
  for insert to authenticated with check ((select private.can_write_finance_close()));
create policy finance_manual_incomes_read on public.finance_manual_incomes
  for select to authenticated using (
    exists (select 1 from public.commerce_admin_users admin
      where admin.user_id = (select auth.uid()) and admin.active
        and (admin.access_user_id = 't1' or admin.allowed_paths is null
          or '/finanzas/resumen' = any(admin.allowed_paths)))
  );
create policy finance_manual_incomes_insert on public.finance_manual_incomes
  for insert to authenticated with check ((select private.can_write_finance_close())
    and created_by = (select auth.uid()));
create policy finance_manual_incomes_delete on public.finance_manual_incomes
  for delete to authenticated using ((select private.can_write_finance_close()));
