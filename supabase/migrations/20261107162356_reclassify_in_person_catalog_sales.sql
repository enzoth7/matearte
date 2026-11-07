-- Keep catalog sales made in person out of the fulfillment state machine,
-- including while an older Gestion release can still display its action.
create or replace function private.guard_in_person_catalog_fulfillment()
returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.channel in ('Local', 'Feria')
     and new.status in ('shipped', 'delivered')
     and new.status is distinct from old.status
     and exists (
       select 1 from public.order_items as item where item.order_id = new.id
     )
     and not exists (
       select 1
       from public.order_items as item
       where item.order_id = new.id
         and (
           item.item_type = 'design'
           or coalesce(item.immutable_snapshot -> 'customization', 'null'::jsonb) <> 'null'::jsonb
         )
     ) then
    raise exception 'Las ventas de catálogo en el local o en feria no requieren envío ni entrega.' using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function private.guard_in_person_catalog_fulfillment() from public, anon, authenticated;

drop trigger if exists orders_guard_in_person_catalog_fulfillment on public.orders;
create trigger orders_guard_in_person_catalog_fulfillment
before update of status on public.orders
for each row execute function private.guard_in_person_catalog_fulfillment();

-- Reclassify only prior Local and Feria fulfillment without personalized items.
update public.orders as sale
set status = 'internal_completed',
    shipping_method = 'pickup',
    shipping_snapshot = '{}'::jsonb,
    shipping_carrier = null,
    tracking_code = null,
    shipped_at = null,
    delivered_at = null
where sale.channel in ('Local', 'Feria')
  and sale.status in ('shipped', 'delivered')
  and exists (
    select 1 from public.order_items as item where item.order_id = sale.id
  )
  and not exists (
    select 1
    from public.order_items as item
    where item.order_id = sale.id
      and (
        item.item_type = 'design'
        or coalesce(item.immutable_snapshot -> 'customization', 'null'::jsonb) <> 'null'::jsonb
      )
  );
