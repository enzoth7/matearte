alter table public.order_items
  add column if not exists production_status text not null default 'pending'
  constraint order_items_production_status_check
  check (production_status in ('pending', 'in_production', 'completed'));

comment on column public.order_items.production_status is
  'Internal retail production workflow, independent from the commerce order status.';

alter table public.local_sale_items
  add column if not exists production_status text not null default 'pending'
  constraint local_sale_items_production_status_check
  check (production_status in ('pending', 'in_production', 'completed'));

comment on column public.local_sale_items.production_status is
  'Internal retail production workflow for products sold at the physical shop.';

grant update (production_status) on public.order_items to authenticated;
grant update (production_status) on public.local_sale_items to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'local_sale_items'
      and policyname = 'staff can update local sale production status'
  ) then
    create policy "staff can update local sale production status"
      on public.local_sale_items
      for update
      to authenticated
      using (
        (select private.is_pricing_admin())
        or (select private.is_commerce_admin())
      )
      with check (
        (select private.is_pricing_admin())
        or (select private.is_commerce_admin())
      );
  end if;
end
$$;
