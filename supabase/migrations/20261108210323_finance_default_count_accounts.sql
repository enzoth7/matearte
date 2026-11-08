insert into public.finance_accounts (name, kind, currency)
select account.name, account.kind, account.currency
from (values
  ('Banco Uruguay', 'bank', 'UYU'),
  ('Banco Argentina', 'bank', 'ARS'),
  ('Efectivo', 'cash', 'UYU')
) account(name, kind, currency)
where not exists (
  select 1 from public.finance_accounts existing
  where lower(existing.name) = lower(account.name) and existing.currency = account.currency
);
