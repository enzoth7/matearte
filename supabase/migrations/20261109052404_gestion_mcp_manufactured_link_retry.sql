create or replace function public.gestion_mcp_save_manufactured_product(
  p_id uuid, p_catalog_product_id uuid, p_reference_cost_minor bigint, p_supplies jsonb
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_catalog public.commerce_products%rowtype;
  v_existing public.inventory_manufactured_products%rowtype;
  v_supply jsonb;
  v_ids uuid[] := '{}';
  v_line_id uuid;
  v_quantity numeric;
begin
  perform private.require_internal_staff();
  if auth.uid() is distinct from '5afbc94d-aecf-44e8-b12e-e136f49abb62'::uuid then
    raise insufficient_privilege using message = 'Solo Richard puede guardar costos desde el MCP';
  end if;
  if p_id is null or p_catalog_product_id is null or p_reference_cost_minor < 0 or
    jsonb_typeof(p_supplies) is distinct from 'array' or jsonb_array_length(p_supplies) > 100 then
    raise exception 'Revisá producto, costo e insumos' using errcode = '22023';
  end if;
  select * into v_catalog from public.commerce_products where id = p_catalog_product_id;
  if not found or nullif(btrim(v_catalog.category_code), '') is null then
    raise exception 'El producto de catálogo no existe o no tiene categoría' using errcode = '22023';
  end if;
  select * into v_existing from public.inventory_manufactured_products where id = p_id for update;
  if found and v_existing.catalog_product_id is not null and v_existing.catalog_product_id is distinct from p_catalog_product_id then
    raise exception 'El identificador ya corresponde a otro producto' using errcode = '23505';
  end if;
  for v_supply in select value from jsonb_array_elements(p_supplies) loop
    v_line_id := (v_supply->>'cost_line_id')::uuid;
    v_quantity := (v_supply->>'quantity')::numeric;
    if v_line_id is null or v_line_id = any(v_ids) or v_quantity <= 0 or v_quantity > 100000 then
      raise exception 'Revisá los insumos y sus cantidades' using errcode = '22023';
    end if;
    v_ids := array_append(v_ids, v_line_id);
    if not exists (
      select 1 from public.inventory_cost_lines line
      join public.inventory_cost_profiles profile on profile.id = line.profile_id
      where line.id = v_line_id and profile.category_code = v_catalog.category_code
        and line.kind in ('material', 'supply')
    ) then raise exception 'El insumo no corresponde a la categoría' using errcode = '22023'; end if;
  end loop;
  insert into public.inventory_manufactured_products
    (id, name, category_code, catalog_product_id, reference_variable_cost_minor)
  values (p_id, v_catalog.name, v_catalog.category_code, p_catalog_product_id, p_reference_cost_minor)
  on conflict (id) do update set
    catalog_product_id = excluded.catalog_product_id,
    category_code = excluded.category_code,
    name = case when public.inventory_manufactured_products.source_key is null
      then excluded.name else public.inventory_manufactured_products.name end,
    reference_variable_cost_minor = coalesce(excluded.reference_variable_cost_minor,
      public.inventory_manufactured_products.reference_variable_cost_minor),
    updated_at = now();
  delete from public.inventory_manufactured_supplies
    where product_id = p_id and not (cost_line_id = any(v_ids));
  for v_supply in select value from jsonb_array_elements(p_supplies) loop
    insert into public.inventory_manufactured_supplies(product_id, cost_line_id, quantity)
    values (p_id, (v_supply->>'cost_line_id')::uuid, (v_supply->>'quantity')::numeric)
    on conflict (product_id, cost_line_id) do update set quantity = excluded.quantity;
  end loop;
  return jsonb_build_object('id', p_id, 'catalog_product_id', p_catalog_product_id,
    'supplies_count', array_length(v_ids, 1));
end;
$$;
