-- Once a sale date is recorded, later edits must preserve it. Pending orders
-- without a sale date may still receive their first actual sale date.
create function private.preserve_original_sale_date()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if old.sold_on is not null and new.sold_on is distinct from old.sold_on then
    new.sold_on := old.sold_on;
  end if;
  return new;
end;
$$;

revoke all on function private.preserve_original_sale_date() from public, anon, authenticated, service_role;

create trigger orders_preserve_original_sale_date
before update on public.orders
for each row execute function private.preserve_original_sale_date();
