alter table public.purchases
  add column exchange_rate_to_uyu numeric(18,8);
alter table public.purchases
  drop constraint purchases_currency_check;
alter table public.purchases
  add constraint purchases_currency_check check (currency in ('UYU', 'USD', 'ARS')),
  add constraint purchases_exchange_rate_to_uyu_check
    check (exchange_rate_to_uyu is null or exchange_rate_to_uyu > 0);

alter table public.finance_manual_incomes
  add column currency text not null default 'UYU',
  add column exchange_rate_to_uyu numeric(18,8),
  add constraint finance_manual_incomes_currency_check check (currency in ('UYU', 'USD', 'ARS')),
  add constraint finance_manual_incomes_exchange_rate_to_uyu_check
    check (currency = 'UYU' or exchange_rate_to_uyu > 0);

drop trigger gestion_audit_change on public.purchases;
drop trigger gestion_audit_delete on public.purchases;
create trigger gestion_audit_change after insert or update on public.purchases
  for each row execute function private.gestion_audit_change(
    'Compra o gasto',
    'purchased_on,supplier,description,category,amount_minor,currency,exchange_rate_to_uyu,payment_method,status,paid_on,invoice_number,notes',
    'amount_minor');
create trigger gestion_audit_delete before delete on public.purchases
  for each row execute function private.gestion_audit_change(
    'Compra o gasto',
    'purchased_on,supplier,description,category,amount_minor,currency,exchange_rate_to_uyu,payment_method,status,paid_on,invoice_number,notes',
    'amount_minor');

drop trigger gestion_audit_change on public.finance_manual_incomes;
drop trigger gestion_audit_delete on public.finance_manual_incomes;
create trigger gestion_audit_change after insert or update on public.finance_manual_incomes
  for each row execute function private.gestion_audit_change(
    'Ingreso adicional', 'received_on,category,description,amount_minor,currency,exchange_rate_to_uyu', 'amount_minor');
create trigger gestion_audit_delete before delete on public.finance_manual_incomes
  for each row execute function private.gestion_audit_change(
    'Ingreso adicional', 'received_on,category,description,amount_minor,currency,exchange_rate_to_uyu', 'amount_minor');
