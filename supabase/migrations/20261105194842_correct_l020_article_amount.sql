-- Enzo confirmed that the article on #L020 was sold for UYU 4,100.
-- Keep the original sale date and initial collection untouched.
do $$
declare
  changed_count integer;
begin
  perform 1
  from public.orders
  where id = '498afe4e-4ead-42be-9bca-479f6814aefc'::uuid
    and reference_code = '#L020'
    and sold_on = date '2026-10-09'
    and total_minor = 410000
    and deposit_minor is null
    and payment_method = 'Transferencia'
  for update;

  if not found then
    raise exception 'L020 original sale or initial collection no longer matches the verified record';
  end if;

  if exists (
    select 1 from public.local_sale_receipts
    where sale_id = '498afe4e-4ead-42be-9bca-479f6814aefc'::uuid
  ) then
    raise exception 'L020 has a later receipt; review before correcting its article';
  end if;

  update public.order_items
  set unit_price_minor = 410000,
      total_minor = 410000
  where id = '52261863-c3f1-4a9e-91c5-18237d3c539b'::uuid
    and order_id = '498afe4e-4ead-42be-9bca-479f6814aefc'::uuid
    and sku = '207'
    and quantity = 1
    and unit_price_minor = 4100000
    and total_minor = 4100000;

  get diagnostics changed_count = row_count;
  if changed_count <> 1 then
    raise exception 'L020 article no longer matches the verified amount';
  end if;
end;
$$;
