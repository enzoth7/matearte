-- Deploy the commerce-email worker with both new events BEFORE applying.
-- Future transfer submissions and approvals only; no backfill.

CREATE OR REPLACE FUNCTION private.enqueue_commerce_email(p_order_id uuid, p_event_type text, p_recipient_kind text, p_recipient_email text DEFAULT NULL::text, p_payload jsonb DEFAULT '{}'::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if p_event_type not in (
    'customer_order_received',
        'customer_payment_confirmed',
    'customer_custom_approved',
    'customer_order_ready',
    'customer_order_shipped',
    'admin_payment_confirmed'
    ,'admin_payment_review_required'
  ) then
    return;
  end if;

  insert into public.commerce_email_outbox (
    order_id, event_type, recipient_kind, recipient_email, payload
  ) values (
    p_order_id,
    p_event_type,
    p_recipient_kind,
    nullif(lower(btrim(p_recipient_email)), ''),
    coalesce(p_payload, '{}'::jsonb)
  )
  on conflict (order_id, event_type) do nothing;
end;
$function$;

CREATE OR REPLACE FUNCTION private.enqueue_order_status_emails()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_customer_email text := new.customer_snapshot ->> 'email';
  v_is_confirmed_payment boolean := new.status in (
    'paid_pending_review', 'ready_for_fulfillment', 'ready_for_production', 'manual_review'
  );
  v_was_confirmed_payment boolean;
  v_customer_event text := case when new.customer_snapshot ->> 'purchaseFlow' in (
    'uruguay_retail_transfer', 'argentina_retail_transfer', 'wholesale_bank_transfer'
  )
    then 'customer_payment_confirmed' else 'customer_order_received' end;
begin
  if new.channel not in ('Web', 'Mayorista web') then
    return new;
  end if;
  -- A pending transfer has a receipt ready for manual review. Argentina reaches
  -- this status when its receipt is uploaded; Uruguay creates the order and
  -- receipt in one transaction.
  if new.status = 'payment_verification_pending'
     and new.customer_snapshot ->> 'purchaseFlow' in (
       'uruguay_retail_transfer', 'wholesale_bank_transfer', 'argentina_retail_transfer'
     ) then
    if tg_op = 'INSERT' then
      perform private.enqueue_commerce_email(new.id, 'admin_payment_review_required', 'admin');
    elsif new.status is distinct from old.status then
      perform private.enqueue_commerce_email(new.id, 'admin_payment_review_required', 'admin');
    end if;
  end if;
  if new.customer_snapshot ->> 'purchaseFlow' = 'international_paypal'
     and new.paid_at is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if v_is_confirmed_payment then
      perform private.enqueue_commerce_email(
        new.id, v_customer_event, 'customer', v_customer_email
      );
      perform private.enqueue_commerce_email(
        new.id, 'admin_payment_confirmed', 'admin'
      );
    end if;
    return new;
  end if;

  if new.status is not distinct from old.status then
    return new;
  end if;

  v_was_confirmed_payment := old.status in (
    'paid_pending_review', 'ready_for_fulfillment', 'ready_for_production', 'manual_review'
  );

  if not v_was_confirmed_payment and v_is_confirmed_payment then
    perform private.enqueue_commerce_email(
      new.id, v_customer_event, 'customer', v_customer_email
    );
    perform private.enqueue_commerce_email(
      new.id, 'admin_payment_confirmed', 'admin'
    );
  end if;

  if new.status = 'ready_for_production' then
    perform private.enqueue_commerce_email(
      new.id, 'customer_custom_approved', 'customer', v_customer_email
    );
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.claim_commerce_email_jobs(p_order_id uuid DEFAULT NULL::uuid, p_limit integer DEFAULT 20)
 RETURNS SETOF commerce_email_outbox
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  return query
  with candidates as (
    select email.id
    from public.commerce_email_outbox email
    where email.attempt_count < 5
      and (
        (email.status in ('pending', 'failed') and email.available_at <= now())
        or (email.status = 'sending' and email.claimed_at < now() - interval '15 minutes')
      )
      and email.event_type in (
        'customer_order_received',
        'customer_payment_confirmed',
        'customer_custom_approved',
        'customer_order_ready',
        'customer_order_shipped',
        'admin_payment_confirmed'
        ,'admin_payment_review_required'
      )
      and (p_order_id is null or email.order_id = p_order_id)
    order by email.created_at, email.id
    limit least(greatest(p_limit, 1), 50)
    for update skip locked
  )
  update public.commerce_email_outbox email
  set status = 'sending',
      attempt_count = email.attempt_count + 1,
      claimed_at = now(),
      last_error = null,
      updated_at = now()
  from candidates
  where email.id = candidates.id
  returning email.*;
end;
$function$;

CREATE OR REPLACE FUNCTION public.review_wholesale_bank_transfer_order(p_admin_id uuid, p_order_id uuid, p_decision text, p_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_order public.orders%rowtype; v_receipt public.commerce_bank_transfer_receipts%rowtype;
  v_status text; v_reason text := nullif(left(btrim(coalesce(p_reason,'')),500),'');
begin
  if not exists(select 1 from public.commerce_admin_users where user_id=p_admin_id and active) then raise exception 'Sin permiso'; end if;
  if p_decision not in ('approve','reject') then raise exception 'Decisión inválida'; end if;
  select * into v_order from public.orders where id=p_order_id for update;
  if not found or v_order.status<>'payment_verification_pending' or
    v_order.customer_snapshot->>'purchaseFlow' not in ('wholesale_bank_transfer','uruguay_retail_transfer') then
    raise exception 'El pedido no está pendiente de verificación'; end if;
  select * into v_receipt from public.commerce_bank_transfer_receipts where order_id=p_order_id for update;
  if not found or v_receipt.status<>'pending' then raise exception 'El comprobante ya fue revisado'; end if;
  if p_decision='approve' then
    v_status := case when exists(select 1 from public.order_items where order_id=p_order_id and requires_review)
      then 'paid_pending_review' else 'ready_for_fulfillment' end;
    update public.commerce_bank_transfer_receipts set status='approved',reviewed_by=p_admin_id,reviewed_at=now() where id=v_receipt.id;
    insert into public.commerce_payments(order_id,provider,provider_payment_id,status,status_detail,amount_minor,currency,raw_payload,approved_at)
    values(p_order_id,'bank_transfer','bank-transfer:'||v_receipt.id::text,'approved','manually_verified',v_order.total_minor,'UYU',
      jsonb_build_object('receiptId',v_receipt.id,'reviewedBy',p_admin_id),now()) on conflict(provider_payment_id) do nothing;
    update public.orders set status=v_status,paid_at=now() where id=p_order_id;
    update public.order_items set production_status='in_production',completed_at=null where order_id=p_order_id and coalesce(production_status,'pending')='pending';
  else
    if v_reason is null or char_length(v_reason)<5 then raise exception 'Indicá el motivo del rechazo'; end if;
    v_status := 'cancelled';
    update public.commerce_bank_transfer_receipts set status='rejected',rejection_reason=v_reason,reviewed_by=p_admin_id,reviewed_at=now() where id=v_receipt.id;
    update public.orders set status='cancelled',cancelled_at=now() where id=p_order_id;
  end if;
  -- Keep sent review notices for audit. An unprocessed notice is obsolete
  -- after approval or rejection, for both wholesale and retail transfers.
  delete from public.commerce_email_outbox
  where order_id=p_order_id and event_type='admin_payment_review_required'
    and status in ('pending','failed');
  -- Keep the customer and team confirmations for every approved transfer.
  return jsonb_build_object('id',p_order_id,'status',v_status);
end $function$;

DROP TRIGGER commerce_email_outbox_dispatch ON public.commerce_email_outbox;
CREATE TRIGGER commerce_email_outbox_dispatch AFTER INSERT ON public.commerce_email_outbox FOR EACH ROW WHEN ((new.event_type = ANY (ARRAY['customer_order_received'::text, 'customer_payment_confirmed'::text, 'customer_custom_approved'::text, 'customer_order_ready'::text, 'customer_order_shipped'::text, 'admin_payment_confirmed'::text, 'admin_payment_review_required'::text]))) EXECUTE FUNCTION private.dispatch_commerce_email_on_enqueue();
