alter table public.local_sales_customers add column if not exists company_name text;

grant select, insert, update (company_name)
  on table public.local_sales_customers to authenticated;

comment on column public.local_sales_customers.company_name is
  'Empresa o institución asociada al contacto minorista; no representa una venta ni un canal.';
