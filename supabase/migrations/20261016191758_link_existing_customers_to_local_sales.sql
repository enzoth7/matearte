-- The legacy sales RPC still needs a local_sales_customers foreign key. This
-- link points that operational row at the already existing Gestión identity,
-- without treating a later in-store purchase as a new customer acquisition.
alter table public.local_sales_customers
  add column if not exists linked_customer_id text;

create unique index if not exists local_sales_customers_linked_customer_id_idx
  on public.local_sales_customers (linked_customer_id)
  where linked_customer_id is not null;

comment on column public.local_sales_customers.linked_customer_id is
  'Canonical Gestión customer ID for an existing Web, Sorteo or wholesale contact linked to a local sale; not a new lead source.';
