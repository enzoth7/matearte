-- Las entregas de cuenta corriente respetan la moneda del pedido mayorista.
create or replace function public.gestion_allocate_customer_account_receipt(
  p_allocation_id uuid, p_receipt_id uuid, p_order_id uuid, p_source_amount_minor bigint
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_receipt public.customer_account_receipts%rowtype;
  v_order public.orders%rowtype;
  v_existing public.customer_account_allocations%rowtype;
  v_available_source bigint; v_available_uyu bigint; v_amount_uyu bigint;
  v_total bigint; v_initial bigint; v_direct bigint; v_allocated bigint;
begin
  perform private.require_internal_staff();
  if p_allocation_id is null or p_receipt_id is null or p_order_id is null
    or p_source_amount_minor is null or p_source_amount_minor <= 0 then
    raise exception 'La asignación debe tener un importe positivo' using errcode = '22023'; end if;
  select * into v_receipt from public.customer_account_receipts where id = p_receipt_id for update;
  select * into v_order from public.orders where id = p_order_id for update;
  if v_receipt.id is null or v_order.id is null or v_receipt.contact_id is distinct from v_order.contact_id
    or v_order.status in ('cancelled', 'refunded')
    or (v_order.channel = 'Mayorista' and v_receipt.currency <> coalesce(v_order.wholesale_currency, 'ARS'))
    or (v_order.channel <> 'Mayorista' and v_receipt.currency <> 'UYU') then
    raise exception 'La entrega y el pedido deben pertenecer a la misma cuenta y moneda' using errcode = '22023'; end if;
  select * into v_existing from public.customer_account_allocations where id = p_allocation_id;
  if found then
    if v_existing.receipt_id = p_receipt_id and v_existing.order_id = p_order_id
      and v_existing.source_amount_minor = p_source_amount_minor then
      return jsonb_build_object('id', v_existing.id, 'amount_minor', v_existing.amount_minor); end if;
    raise exception 'El identificador de la asignación ya se usó' using errcode = '23505';
  end if;
  select v_receipt.source_amount_minor - coalesce(sum(source_amount_minor), 0),
    v_receipt.amount_minor - coalesce(sum(amount_minor), 0)
    into v_available_source, v_available_uyu
    from public.customer_account_allocations where receipt_id = p_receipt_id;
  if p_source_amount_minor > v_available_source then
    raise exception 'La entrega no tiene ese saldo a favor' using errcode = '22023'; end if;
  v_amount_uyu := case when p_source_amount_minor = v_available_source then v_available_uyu
    when v_receipt.currency = 'ARS' then round(p_source_amount_minor * v_receipt.uyu_per_ars)::bigint
    else p_source_amount_minor end;
  if v_amount_uyu <= 0 or v_amount_uyu > v_available_uyu then
    raise exception 'El equivalente UYU de la entrega no es válido' using errcode = '22023'; end if;
  if v_order.channel = 'Mayorista' then
    if v_receipt.currency = 'ARS' then
      v_total := private.wholesale_arg_total_minor(p_order_id);
      select collected_arg_minor into v_initial from public.wholesale_order_payment_openings where sale_id = p_order_id;
    else
      select coalesce(sum(total_minor), 0) into v_total from public.order_items where order_id = p_order_id;
      select collected_minor into v_initial from public.wholesale_order_payment_openings where sale_id = p_order_id;
    end if;
    if not found then v_initial := 0; end if;
    if v_total is null or v_initial is null then
      raise exception 'Primero conciliá el precio y los cobros anteriores del pedido' using errcode = '22023'; end if;
    select coalesce(sum(source_amount_minor), 0) into v_direct from public.wholesale_order_receipts where sale_id = p_order_id;
    select coalesce(sum(case when v_receipt.currency = 'ARS' then source_amount_minor else amount_minor end), 0)
      into v_allocated from public.customer_account_allocations where order_id = p_order_id;
  else
    if v_order.status <> 'internal_completed' then raise exception 'La venta no admite cobros' using errcode = '22023'; end if;
    select coalesce(sum(total_minor), 0) into v_total from public.order_items where order_id = p_order_id;
    v_initial := v_order.total_minor;
    select coalesce(sum(amount_minor), 0) into v_direct from public.local_sale_receipts where sale_id = p_order_id;
    select coalesce(sum(amount_minor), 0) into v_allocated from public.customer_account_allocations where order_id = p_order_id;
    v_total := floor((v_total + v_order.retail_shipping_minor - v_initial - v_direct) * coalesce(v_order.retail_rate_to_uyu, 1));
    v_initial := 0; v_direct := 0;
  end if;
  if p_source_amount_minor > v_total - v_initial - v_direct - v_allocated then
    raise exception 'La asignación supera el saldo del pedido' using errcode = '22023'; end if;
  insert into public.customer_account_allocations
    (id, receipt_id, order_id, amount_minor, source_amount_minor, created_by)
  values (p_allocation_id, p_receipt_id, p_order_id, v_amount_uyu, p_source_amount_minor, auth.uid());
  return jsonb_build_object('id', p_allocation_id, 'amount_minor', v_amount_uyu);
end;
$$;
