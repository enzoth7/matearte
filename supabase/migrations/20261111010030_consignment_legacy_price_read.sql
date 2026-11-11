-- Mantiene la lectura de la versión publicada mientras se actualiza Gestión.
-- El panel nuevo usa unit_price_minor. Las consignaciones anteriores están en ARS.
alter table public.wholesale_consignment_lines
  add column if not exists unit_price_arg_minor bigint
  generated always as (unit_price_minor) stored;

notify pgrst, 'reload schema';
