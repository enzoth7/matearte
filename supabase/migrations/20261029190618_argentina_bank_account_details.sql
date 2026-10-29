-- Optional details from the Argentine bank's account screen. CBU and alias
-- remain the domestic-transfer identifiers frozen on each order.
alter table public.commerce_argentina_settings
  add column account_type text not null default '',
  add column account_name text not null default '',
  add column account_number text not null default '',
  add column swift_code text not null default '',
  add column branch text not null default '';
