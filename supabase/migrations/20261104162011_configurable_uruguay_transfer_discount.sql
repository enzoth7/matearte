-- Keep the existing 10% transfer benefit on every current category and design.
-- New categories are opt-in once created.
alter table public.commerce_settings
  add column uruguay_transfer_discount_enabled boolean not null default true,
  add column uruguay_transfer_discount_categories text[] not null default '{}',
  add column uruguay_transfer_discount_designs boolean not null default true;

update public.commerce_settings
set uruguay_transfer_discount_categories = array(
  select code from public.commerce_categories where active order by code
)
where singleton;

-- Calculate and save each line with the selected category rule.
create or replace function public.create_uruguay_retail_bank_transfer_order(
  p_user_id uuid, p_cart_id uuid, p_shipping_rate_id uuid, p_design_prices jsonb,
  p_customer_snapshot jsonb, p_idempotency_key uuid, p_receipt_id uuid,
  p_receipt_storage_path text, p_receipt_original_name text,
  p_receipt_mime_type text, p_receipt_byte_size bigint, p_discount_code text
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_order public.orders%rowtype;
  v_shipping public.shipping_rates%rowtype;
  v_bank public.commerce_bank_transfer_settings%rowtype;
  v_settings public.commerce_settings%rowtype;
  v_subtotal bigint;
  v_design_subtotal bigint;
  v_categories jsonb;
  v_discount jsonb;
  v_discount_minor bigint := 0;
  v_code text := nullif(upper(btrim(coalesce(p_discount_code, ''))), '');
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text || ':' || p_idempotency_key::text, 0));
  select * into v_order from public.orders where user_id = p_user_id and checkout_idempotency_key = p_idempotency_key;
  if found then
    if v_order.customer_snapshot->>'purchaseFlow' is distinct from 'uruguay_retail_transfer'
       or (v_code is not null and v_order.discount_code is distinct from v_code) then
      raise exception 'Identificador de pedido inválido';
    end if;
    return jsonb_build_object('id', v_order.id, 'existing', true);
  end if;
  select * into v_settings from public.commerce_settings where singleton and commerce_enabled for share;
  if not found then raise exception 'La tienda no está habilitada'; end if;
  select * into v_bank from public.commerce_bank_transfer_settings where singleton for share;
  if not found then raise exception 'La transferencia bancaria no está configurada'; end if;
  if p_receipt_mime_type not in ('image/jpeg','image/png','image/webp','application/pdf')
     or p_receipt_byte_size not between 1 and 5242880
     or split_part(p_receipt_storage_path,'/',1) <> p_user_id::text then
    raise exception 'El comprobante no es válido';
  end if;
  select * into v_shipping from public.shipping_rates where id = p_shipping_rate_id and active for share;
  if not found then raise exception 'La modalidad de entrega no está disponible'; end if;
  perform 1 from public.carts where id = p_cart_id and user_id = p_user_id and status = 'active' for update;
  if not found or not exists(select 1 from public.cart_items where cart_id = p_cart_id) then
    raise exception 'El carrito no está disponible';
  end if;
  if exists (
    select 1 from public.commerce_settings s where s.singleton and s.wholesale_mate_discount_enabled
      and s.wholesale_mate_discount_percent > 0 and (
        select coalesce(sum(i.quantity),0) from public.cart_items i
        join public.commerce_variants v on v.id=i.variant_id
        join public.commerce_products p on p.id=v.product_id
        where i.cart_id=p_cart_id and lower(trim(coalesce(nullif(p.category_code,''),p.category)))='mates'
      ) >= s.wholesale_mate_quantity_threshold
  ) then raise exception 'Este carrito se completa como compra mayorista'; end if;
  if exists (
    select 1 from public.cart_items i join public.commerce_variants v on v.id=i.variant_id
    join public.commerce_products p on p.id=v.product_id
    where i.cart_id=p_cart_id and i.item_type='catalog' and (not v.active or not v.available_web or not p.published)
  ) then raise exception 'Un producto ya no está disponible'; end if;
  if exists (
    select 1 from public.cart_items i left join public.designs d on d.id=i.design_id and d.user_id=p_user_id
    where i.cart_id=p_cart_id and i.item_type='design'
      and (d.id is null or coalesce((p_design_prices->>i.design_id::text)::bigint,0)<=0)
  ) then raise exception 'No se pudo verificar un diseño'; end if;

  select coalesce(sum(round((case when i.item_type='catalog' then v.price_minor
    else (p_design_prices->>i.design_id::text)::bigint end)::numeric *
    case when v_settings.uruguay_transfer_discount_enabled and (
      i.item_type='design' and v_settings.uruguay_transfer_discount_designs or
      i.item_type='catalog' and lower(btrim(coalesce(nullif(p.category_code,''),p.category,''))) = any(v_settings.uruguay_transfer_discount_categories)
    ) then 0.9 else 1 end)::bigint * i.quantity),0)::bigint,
    coalesce(sum(case when i.item_type='design' then
      round((p_design_prices->>i.design_id::text)::numeric *
        case when v_settings.uruguay_transfer_discount_enabled and v_settings.uruguay_transfer_discount_designs then 0.9 else 1 end)::bigint * i.quantity else 0 end),0)::bigint
  into v_subtotal,v_design_subtotal
  from public.cart_items i left join public.commerce_variants v on v.id=i.variant_id
  left join public.commerce_products p on p.id=v.product_id where i.cart_id=p_cart_id;
  if v_subtotal <= 0 then raise exception 'No se pudo calcular el total'; end if;
  select coalesce(jsonb_object_agg(category,subtotal),'{}'::jsonb) into v_categories from (
    select lower(btrim(coalesce(nullif(p.category_code,''),p.category,''))) category,
      sum(round(v.price_minor::numeric *
        case when v_settings.uruguay_transfer_discount_enabled and lower(btrim(coalesce(nullif(p.category_code,''),p.category,''))) = any(v_settings.uruguay_transfer_discount_categories) then 0.9 else 1 end)::bigint * i.quantity)::bigint subtotal
    from public.cart_items i join public.commerce_variants v on v.id=i.variant_id
    join public.commerce_products p on p.id=v.product_id
    where i.cart_id=p_cart_id and i.item_type='catalog' group by 1
  ) categories;
  if v_code is not null then
    v_discount := public.reserve_commerce_discount_scoped(p_user_id,v_code,v_subtotal,v_design_subtotal,
      p_idempotency_key,now()+interval '1 day',v_categories);
    v_discount_minor := (v_discount->>'discountMinor')::bigint;
    if v_discount_minor <= 0 or v_discount_minor >= v_subtotal then raise exception 'discount:not_applicable'; end if;
  end if;
  insert into public.orders(user_id,cart_id,status,currency,items_subtotal_minor,shipping_minor,payment_fee_minor,
    discount_id,discount_code,discount_type,discount_value,discount_minor,total_minor,shipping_method,
    shipping_snapshot,customer_snapshot,checkout_idempotency_key,reservation_expires_at)
  values(p_user_id,p_cart_id,'payment_verification_pending','UYU',v_subtotal,0,0,
    case when v_code is null then null else (v_discount->>'discountId')::uuid end,
    v_code,case when v_code is null then null else v_discount->>'discountType' end,
    case when v_code is null then null else (v_discount->>'discountValue')::numeric end,
    v_discount_minor,v_subtotal-v_discount_minor,
    case when v_shipping.is_pickup then 'pickup' else 'national_shipping' end,
    to_jsonb(v_shipping)||jsonb_build_object('channel','bank_transfer','payOnDelivery',not v_shipping.is_pickup),
    p_customer_snapshot||jsonb_build_object('purchaseFlow','uruguay_retail_transfer',
      'priceSource','published_discount_10','transferDiscountPercent',case when v_settings.uruguay_transfer_discount_enabled then 10 else 0 end,
      'bank',jsonb_build_object('account_holder',v_bank.account_holder,'transfer_account',v_bank.transfer_account,
      'cash_deposit_account',v_bank.cash_deposit_account,'cash_deposit_label',v_bank.cash_deposit_label)),
    p_idempotency_key,null) returning * into v_order;
  insert into public.order_items(order_id,item_type,source_variant_id,sku,title,quantity,unit_price_minor,total_minor,immutable_snapshot,requires_review)
  select v_order.id,'catalog',v.id,v.sku,p.name||' — '||v.name,i.quantity,
    round(v.price_minor::numeric * case when v_settings.uruguay_transfer_discount_enabled and lower(btrim(coalesce(nullif(p.category_code,''),p.category,''))) = any(v_settings.uruguay_transfer_discount_categories) then 0.9 else 1 end)::bigint,
    round(v.price_minor::numeric * case when v_settings.uruguay_transfer_discount_enabled and lower(btrim(coalesce(nullif(p.category_code,''),p.category,''))) = any(v_settings.uruguay_transfer_discount_categories) then 0.9 else 1 end)::bigint * i.quantity,
    jsonb_build_object('product',to_jsonb(p),'variant',to_jsonb(v),
      'selectedOptions',coalesce(i.option_values_override,v.option_values,'{}'::jsonb),
      'transferOriginalUnitPriceMinor',v.price_minor,
      'transferDiscountApplied',v_settings.uruguay_transfer_discount_enabled and lower(btrim(coalesce(nullif(p.category_code,''),p.category,''))) = any(v_settings.uruguay_transfer_discount_categories)),false
  from public.cart_items i join public.commerce_variants v on v.id=i.variant_id
  join public.commerce_products p on p.id=v.product_id where i.cart_id=p_cart_id and i.item_type='catalog';
  insert into public.order_items(order_id,item_type,source_design_id,title,quantity,unit_price_minor,total_minor,immutable_snapshot,requires_review,review_status)
  select v_order.id,'design',d.id,d.title,i.quantity,
    round((p_design_prices->>d.id::text)::numeric * case when v_settings.uruguay_transfer_discount_enabled and v_settings.uruguay_transfer_discount_designs then 0.9 else 1 end)::bigint,
    round((p_design_prices->>d.id::text)::numeric * case when v_settings.uruguay_transfer_discount_enabled and v_settings.uruguay_transfer_discount_designs then 0.9 else 1 end)::bigint * i.quantity,
    jsonb_build_object('schemaVersion',d.schema_version,'configuration',d.configuration,
      'flejeConfiguration',d.fleje_configuration,'previewPath',d.preview_path,
      'assets',coalesce((select jsonb_agg(to_jsonb(a)) from public.design_assets a where a.design_id=d.id),'[]'::jsonb),
      'transferOriginalUnitPriceMinor',(p_design_prices->>d.id::text)::bigint,
      'transferDiscountApplied',v_settings.uruguay_transfer_discount_enabled and v_settings.uruguay_transfer_discount_designs),true,'pending'
  from public.cart_items i join public.designs d on d.id=i.design_id
  where i.cart_id=p_cart_id and i.item_type='design' and d.user_id=p_user_id;
  insert into public.commerce_bank_transfer_receipts(id,order_id,user_id,storage_path,original_name,mime_type,byte_size)
  values(p_receipt_id,v_order.id,p_user_id,p_receipt_storage_path,left(p_receipt_original_name,240),p_receipt_mime_type,p_receipt_byte_size);
  if v_code is not null then
    update public.commerce_discount_usages set status='redeemed',order_id=v_order.id,redeemed_at=now()
    where checkout_key=p_idempotency_key and user_id=p_user_id and status='reserved';
    if not found then raise exception 'discount:invalid_reservation'; end if;
  end if;
  update public.carts set status='converted' where id=p_cart_id;
  return jsonb_build_object('id',v_order.id,'existing',false);
end $$;
revoke all on function public.create_uruguay_retail_bank_transfer_order(uuid,uuid,uuid,jsonb,jsonb,uuid,uuid,text,text,text,bigint,text) from public,anon,authenticated;
grant execute on function public.create_uruguay_retail_bank_transfer_order(uuid,uuid,uuid,jsonb,jsonb,uuid,uuid,text,text,text,bigint,text) to service_role;
