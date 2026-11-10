create or replace function private.can_manage_personnel_hours()
returns boolean language sql stable security definer set search_path = '' as $$
  select private.gestion_has_page_access('/personal/horas');
$$;

create function private.can_write_finance_adjustment()
returns boolean language sql stable security definer set search_path = '' as $$
  select private.gestion_has_page_access('/finanzas/resumen')
    or private.gestion_has_page_access('/finanzas/conciliacion');
$$;
revoke all on function private.can_write_finance_adjustment() from public, anon;
grant execute on function private.can_write_finance_adjustment() to authenticated;

drop policy if exists finance_monthly_adjustments_insert on public.finance_monthly_adjustments;
create policy finance_monthly_adjustments_insert on public.finance_monthly_adjustments
  for insert to authenticated with check ((select private.can_write_finance_adjustment()));
drop policy if exists finance_monthly_adjustments_update on public.finance_monthly_adjustments;
create policy finance_monthly_adjustments_update on public.finance_monthly_adjustments
  for update to authenticated using ((select private.can_write_finance_adjustment()))
  with check ((select private.can_write_finance_adjustment()));
