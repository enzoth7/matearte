-- Eliminar productos y variantes del catálogo según su uso real en pedidos.
-- Bloquea solo si hay pedidos activos; los pedidos históricos conservan sus datos (título y snapshot)
-- y quedan sin vínculo al producto (order_items.source_variant_id pasa a null).

create or replace function private.catalog_usage(p_product_id uuid, p_variant_id uuid default null)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with target as (
    select v.id from public.commerce_variants v
    where v.product_id = p_product_id and (p_variant_id is null or v.id = p_variant_id)
  ),
  linked as (
    select distinct o.id, o.reference_code, o.channel, o.status,
      o.status in ('pending_payment', 'payment_verification_pending', 'paid_pending_review',
                   'ready_for_fulfillment', 'ready_for_production', 'manual_review', 'internal_open') as active
    from public.order_items i
    join public.orders o on o.id = i.order_id
    where i.source_variant_id in (select id from target)
  )
  select jsonb_build_object(
    'variants', (select count(*) from target),
    'images', (select count(*) from public.commerce_product_images im
               where im.product_id = p_product_id and (p_variant_id is null or im.variant_id = p_variant_id)),
    'active_orders', (select count(*) from linked where active),
    'historical_orders', (select count(*) from linked where not active),
    'active_references', coalesce((select jsonb_agg(reference_code order by reference_code) from (select reference_code from linked where active order by reference_code limit 8) r), '[]'::jsonb)
  );
$$;

create or replace function public.gestion_catalog_usage(p_product_id uuid, p_variant_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not ((select private.is_pricing_admin()) or (select private.is_commerce_admin())) then
    raise exception 'Acceso no autorizado' using errcode = '42501';
  end if;
  return private.catalog_usage(p_product_id, p_variant_id);
end;
$$;

create or replace function public.gestion_delete_catalog_product(p_product_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usage jsonb;
  v_paths text[];
begin
  if not ((select private.is_pricing_admin()) or (select private.is_commerce_admin())) then
    raise exception 'Acceso no autorizado' using errcode = '42501';
  end if;
  perform 1 from public.commerce_products where id = p_product_id for update;
  if not found then raise exception 'El producto no existe' using errcode = '22023'; end if;
  v_usage := private.catalog_usage(p_product_id, null);
  if (v_usage ->> 'active_orders')::int > 0 then
    raise exception 'El producto tiene % pedidos activos (%)', v_usage ->> 'active_orders', v_usage ->> 'active_references' using errcode = '23503';
  end if;
  select coalesce(array_agg(storage_path), array[]::text[]) into v_paths from public.commerce_product_images where product_id = p_product_id;
  delete from public.commerce_products where id = p_product_id;
  return v_usage || jsonb_build_object('storage_paths', to_jsonb(v_paths));
end;
$$;

create or replace function public.gestion_delete_catalog_variant(p_variant_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_product uuid;
  v_usage jsonb;
begin
  if not ((select private.is_pricing_admin()) or (select private.is_commerce_admin())) then
    raise exception 'Acceso no autorizado' using errcode = '42501';
  end if;
  select product_id into v_product from public.commerce_variants where id = p_variant_id for update;
  if not found then raise exception 'La variante no existe' using errcode = '22023'; end if;
  v_usage := private.catalog_usage(v_product, p_variant_id);
  if (v_usage ->> 'active_orders')::int > 0 then
    raise exception 'La variante tiene % pedidos activos (%)', v_usage ->> 'active_orders', v_usage ->> 'active_references' using errcode = '23503';
  end if;
  delete from public.commerce_variants where id = p_variant_id;
  return v_usage;
end;
$$;

revoke all on function private.catalog_usage(uuid, uuid) from public, anon, authenticated;
revoke all on function public.gestion_catalog_usage(uuid, uuid) from public, anon;
grant execute on function public.gestion_catalog_usage(uuid, uuid) to authenticated;
revoke all on function public.gestion_delete_catalog_product(uuid) from public, anon;
grant execute on function public.gestion_delete_catalog_product(uuid) to authenticated;
revoke all on function public.gestion_delete_catalog_variant(uuid) from public, anon;
grant execute on function public.gestion_delete_catalog_variant(uuid) to authenticated;
