-- Los cobros de una consignación se registran en su cuenta ARS.
create function private.guard_wholesale_consignment_opening()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.wholesale_consignments where order_id = new.sale_id)
    and (coalesce(new.collected_arg_minor, 0) <> 0
      or coalesce(new.collected_minor, 0) <> 0
      or new.paid_in_full_without_price or new.finance_paid_at_order) then
    raise exception 'Registrá el pago desde la cuenta de la consignación' using errcode = '22023';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_wholesale_consignment_opening() from public, anon, authenticated;
create trigger wholesale_opening_consignment_guard
  before insert or update on public.wholesale_order_payment_openings
  for each row execute function private.guard_wholesale_consignment_opening();
