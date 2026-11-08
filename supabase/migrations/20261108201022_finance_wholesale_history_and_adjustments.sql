alter table public.wholesale_order_payment_openings
  add column finance_paid_at_order boolean not null default false;

with lines as (
  select order_id, round(sum(total_arg) * 100)::bigint as total_arg_minor
  from public.order_items group by order_id
), receipts as (
  select sale_id, sum(source_amount_minor)::bigint as paid_arg_minor
  from public.wholesale_order_receipts group by sale_id
)
update public.wholesale_order_payment_openings opening
set finance_paid_at_order = true
from public.orders sale
join lines on lines.order_id = sale.id
left join receipts on receipts.sale_id = sale.id
where opening.sale_id = sale.id
  and sale.channel = 'Mayorista'
  and opening.collected_arg_minor is not null
  and lines.total_arg_minor <= opening.collected_arg_minor + coalesce(receipts.paid_arg_minor, 0)
  and not exists (select 1 from public.wholesale_consignments consignment where consignment.order_id = sale.id);

create table public.finance_monthly_adjustments (
  month date primary key check (extract(day from month) = 1),
  amount_minor bigint not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

alter table public.finance_monthly_adjustments enable row level security;
revoke all on public.finance_monthly_adjustments from public, anon, authenticated;
grant select, insert, update on public.finance_monthly_adjustments to authenticated;
grant all on public.finance_monthly_adjustments to service_role;

create policy finance_monthly_adjustments_read on public.finance_monthly_adjustments
  for select to authenticated using (
    exists (
      select 1 from public.commerce_admin_users admin
      where admin.user_id = (select auth.uid()) and admin.active
        and (admin.access_user_id = 't1' or admin.allowed_paths is null
          or admin.allowed_paths && array['/finanzas/resumen', '/finanzas/egresos', '/finanzas/conciliacion']::text[])
    )
  );
create policy finance_monthly_adjustments_insert on public.finance_monthly_adjustments
  for insert to authenticated with check ((select private.can_write_finance_close()));
create policy finance_monthly_adjustments_update on public.finance_monthly_adjustments
  for update to authenticated using ((select private.can_write_finance_close()))
  with check ((select private.can_write_finance_close()));
