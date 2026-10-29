-- Argentina retail: frozen ARS quotes, private receipts and manual approval.
create table public.commerce_argentina_settings (
  singleton boolean primary key default true check (singleton),
  enabled boolean not null default false,
  bank_name text not null default '', account_holder text not null default '',
  cbu text not null default '', alias text not null default '',
  updated_at timestamptz not null default now(),
  check (not enabled or (length(btrim(bank_name)) > 1
    and length(btrim(account_holder)) > 1 and cbu ~ '^[0-9]{22}$' and length(btrim(alias)) > 0))
);
insert into public.commerce_argentina_settings(singleton) values(true);
alter table public.commerce_argentina_settings enable row level security;
revoke all on public.commerce_argentina_settings from public, anon, authenticated;
grant select on public.commerce_argentina_settings to anon, authenticated;
grant update on public.commerce_argentina_settings to authenticated;
grant all on public.commerce_argentina_settings to service_role;
create policy argentina_settings_public_read on public.commerce_argentina_settings for select to anon, authenticated using (enabled);
create policy argentina_settings_admin_read on public.commerce_argentina_settings for select to authenticated using ((select private.is_commerce_admin()));
create policy argentina_settings_update on public.commerce_argentina_settings for update to authenticated
  using ((select private.is_commerce_admin())) with check ((select private.is_commerce_admin()));
create trigger argentina_settings_updated before update on public.commerce_argentina_settings
  for each row execute function private.set_updated_at();
alter table public.orders drop constraint if exists orders_currency_check;
alter table public.orders add constraint orders_currency_check check(currency in ('UYU','USD','BRL','ARS'));
alter table public.commerce_payments drop constraint if exists commerce_payments_currency_check;
alter table public.commerce_payments add constraint commerce_payments_currency_check check(currency in ('UYU','USD','BRL','ARS'));

create function public.create_argentina_retail_order(p_user_id uuid, p_cart_id uuid, p_customer jsonb,
  p_design_prices jsonb, p_idempotency_key uuid) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  v_settings public.commerce_argentina_settings%rowtype;
  v_finance_rate numeric;
  v_ars_per_uyu numeric;
  v_order public.orders%rowtype;
  v_item record;
  v_unit bigint; v_total bigint := 0; v_uyu bigint := 0;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text || ':' || p_idempotency_key::text,0));
  select * into v_order from public.orders where user_id=p_user_id and checkout_idempotency_key=p_idempotency_key;
  if found then
    if v_order.customer_snapshot->>'purchaseFlow' <> 'argentina_retail_transfer' then raise exception 'Identificador de pedido inválido'; end if;
    return jsonb_build_object('id',v_order.id,'existing',true);
  end if;
  if not exists(select 1 from public.commerce_settings where singleton and commerce_enabled) then raise exception 'La tienda está deshabilitada'; end if;
  select * into v_settings from public.commerce_argentina_settings where singleton and enabled for share;
  if not found then raise exception 'Las compras para Argentina todavía no están habilitadas'; end if;
  -- Same source and units as Finanzas → Monedas: 1 ARS = X UYU.
  select exchange_rate into v_finance_rate from public.settings where id=1 for share;
  if v_finance_rate is null or v_finance_rate <= 0 or v_finance_rate::text in ('NaN','Infinity','-Infinity') then
    raise exception 'Configurá la cotización ARS en Finanzas → Monedas';
  end if;
  v_ars_per_uyu := round(1 / v_finance_rate, 6);
  if v_ars_per_uyu <= 0 then raise exception 'La cotización ARS no es válida'; end if;
  if p_customer->>'countryCode' is distinct from 'AR' or
    exists(select 1 from unnest(array['fullName','phone','department','city','postalCode','address']) as k where coalesce(btrim(p_customer->>k),'')='') then
    raise exception 'Completá los datos de entrega en Argentina';
  end if;
  perform 1 from public.carts where id=p_cart_id and user_id=p_user_id and status='active' for update;
  if not found or not exists(select 1 from public.cart_items where cart_id=p_cart_id) then raise exception 'El carrito no está disponible'; end if;
  if exists (
    select 1 from public.commerce_settings s where s.singleton and s.wholesale_mate_discount_enabled
      and s.wholesale_mate_discount_percent > 0 and (
        select coalesce(sum(i.quantity),0) from public.cart_items i
        join public.commerce_variants v on v.id=i.variant_id join public.commerce_products p on p.id=v.product_id
        where i.cart_id=p_cart_id and lower(trim(coalesce(nullif(p.category_code,''),p.category)))='mates'
      ) >= s.wholesale_mate_quantity_threshold
  ) then raise exception 'Este medio de pago es para compras por unidad'; end if;
  insert into public.orders(user_id,cart_id,status,currency,items_subtotal_minor,total_minor,shipping_method,shipping_snapshot,customer_snapshot,checkout_idempotency_key,reservation_expires_at)
  values(p_user_id,p_cart_id,'pending_payment','ARS',0,0,'national_shipping',
    p_customer || jsonb_build_object('country','Argentina','countryCode','AR','payOnDelivery',true,'channel','bank_transfer','shippingScope','argentina_domestic'),
    p_customer || jsonb_build_object('purchaseFlow','argentina_retail_transfer','arsPerUyu',v_ars_per_uyu,'bank',jsonb_build_object('bank_name',v_settings.bank_name,'account_holder',v_settings.account_holder,'cbu',v_settings.cbu,'alias',v_settings.alias)),
    p_idempotency_key,null) returning * into v_order;
  for v_item in select * from public.cart_items where cart_id=p_cart_id order by id for update loop
    if v_item.item_type='catalog' then
      select round(v.price_minor::numeric / 100 * v_ars_per_uyu)::bigint * 100 into v_unit
      from public.commerce_variants v join public.commerce_products p on p.id=v.product_id
      where v.id=v_item.variant_id and v.active and v.available_web and p.published for share of v,p;
      if not found then raise exception 'Un producto ya no está disponible'; end if;
      insert into public.order_items(order_id,item_type,source_variant_id,sku,title,quantity,unit_price_minor,total_minor,immutable_snapshot,requires_review)
      select v_order.id,'catalog',v.id,v.sku,p.name || ' — ' || v.name,v_item.quantity,v_unit,v_unit*v_item.quantity,
        jsonb_build_object('product',to_jsonb(p),'variant',to_jsonb(v),'selectedOptions',coalesce(v_item.option_values_override,v.option_values,'{}'::jsonb)),false
      from public.commerce_variants v join public.commerce_products p on p.id=v.product_id where v.id=v_item.variant_id;
      select v_uyu + price_minor*v_item.quantity into v_uyu from public.commerce_variants where id=v_item.variant_id;
    else
      if not exists(select 1 from public.designs where id=v_item.design_id and user_id=p_user_id) or coalesce((p_design_prices->>v_item.design_id::text)::bigint,0)<=0 then raise exception 'Diseño inválido'; end if;
      v_unit := round((p_design_prices->>v_item.design_id::text)::numeric / 100 * v_ars_per_uyu)::bigint * 100;
      insert into public.order_items(order_id,item_type,source_design_id,title,quantity,unit_price_minor,total_minor,immutable_snapshot,requires_review,review_status)
      select v_order.id,'design',d.id,d.title,v_item.quantity,v_unit,v_unit*v_item.quantity,
        jsonb_build_object('schemaVersion',d.schema_version,'configuration',d.configuration,'flejeConfiguration',d.fleje_configuration,'previewPath',d.preview_path,
          'assets',coalesce((select jsonb_agg(to_jsonb(a)) from public.design_assets a where a.design_id=d.id),'[]'::jsonb)),true,'pending'
      from public.designs d where d.id=v_item.design_id;
      v_uyu := v_uyu + (p_design_prices->>v_item.design_id::text)::bigint*v_item.quantity;
    end if;
    v_total := v_total + v_unit*v_item.quantity;
  end loop;
  update public.orders set items_subtotal_minor=v_total,total_minor=v_total,
    customer_snapshot=customer_snapshot || jsonb_build_object('sourceSubtotalUyuMinor',v_uyu) where id=v_order.id;
  update public.carts set status='converted' where id=p_cart_id;
  return jsonb_build_object('id',v_order.id,'existing',false);
end $$;
revoke all on function public.create_argentina_retail_order(uuid,uuid,jsonb,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.create_argentina_retail_order(uuid,uuid,jsonb,jsonb,uuid) to service_role;

create function public.submit_argentina_receipt(p_user_id uuid,p_order_id uuid,p_receipt_id uuid,p_path text,p_name text,p_mime text,p_bytes bigint)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_order public.orders%rowtype; v_receipt public.commerce_bank_transfer_receipts%rowtype;
begin
  select * into v_order from public.orders where id=p_order_id and user_id=p_user_id for update;
  if not found or v_order.customer_snapshot->>'purchaseFlow' is distinct from 'argentina_retail_transfer' then raise exception 'Pedido no disponible'; end if;
  select * into v_receipt from public.commerce_bank_transfer_receipts where order_id=p_order_id for update;
  if found and v_receipt.id=p_receipt_id then return jsonb_build_object('ok',true,'existing',true); end if;
  if v_order.status not in ('pending_payment','payment_failed') or (v_receipt.id is not null and v_receipt.status <> 'rejected') then raise exception 'El pedido no admite otro comprobante'; end if;
  if split_part(p_path,'/',1)<>p_user_id::text or split_part(p_path,'/',2)<>p_order_id::text then raise exception 'Ruta inválida'; end if;
  insert into public.commerce_bank_transfer_receipts(id,order_id,user_id,storage_path,original_name,mime_type,byte_size)
  values(p_receipt_id,p_order_id,p_user_id,p_path,p_name,p_mime,p_bytes)
  on conflict(order_id) do update set id=excluded.id,storage_path=excluded.storage_path,original_name=excluded.original_name,
    mime_type=excluded.mime_type,byte_size=excluded.byte_size,status='pending',rejection_reason=null,reviewed_by=null,reviewed_at=null,submitted_at=now();
  update public.orders set status='payment_verification_pending' where id=p_order_id;
  return jsonb_build_object('ok',true,'existing',false,'previousPath',v_receipt.storage_path);
end $$;
revoke all on function public.submit_argentina_receipt(uuid,uuid,uuid,text,text,text,bigint) from public,anon,authenticated;
grant execute on function public.submit_argentina_receipt(uuid,uuid,uuid,text,text,text,bigint) to service_role;

create function public.review_argentina_transfer(p_admin_id uuid,p_order_id uuid,p_decision text,p_reason text default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_order public.orders%rowtype; v_receipt public.commerce_bank_transfer_receipts%rowtype; v_status text;
begin
  if not exists(select 1 from public.commerce_admin_users where user_id=p_admin_id and active) then raise exception 'Sin permiso'; end if;
  if p_decision not in ('approve','reject') then raise exception 'Decisión inválida'; end if;
  select * into v_order from public.orders where id=p_order_id for update;
  if not found or v_order.status<>'payment_verification_pending' or v_order.customer_snapshot->>'purchaseFlow' is distinct from 'argentina_retail_transfer' then raise exception 'El pedido no está pendiente de revisión'; end if;
  select * into v_receipt from public.commerce_bank_transfer_receipts where order_id=p_order_id and status='pending' for update;
  if not found then raise exception 'El comprobante ya fue revisado'; end if;
  if p_decision='approve' then
    v_status := case when exists(select 1 from public.order_items where order_id=p_order_id and requires_review) then 'paid_pending_review' else 'ready_for_fulfillment' end;
    update public.commerce_bank_transfer_receipts set status='approved',reviewed_by=p_admin_id,reviewed_at=now() where id=v_receipt.id;
    insert into public.commerce_payments(order_id,provider,provider_payment_id,status,status_detail,amount_minor,currency,raw_payload,approved_at)
    values(p_order_id,'bank_transfer','bank-transfer:' || v_receipt.id::text,'approved','manually_verified',v_order.total_minor,'ARS',jsonb_build_object('receiptId',v_receipt.id,'reviewedBy',p_admin_id),now());
    update public.orders set status=v_status,paid_at=now() where id=p_order_id;
  else
    if length(btrim(coalesce(p_reason,''))) < 5 then raise exception 'Indicá el motivo del rechazo'; end if;
    v_status := 'payment_failed';
    update public.commerce_bank_transfer_receipts set status='rejected',rejection_reason=left(btrim(p_reason),500),reviewed_by=p_admin_id,reviewed_at=now() where id=v_receipt.id;
    update public.orders set status=v_status where id=p_order_id;
  end if;
  return jsonb_build_object('id',p_order_id,'status',v_status);
end $$;
revoke all on function public.review_argentina_transfer(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.review_argentina_transfer(uuid,uuid,text,text) to service_role;
