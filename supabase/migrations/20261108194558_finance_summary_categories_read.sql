drop policy if exists expense_categories_read on public.expense_categories;
create policy expense_categories_read on public.expense_categories
  for select to authenticated using (
    (select private.can_read_finance_expenses()) or exists (
      select 1 from public.commerce_admin_users admin
      where admin.user_id = (select auth.uid()) and admin.active
        and '/finanzas/resumen' = any(admin.allowed_paths)
    )
  );
