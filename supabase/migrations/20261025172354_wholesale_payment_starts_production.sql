-- A verified wholesale bank transfer is the production authorization for the
-- order. Keep the existing payment and rejection behavior, and start every
-- still-pending line as part of the same transaction.
create or replace function public.review_wholesale_bank_transfer_order(
  p_admin_id uuid,
  p_order_id uuid,
  p_decision text,
  p_reason text default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_receipt public.commerce_bank_transfer_receipts%rowtype;
  v_has_custom boolean := false;
  v_target_status text;
  v_reason text := nullif(left(btrim(coalesce(p_reason, '')), 500), '');
begin
  if not exists (
    select 1 from public.commerce_admin_users
    where user_id = p_admin_id and active
  ) then
    raise exception 'No tenés acceso al panel comercial';
  end if;
  if p_decision not in ('approve', 'reject') then
    raise exception 'Decisión inválida';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found or v_order.status <> 'payment_verification_pending'
     or v_order.customer_snapshot ->> 'purchaseFlow' <> 'wholesale_bank_transfer' then
    raise exception 'El pedido no está pendiente de verificación';
  end if;

  select * into v_receipt
  from public.commerce_bank_transfer_receipts
  where order_id = p_order_id
  for update;
  if not found or v_receipt.status <> 'pending' then
    raise exception 'El comprobante ya fue revisado';
  end if;

  if p_decision = 'approve' then
    select exists (
      select 1 from public.order_items where order_id = p_order_id and requires_review
    ) into v_has_custom;
    v_target_status := case when v_has_custom then 'paid_pending_review' else 'ready_for_fulfillment' end;

    update public.commerce_bank_transfer_receipts
    set status = 'approved', reviewed_by = p_admin_id, reviewed_at = now(), rejection_reason = null
    where id = v_receipt.id;

    insert into public.commerce_payments (
      order_id, provider, provider_payment_id, status, status_detail,
      amount_minor, currency, raw_payload, approved_at
    ) values (
      p_order_id, 'bank_transfer', 'bank-transfer:' || v_receipt.id::text,
      'approved', 'manually_verified', v_order.total_minor, 'UYU',
      jsonb_build_object('receiptId', v_receipt.id, 'reviewedBy', p_admin_id), now()
    ) on conflict (provider_payment_id) do nothing;

    update public.orders
    set status = v_target_status, paid_at = now()
    where id = p_order_id;

    update public.order_items
    set production_status = 'in_production', completed_at = null
    where order_id = p_order_id
      and coalesce(production_status, 'pending') = 'pending';
  else
    if v_reason is null or char_length(v_reason) < 5 then
      raise exception 'Indicá el motivo del rechazo';
    end if;
    v_target_status := 'cancelled';
    update public.commerce_bank_transfer_receipts
    set status = 'rejected', reviewed_by = p_admin_id, reviewed_at = now(), rejection_reason = v_reason
    where id = v_receipt.id;
    update public.orders
    set status = 'cancelled', cancelled_at = now()
    where id = p_order_id;
  end if;

  delete from public.commerce_email_outbox where order_id = p_order_id;

  return jsonb_build_object(
    'id', p_order_id,
    'status', v_target_status,
    'productionStatus', case when p_decision = 'approve' then 'in_production' else null end,
    'receiptStatus', case when p_decision = 'approve' then 'approved' else 'rejected' end
  );
end;
$$;

revoke all on function public.review_wholesale_bank_transfer_order(uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.review_wholesale_bank_transfer_order(uuid, uuid, text, text)
  to service_role;
