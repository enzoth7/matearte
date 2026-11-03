alter table public.commerce_settings add column ars_use_base_price boolean not null default true;

create or replace function public.create_argentina_retail_order(p_user_id uuid, p_cart_id uuid, p_customer jsonb,
  p_design_prices jsonb, p_idempotency_key uuid) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  v_settings public.commerce_argentina_settings%rowtype;
  v_finance_rate numeric;
  v_use_base boolean;
  v_ars_per_uyu numeric;
  v_order public.orders%rowtype;
  v_item record;
  v_unit bigint; v_total bigint := 0; v_uyu bigint := 0;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text || ':' || p_idempotency_key::text,0));
  select * into v_order from public.orders where user_id=p_user_id and checkout_idempotency_key=p_idempotency_key;
  if found then
    if v_order.customer_snapshot->>'purchaseFlow' <> 'argentina_retail_transfer' then raise exception 'Identificador de pedido invÃ¡lido'; end if;
    return jsonb_build_object('id',v_order.id,'existing',true);
  end if;
  if not exists(select 1 from public.commerce_settings where singleton and commerce_enabled) then raise exception 'La tienda estÃ¡ deshabilitada'; end if;
  select * into v_settings from public.commerce_argentina_settings where singleton and enabled for share;
  if not found then raise exception 'Las compras para Argentina todavÃ­a no estÃ¡n habilitadas'; end if;
  select ars_use_base_price into v_use_base from public.commerce_settings where singleton for share;
  -- Same source and units as Finanzas â†’ Monedas: 1 ARS = X UYU.
  select exchange_rate into v_finance_rate from public.settings where id=1 for share;
  if v_finance_rate is null or v_finance_rate <= 0 or v_finance_rate::text in ('NaN','Infinity','-Infinity') then
    raise exception 'ConfigurÃ¡ la cotizaciÃ³n ARS en Finanzas â†’ Monedas';
  end if;
  v_ars_per_uyu := round(1 / v_finance_rate, 6);
  if v_ars_per_uyu <= 0 then raise exception 'La cotizaciÃ³n ARS no es vÃ¡lida'; end if;
  if p_customer->>'countryCode' is distinct from 'AR' or
    exists(select 1 from unnest(array['fullName','phone','department','city','postalCode','address']) as k where coalesce(btrim(p_customer->>k),'')='') then
    raise exception 'CompletÃ¡ los datos de entrega en Argentina';
  end if;
  perform 1 from public.carts where id=p_cart_id and user_id=p_user_id and status='active' for update;
  if not found or not exists(select 1 from public.cart_items where cart_id=p_cart_id) then raise exception 'El carrito no estÃ¡ disponible'; end if;
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
    p_customer || jsonb_build_object('purchaseFlow','argentina_retail_transfer','arsPerUyu',v_ars_per_uyu,'arsUseBasePrice',v_use_base,'arsRounding',50,'bank',jsonb_build_object('bank_name',v_settings.bank_name,'account_holder',v_settings.account_holder,'cbu',v_settings.cbu,'alias',v_settings.alias)),
    p_idempotency_key,null) returning * into v_order;
  for v_item in select * from public.cart_items where cart_id=p_cart_id order by id for update loop
    if v_item.item_type='catalog' then
      select round((case when v_use_base then coalesce(v.base_price_minor,v.price_minor) else v.price_minor end)::numeric / 5000 * v_ars_per_uyu)::bigint * 5000 into v_unit
      from public.commerce_variants v join public.commerce_products p on p.id=v.product_id
      where v.id=v_item.variant_id and v.active and v.available_web and p.published for share of v,p;
      if not found then raise exception 'Un producto ya no estÃ¡ disponible'; end if;
      insert into public.order_items(order_id,item_type,source_variant_id,sku,title,quantity,unit_price_minor,total_minor,immutable_snapshot,requires_review)
      select v_order.id,'catalog',v.id,v.sku,p.name || ' â€” ' || v.name,v_item.quantity,v_unit,v_unit*v_item.quantity,
        jsonb_build_object('product',to_jsonb(p),'variant',to_jsonb(v),'selectedOptions',coalesce(v_item.option_values_override,v.option_values,'{}'::jsonb)),false
      from public.commerce_variants v join public.commerce_products p on p.id=v.product_id where v.id=v_item.variant_id;
      select v_uyu + (case when v_use_base then coalesce(base_price_minor,price_minor) else price_minor end)*v_item.quantity into v_uyu from public.commerce_variants where id=v_item.variant_id;
    else
      if not exists(select 1 from public.designs where id=v_item.design_id and user_id=p_user_id) or coalesce((p_design_prices->>v_item.design_id::text)::bigint,0)<=0 then raise exception 'DiseÃ±o invÃ¡lido'; end if;
      v_unit := round((p_design_prices->>v_item.design_id::text)::numeric / 5000 * v_ars_per_uyu)::bigint * 5000;
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

