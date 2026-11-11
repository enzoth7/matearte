-- Compare acquisition and retail transactions by their own Uruguay calendar dates.
-- Local, fair and social sales are already represented in orders, so count each order once.
create or replace view public.marketing_daily_registrations_retail_sales as
with bounds as (
  select (now() at time zone 'America/Montevideo')::date - 29 as first_day
), registrations as (
  select (account.created_at at time zone 'America/Montevideo')::date as day,
    count(*)::integer as registrations
  from auth.users account
  cross join bounds
  where account.created_at >= bounds.first_day at time zone 'America/Montevideo'
    and not exists (
      select 1 from public.commerce_admin_users staff where staff.user_id = account.id
    )
  group by 1
), retail_sales as (
  select sales.day, count(*)::integer as retail_sales
  from (
    select (sale.paid_at at time zone 'America/Montevideo')::date as day
    from public.orders sale
    cross join bounds
    where sale.channel = 'Web'
      and sale.paid_at >= bounds.first_day at time zone 'America/Montevideo'
      and sale.customer_snapshot ->> 'purchaseFlow' is distinct from 'wholesale_bank_transfer'
    union all
    select sale.sold_on as day
    from public.orders sale
    cross join bounds
    where sale.channel in ('Local', 'Feria', 'WhatsApp', 'Instagram', 'Facebook')
      and sale.status = 'internal_completed'
      and sale.sold_on >= bounds.first_day
  ) sales
  group by sales.day
)
select coalesce(registrations.day, retail_sales.day) as day,
  coalesce(registrations.registrations, 0) as registrations,
  coalesce(retail_sales.retail_sales, 0) as retail_sales
from registrations
full join retail_sales on retail_sales.day = registrations.day;

comment on view public.marketing_daily_registrations_retail_sales is
  'New accounts and completed retail transactions by their respective Uruguay calendar dates, for the last 30 days.';
revoke all on public.marketing_daily_registrations_retail_sales from public, anon, authenticated;
grant select on public.marketing_daily_registrations_retail_sales to service_role;
