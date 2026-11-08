create trigger gestion_audit_change after insert or update on public.finance_manual_incomes
  for each row execute function private.gestion_audit_change(
    'Ingreso adicional', 'received_on,category,description,amount_minor', 'amount_minor');
create trigger gestion_audit_delete before delete on public.finance_manual_incomes
  for each row execute function private.gestion_audit_change(
    'Ingreso adicional', 'received_on,category,description,amount_minor', 'amount_minor');

drop trigger gestion_audit_change on public.fixed_expense_payments;
drop trigger gestion_audit_delete on public.fixed_expense_payments;
create trigger gestion_audit_change after insert or update on public.fixed_expense_payments
  for each row execute function private.gestion_audit_change(
    'Pago de gasto fijo', 'fixed_expense_id,month,amount_minor,paid_on,exchange_rate_to_uyu', 'amount_minor');
create trigger gestion_audit_delete before delete on public.fixed_expense_payments
  for each row execute function private.gestion_audit_change(
    'Pago de gasto fijo', 'fixed_expense_id,month,amount_minor,paid_on,exchange_rate_to_uyu', 'amount_minor');
