-- Each visible subtab grants its own operations. The owner retains full access.
update public.commerce_admin_users
set allowed_paths = array_remove(allowed_paths, '/finanzas/editar-egresos')
where allowed_paths is not null and '/finanzas/editar-egresos' = any(allowed_paths);

create or replace function private.gestion_has_page_access(p_path text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.commerce_admin_users admin
    where admin.user_id = (select auth.uid())
      and admin.active
      and (admin.access_user_id = 't1' or p_path = any(admin.allowed_paths))
  );
$$;
revoke all on function private.gestion_has_page_access(text) from public, anon;
grant execute on function private.gestion_has_page_access(text) to authenticated;

create or replace function private.gestion_logs_allowed()
returns boolean language sql stable security definer set search_path = '' as $$
  select private.gestion_has_page_access('/administracion/logs');
$$;

create or replace function private.can_manage_inventory_costs()
returns boolean language sql stable security definer set search_path = '' as $$
  select private.gestion_has_page_access('/inventario/insumos')
    or private.gestion_has_page_access('/inventario/fabricados')
    or private.gestion_has_page_access('/inventario/reventa');
$$;

drop policy if exists inventory_cost_profiles_richard on public.inventory_cost_profiles;
create policy inventory_cost_profiles_access on public.inventory_cost_profiles
  for all to authenticated
  using ((select private.can_manage_inventory_costs()))
  with check ((select private.gestion_has_page_access('/inventario/insumos'))
    or (select private.gestion_has_page_access('/inventario/reventa')));

drop policy if exists inventory_cost_lines_richard on public.inventory_cost_lines;
create policy inventory_cost_lines_read on public.inventory_cost_lines
  for select to authenticated using (
    case when kind = 'purchase' then (select private.gestion_has_page_access('/inventario/reventa'))
    else (select private.gestion_has_page_access('/inventario/insumos'))
      or (select private.gestion_has_page_access('/inventario/fabricados')) end
  );
create policy inventory_cost_lines_insert on public.inventory_cost_lines
  for insert to authenticated with check (
    case when kind = 'purchase' then (select private.gestion_has_page_access('/inventario/reventa'))
    else (select private.gestion_has_page_access('/inventario/insumos')) end
  );
create policy inventory_cost_lines_update on public.inventory_cost_lines
  for update to authenticated
  using (case when kind = 'purchase' then (select private.gestion_has_page_access('/inventario/reventa'))
    else (select private.gestion_has_page_access('/inventario/insumos')) end)
  with check (case when kind = 'purchase' then (select private.gestion_has_page_access('/inventario/reventa'))
    else (select private.gestion_has_page_access('/inventario/insumos')) end);
create policy inventory_cost_lines_delete on public.inventory_cost_lines
  for delete to authenticated using (
    case when kind = 'purchase' then (select private.gestion_has_page_access('/inventario/reventa'))
    else (select private.gestion_has_page_access('/inventario/insumos')) end
  );

drop policy if exists inventory_manufactured_products_richard on public.inventory_manufactured_products;
create policy inventory_manufactured_products_access on public.inventory_manufactured_products
  for all to authenticated
  using ((select private.gestion_has_page_access('/inventario/fabricados')))
  with check ((select private.gestion_has_page_access('/inventario/fabricados')));
drop policy if exists inventory_manufactured_supplies_richard on public.inventory_manufactured_supplies;
create policy inventory_manufactured_supplies_access on public.inventory_manufactured_supplies
  for all to authenticated
  using ((select private.gestion_has_page_access('/inventario/fabricados')))
  with check ((select private.gestion_has_page_access('/inventario/fabricados')));

create or replace function private.can_manage_purchases()
returns boolean language sql stable security definer set search_path = '' as $$
  select private.gestion_has_page_access('/finanzas/egresos');
$$;
create or replace function private.can_read_finance_expenses()
returns boolean language sql stable security definer set search_path = '' as $$
  select private.gestion_has_page_access('/finanzas/egresos')
    or private.gestion_has_page_access('/finanzas/gastos-fijos')
    or private.gestion_has_page_access('/finanzas/resumen')
    or private.gestion_has_page_access('/finanzas/conciliacion');
$$;
create or replace function private.can_manage_fixed_expenses()
returns boolean language sql stable security definer set search_path = '' as $$
  select private.gestion_has_page_access('/finanzas/gastos-fijos');
$$;
revoke all on function private.can_manage_fixed_expenses() from public, anon;
grant execute on function private.can_manage_fixed_expenses() to authenticated;

-- Expense categories are shared by two subtabs; the row kind decides who can edit it.
drop policy if exists expense_categories_insert on public.expense_categories;
drop policy if exists expense_categories_update on public.expense_categories;
drop policy if exists expense_categories_delete on public.expense_categories;
create policy expense_categories_insert on public.expense_categories for insert to authenticated
  with check (case when kind = 'gasto_fijo' then (select private.can_manage_fixed_expenses())
    when kind = 'compra' then (select private.can_manage_purchases())
    else (select private.can_manage_purchases()) or (select private.can_manage_fixed_expenses()) end);
create policy expense_categories_update on public.expense_categories for update to authenticated
  using (case when kind = 'gasto_fijo' then (select private.can_manage_fixed_expenses())
    when kind = 'compra' then (select private.can_manage_purchases())
    else (select private.can_manage_purchases()) or (select private.can_manage_fixed_expenses()) end)
  with check (case when kind = 'gasto_fijo' then (select private.can_manage_fixed_expenses())
    when kind = 'compra' then (select private.can_manage_purchases())
    else (select private.can_manage_purchases()) or (select private.can_manage_fixed_expenses()) end);
create policy expense_categories_delete on public.expense_categories for delete to authenticated
  using (case when kind = 'gasto_fijo' then (select private.can_manage_fixed_expenses())
    when kind = 'compra' then (select private.can_manage_purchases())
    else (select private.can_manage_purchases()) or (select private.can_manage_fixed_expenses()) end);

do $$
declare target_table text;
begin
  foreach target_table in array array['fixed_expenses', 'fixed_expense_payments'] loop
    execute format('drop policy if exists %I on public.%I', target_table || '_insert', target_table);
    execute format('drop policy if exists %I on public.%I', target_table || '_update', target_table);
    execute format('drop policy if exists %I on public.%I', target_table || '_delete', target_table);
    execute format('create policy %I on public.%I for insert to authenticated with check ((select private.can_manage_fixed_expenses()))', target_table || '_insert', target_table);
    execute format('create policy %I on public.%I for update to authenticated using ((select private.can_manage_fixed_expenses())) with check ((select private.can_manage_fixed_expenses()))', target_table || '_update', target_table);
    execute format('create policy %I on public.%I for delete to authenticated using ((select private.can_manage_fixed_expenses()))', target_table || '_delete', target_table);
  end loop;
end;
$$;

create or replace function private.can_write_finance_close()
returns boolean language sql stable security definer set search_path = '' as $$
  select private.gestion_has_page_access('/finanzas/conciliacion');
$$;
create or replace function private.can_write_finance_income()
returns boolean language sql stable security definer set search_path = '' as $$
  select private.gestion_has_page_access('/finanzas/ingresos');
$$;
revoke all on function private.can_write_finance_income() from public, anon;
grant execute on function private.can_write_finance_income() to authenticated;

drop policy if exists finance_income_categories_read on public.finance_income_categories;
create policy finance_income_categories_read on public.finance_income_categories for select to authenticated
  using ((select private.gestion_has_page_access('/finanzas/ingresos'))
    or (select private.gestion_has_page_access('/finanzas/resumen'))
    or (select private.gestion_has_page_access('/finanzas/conciliacion')));
drop policy if exists finance_income_categories_insert on public.finance_income_categories;
create policy finance_income_categories_insert on public.finance_income_categories for insert to authenticated
  with check ((select private.can_write_finance_income()));
drop policy if exists finance_manual_incomes_read on public.finance_manual_incomes;
create policy finance_manual_incomes_read on public.finance_manual_incomes for select to authenticated
  using ((select private.gestion_has_page_access('/finanzas/ingresos'))
    or (select private.gestion_has_page_access('/finanzas/resumen'))
    or (select private.gestion_has_page_access('/finanzas/conciliacion')));
drop policy if exists finance_manual_incomes_insert on public.finance_manual_incomes;
create policy finance_manual_incomes_insert on public.finance_manual_incomes for insert to authenticated
  with check ((select private.can_write_finance_income()) and created_by = (select auth.uid()));
drop policy if exists finance_manual_incomes_delete on public.finance_manual_incomes;
create policy finance_manual_incomes_delete on public.finance_manual_incomes for delete to authenticated
  using ((select private.can_write_finance_income()));

drop policy if exists finance_monthly_openings_insert on public.finance_monthly_openings;
create policy finance_monthly_openings_insert on public.finance_monthly_openings for insert to authenticated
  with check ((select private.gestion_has_page_access('/finanzas/egresos')));
drop policy if exists finance_monthly_openings_update on public.finance_monthly_openings;
create policy finance_monthly_openings_update on public.finance_monthly_openings for update to authenticated
  using ((select private.gestion_has_page_access('/finanzas/egresos')))
  with check ((select private.gestion_has_page_access('/finanzas/egresos')));
