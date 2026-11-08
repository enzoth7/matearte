create function public.finance_summary_adjustments()
returns table(month date, withdrawals_minor bigint, contributions_minor bigint)
language sql stable security definer set search_path = '' as $$
  with authorized as (
    select 1 from public.commerce_admin_users admin
    where admin.user_id = (select auth.uid()) and admin.active
      and (admin.access_user_id = 't1' or admin.allowed_paths is null
        or '/finanzas/resumen' = any(admin.allowed_paths))
  ), latest as (
    select distinct on (close.month) close.month, close.adjustments, close.rates
    from public.finance_monthly_closes close
    where close.status = 'closed' and exists (select 1 from authorized)
    order by close.month, close.revision desc
  )
  select latest.month,
    coalesce(sum(case when item.value->>'kind' = 'retiro' then
      round((item.value->>'amount_minor')::numeric *
        case when item.value->>'currency' = 'UYU' then 1
          else coalesce((latest.rates->>(item.value->>'currency'))::numeric, 0) end)::bigint
      else 0 end), 0)::bigint as withdrawals_minor,
    coalesce(sum(case when item.value->>'kind' = 'aporte' then
      round((item.value->>'amount_minor')::numeric *
        case when item.value->>'currency' = 'UYU' then 1
          else coalesce((latest.rates->>(item.value->>'currency'))::numeric, 0) end)::bigint
      else 0 end), 0)::bigint as contributions_minor
  from latest
  left join lateral jsonb_array_elements(latest.adjustments) item(value) on true
  group by latest.month;
$$;

revoke all on function public.finance_summary_adjustments() from public, anon;
grant execute on function public.finance_summary_adjustments() to authenticated;
