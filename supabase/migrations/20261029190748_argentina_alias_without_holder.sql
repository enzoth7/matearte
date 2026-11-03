-- Domestic transfers can use the bank's alias and CBU without a holder name.
alter table public.commerce_argentina_settings
  drop constraint commerce_argentina_settings_check;

alter table public.commerce_argentina_settings
  add constraint commerce_argentina_settings_check
  check (not enabled or (
    length(btrim(bank_name)) > 1
    and cbu ~ '^[0-9]{22}$'
    and length(btrim(alias)) > 0
  ));
