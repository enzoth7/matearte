-- Keep Argentina's existing server-side ARS pricing and add coupon redemption
-- in the same transaction as order creation. Fixed coupons are stored in UYU.
create function public.create_argentina_retail_order(
  p_user_id uuid, p_cart_id uuid, p_customer jsonb, p_design_prices jsonb,
  p_idempotency_key uuid, p_discount_code text
) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  v_result jsonb;
  v_order public.orders%rowtype;
  v_code text := nullif(upper(btrim(coalesce(p_discount_code, ''))), '');
  v_uyu_design bigint;
  v_uyu_categories jsonb;
  v_ars_design bigint;
  v_ars_categories jsonb;
  v_discount jsonb;
  v_ars_eligible bigint;
  v_discount_ars bigint;
  v_rate numeric;
begin
  v_result := public.create_argentina_retail_order(
    p_user_id, p_cart_id, p_customer, p_design_prices, p_idempotency_key
  );
  select * into v_order from public.orders where id = (v_result->>'id')::uuid for update;
  if not found then raise exception 'No se pudo crear el pedido'; end if;
  if (v_result->>'existing')::boolean then
    if v_code is not null and v_order.discount_code is distinct from v_code then
      raise exception 'discount:invalid_reservation';
    end if;
    return v_result;
  end if;
  if v_code is null then return v_result; end if;

  v_rate := (v_order.customer_snapshot->>'arsPerUyu')::numeric;
  if v_rate is null or v_rate <= 0 then raise exception 'Cotización ARS inválida'; end if;

  select coalesce(sum((p_design_prices->>item.design_id::text)::bigint * item.quantity), 0)
    into v_uyu_design
  from public.cart_items item
  where item.cart_id = p_cart_id and item.item_type = 'design';

  select coalesce(jsonb_object_agg(category, subtotal), '{}'::jsonb)
    into v_uyu_categories
  from (
    select lower(btrim(coalesce(nullif(product.category_code, ''), product.category, ''))) as category,
      sum((case when (v_order.customer_snapshot->>'arsUseBasePrice')::boolean
        then coalesce(variant.base_price_minor, variant.price_minor)
        else variant.price_minor end) * item.quantity)::bigint as subtotal
    from public.cart_items item
    join public.commerce_variants variant on variant.id = item.variant_id
    join public.commerce_products product on product.id = variant.product_id
    where item.cart_id = p_cart_id and item.item_type = 'catalog'
    group by 1
  ) category_totals;

  v_discount := public.reserve_commerce_discount_scoped(
    p_user_id, v_code, (v_order.customer_snapshot->>'sourceSubtotalUyuMinor')::bigint,
    v_uyu_design, p_idempotency_key, now() + interval '1 day', v_uyu_categories
  );

  select coalesce(sum(item.total_minor), 0)::bigint into v_ars_design
  from public.order_items item where item.order_id = v_order.id and item.item_type = 'design';
  select coalesce(jsonb_object_agg(category, subtotal), '{}'::jsonb)
    into v_ars_categories
  from (
    select lower(btrim(coalesce(nullif(item.immutable_snapshot->'product'->>'category_code', ''),
      item.immutable_snapshot->'product'->>'category', ''))) as category,
      sum(item.total_minor)::bigint as subtotal
    from public.order_items item where item.order_id = v_order.id and item.item_type = 'catalog'
    group by 1
  ) category_totals;

  case v_discount->>'applicability'
    when 'all_items' then v_ars_eligible := v_order.items_subtotal_minor;
    when 'design_items' then v_ars_eligible := v_ars_design;
    when 'categories' then
      select coalesce(sum(value::bigint), 0) into v_ars_eligible
      from jsonb_each_text(v_ars_categories)
      where key in (select jsonb_array_elements_text(v_discount->'categoryCodes'));
      if (v_discount->>'includeDesignItems')::boolean then
        v_ars_eligible := v_ars_eligible + v_ars_design;
      end if;
    else raise exception 'discount:invalid';
  end case;

  if v_discount->>'discountType' = 'percentage' then
    v_discount_ars := round(v_ars_eligible::numeric * (v_discount->>'discountValue')::numeric / 100 / 5000)::bigint * 5000;
  elsif v_discount->>'discountType' = 'fixed' then
    v_discount_ars := round((v_discount->>'discountValue')::numeric * 100 * v_rate / 5000)::bigint * 5000;
  else
    raise exception 'discount:invalid';
  end if;
  if v_discount_ars <= 0 or v_discount_ars >= v_order.items_subtotal_minor or v_discount_ars > v_ars_eligible then
    raise exception 'discount:not_applicable';
  end if;

  update public.orders set
    discount_id = (v_discount->>'discountId')::uuid,
    discount_code = v_discount->>'code',
    discount_type = v_discount->>'discountType',
    discount_value = (v_discount->>'discountValue')::numeric,
    discount_minor = v_discount_ars,
    total_minor = items_subtotal_minor - v_discount_ars,
    customer_snapshot = customer_snapshot || jsonb_build_object('sourceDiscountUyuMinor',
      (v_discount->>'discountMinor')::bigint)
  where id = v_order.id;

  -- A bank transfer order has a fixed payable amount from this point onward.
  -- Redeem now so a later receipt review cannot fail because the hold expired.
  update public.commerce_discount_usages
  set status = 'redeemed', order_id = v_order.id, redeemed_at = now()
  where checkout_key = p_idempotency_key and user_id = p_user_id and status = 'reserved';
  if not found then raise exception 'discount:invalid_reservation'; end if;
  return v_result;
end $$;

revoke all on function public.create_argentina_retail_order(uuid,uuid,jsonb,jsonb,uuid,text)
  from public, anon, authenticated;
grant execute on function public.create_argentina_retail_order(uuid,uuid,jsonb,jsonb,uuid,text)
  to service_role;
