-- A backdated return or confirmation must not predate the units held by the client.
create function private.guard_wholesale_consignment_movement_timeline()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (
    select 1 from (
      select sum(case when kind = 'dispatch' then quantity else -quantity end)
        over (order by occurred_on, created_at, id) as units_held
      from public.wholesale_consignment_movements where line_id = new.line_id
    ) timeline where units_held < 0
  ) then
    raise exception 'La fecha del movimiento deja unidades negativas en poder del cliente' using errcode = '22023';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_wholesale_consignment_movement_timeline() from public, anon, authenticated;
create trigger wholesale_consignment_movement_timeline after insert on public.wholesale_consignment_movements
  for each row execute function private.guard_wholesale_consignment_movement_timeline();

-- Repetir el identificador de un cobro anticipado no asigna dinero por sorpresa.
create or replace function public.gestion_record_wholesale_consignment_payment(
  p_receipt_id uuid, p_allocation_id uuid, p_consignment_id uuid,
  p_source_amount_minor bigint, p_uyu_per_ars numeric, p_payment_method text,
  p_paid_on date, p_note text default null
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_contact_id uuid;
  v_charge bigint;
  v_applied bigint;
  v_to_apply bigint;
  v_preexisting boolean;
begin
  perform private.require_internal_staff();
  select contact_id into v_contact_id from public.wholesale_consignments where id = p_consignment_id;
  if v_contact_id is null then raise exception 'La consignación no existe' using errcode = '22023'; end if;
  select exists (select 1 from public.customer_account_receipts where id = p_receipt_id) into v_preexisting;
  perform public.gestion_record_customer_account_receipt(p_receipt_id, v_contact_id,
    p_source_amount_minor, 'ARS', p_uyu_per_ars, p_payment_method, p_paid_on, p_note);
  if v_preexisting then
    return jsonb_build_object('receipt_id', p_receipt_id, 'already_recorded', true);
  end if;
  select coalesce(sum(m.quantity * l.unit_price_arg_minor), 0) into v_charge
    from public.wholesale_consignment_lines l
    join public.wholesale_consignment_movements m on m.line_id = l.id and m.kind = 'kept'
    where l.consignment_id = p_consignment_id;
  select coalesce(sum(source_amount_minor), 0) into v_applied
    from public.wholesale_consignment_allocations where consignment_id = p_consignment_id;
  v_to_apply := least(p_source_amount_minor, greatest(0, v_charge - v_applied));
  if v_to_apply > 0 then
    perform public.gestion_allocate_wholesale_consignment_receipt(p_allocation_id,
      p_receipt_id, p_consignment_id, v_to_apply);
  end if;
  return jsonb_build_object('receipt_id', p_receipt_id, 'allocated_arg_minor', v_to_apply,
    'credit_arg_minor', p_source_amount_minor - v_to_apply);
end;
$$;
