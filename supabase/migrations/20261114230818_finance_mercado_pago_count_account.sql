insert into public.finance_accounts (name, kind, currency)
select 'Mercado Pago', 'wallet', 'UYU'
where not exists (
  select 1 from public.finance_accounts
  where lower(btrim(name)) = lower('Mercado Pago') and currency = 'UYU'
);
