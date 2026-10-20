-- La agenda comparte las fichas minoristas, pero no representa una venta.
alter table public.local_sales_customers
  add column if not exists agenda_import_key text,
  add column if not exists agenda_additional_phones text[] not null default '{}',
  add column if not exists agenda_inferred_category text;

create unique index if not exists local_sales_customers_agenda_import_key_idx
  on public.local_sales_customers (agenda_import_key)
  where agenda_import_key is not null;

create index if not exists local_sales_customers_updated_at_id_idx
  on public.local_sales_customers (updated_at, id);

grant update (agenda_import_key, agenda_additional_phones, agenda_inferred_category)
  on table public.local_sales_customers to authenticated;

comment on column public.local_sales_customers.agenda_import_key is
  'Hash estable del teléfono principal normalizado; identifica importaciones repetidas de la agenda.';
comment on column public.local_sales_customers.agenda_inferred_category is
  'Categoría estimada a partir del nombre del contacto; no acredita una venta.';
