alter table public.finance_manual_incomes
  drop constraint finance_manual_incomes_exchange_rate_to_uyu_check;

alter table public.finance_manual_incomes
  add constraint finance_manual_incomes_exchange_rate_to_uyu_check
    check (currency = 'UYU' or (exchange_rate_to_uyu is not null and exchange_rate_to_uyu > 0));
