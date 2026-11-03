create or replace function public.update_local_catalog_item(
  p_product_id uuid,
  p_variant_id uuid,
  p_name text,
  p_category_code text,
  p_sku text,
  p_variant_name text,
  p_base_price_minor bigint,
  p_active boolean
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
  v_category_code text := lower(btrim(coalesce(p_category_code, '')));
  v_sku text := upper(btrim(coalesce(p_sku, '')));
  v_variant_name text := btrim(coalesce(p_variant_name, ''));
begin
  if not private.is_commerce_admin() then
    raise exception 'Only commerce administrators can update catalog items' using errcode = '42501';
  end if;

  if v_name = '' or char_length(v_name) > 160 then
    raise exception 'Invalid product name' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.commerce_categories
    where code = v_category_code
      and active = true
  ) then
    raise exception 'Invalid or inactive category' using errcode = '22023';
  end if;

  update public.commerce_products
  set name = v_name,
      category = v_category_code,
      category_code = v_category_code
  where id = p_product_id;

  if not found then
    raise exception 'Product not found' using errcode = 'P0002';
  end if;

  if p_variant_id is not null then
    if v_sku = '' or char_length(v_sku) > 80
      or v_variant_name = '' or char_length(v_variant_name) > 120
      or p_base_price_minor is null or p_base_price_minor < 0 or p_base_price_minor > 1000000000
      or p_active is null then
      raise exception 'Invalid variant data' using errcode = '22023';
    end if;

    update public.commerce_variants
    set sku = v_sku,
        name = v_variant_name,
        price_minor = p_base_price_minor,
        base_price_minor = p_base_price_minor,
        active = p_active
    where id = p_variant_id
      and product_id = p_product_id;

    if not found then
      raise exception 'Variant not found for product' using errcode = 'P0002';
    end if;
  end if;

  return jsonb_build_object('product_id', p_product_id, 'variant_id', p_variant_id);
end;
$$;

revoke all on function public.update_local_catalog_item(uuid, uuid, text, text, text, text, bigint, boolean) from public;
revoke all on function public.update_local_catalog_item(uuid, uuid, text, text, text, text, bigint, boolean) from anon;
grant execute on function public.update_local_catalog_item(uuid, uuid, text, text, text, text, bigint, boolean) to authenticated;

comment on function public.update_local_catalog_item(uuid, uuid, text, text, text, text, bigint, boolean)
  is 'Atomically updates a local catalog product and one of its variants for commerce administrators.';
