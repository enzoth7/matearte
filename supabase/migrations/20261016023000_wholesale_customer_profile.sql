-- Gestión conserva la tabla mayorista compartida con el dashboard anterior.
alter table public.customers
  add column if not exists company_name text,
  add column if not exists birth_date date,
  add column if not exists city text,
  add column if not exists country text;

-- Los pedidos mayoristas guardan el nombre del cliente como texto. Al editarlo,
-- se conserva la asociación histórica en ambos paneles.
create or replace function public.sync_wholesale_customer_name()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.full_name is distinct from old.full_name then
    update public.order_lines
       set customer = new.full_name
     where customer = old.full_name;
  end if;
  return new;
end;
$$;

drop trigger if exists customers_sync_order_lines_name on public.customers;
create trigger customers_sync_order_lines_name
after update of full_name on public.customers
for each row execute function public.sync_wholesale_customer_name();
