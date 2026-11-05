-- Enzo confirmed the original purchase date of R006 was 18 October 2026.
-- This is a single historical correction; the immutable-date guard stays on.
do $$
declare
  changed integer;
begin
  if not exists (
    select 1 from public.orders
    where id = 'f88fdb67-1c52-497b-9fdf-f881dd72f6c3'
      and reference_code = '#R004' and sold_on = date '2026-10-27'
  ) then raise exception 'R004 no longer has its confirmed original date'; end if;

  if not exists (
    select 1 from public.orders
    where id = '040b964d-9e5a-4932-9816-5cbc07b19b00'
      and reference_code = '#R006' and sold_on = date '2026-11-05'
  ) then raise exception 'R006 has changed since the original-date review'; end if;

  execute 'alter table public.orders disable trigger orders_preserve_original_sale_date';
  update public.orders set sold_on = date '2026-10-18'
  where id = '040b964d-9e5a-4932-9816-5cbc07b19b00'
    and reference_code = '#R006' and sold_on = date '2026-11-05';
  get diagnostics changed = row_count;
  if changed <> 1 then raise exception 'R006 correction updated % rows', changed; end if;
  execute 'alter table public.orders enable trigger orders_preserve_original_sale_date';

  update public.contacts customer
  set first_purchase_date = purchase.first_on,
      last_purchase_date = purchase.last_on
  from (
    select min(sold_on) as first_on, max(sold_on) as last_on
    from public.orders
    where contact_id = '74fcdfd9-c8bc-4cfa-9829-337f04cb19a9'::uuid
      and channel in ('Local', 'Feria', 'WhatsApp', 'Facebook', 'Instagram')
  ) purchase
  where customer.id = '74fcdfd9-c8bc-4cfa-9829-337f04cb19a9'::uuid;
end;
$$;
