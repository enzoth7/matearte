-- Una política de lectura y tres políticas de escritura independientes.
do $$
declare target_table text;
begin
  foreach target_table in array array[
    'expense_categories', 'purchases', 'fixed_expenses', 'fixed_expense_payments'
  ] loop
    execute format('drop policy if exists %I on public.%I', target_table || '_write', target_table);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check ((select private.can_manage_purchases()))',
      target_table || '_insert', target_table
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using ((select private.can_manage_purchases())) with check ((select private.can_manage_purchases()))',
      target_table || '_update', target_table
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated using ((select private.can_manage_purchases()))',
      target_table || '_delete', target_table
    );
  end loop;
end;
$$;

create index finance_accounts_created_by_idx on public.finance_accounts (created_by);
create index finance_monthly_closes_created_by_idx on public.finance_monthly_closes (created_by);
