-- Prepare the signed bridge before deploying the Edge Functions and enabling the boundary.
select vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'),
  'matearte_gestion_mcp_bridge_v1', 'Signs requests from the Gestión MCP server')
where not exists (select 1 from vault.secrets where name = 'matearte_gestion_mcp_bridge_v1');

create function public.gestion_mcp_bridge_key()
returns text language sql stable security definer set search_path = '' as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'matearte_gestion_mcp_bridge_v1';
$$;
revoke all on function public.gestion_mcp_bridge_key() from public, anon, authenticated, service_role;
grant execute on function public.gestion_mcp_bridge_key() to service_role;

create function private.gestion_mcp_signed_request()
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare
  claims jsonb := auth.jwt();
  proof text := coalesce(nullif(current_setting('request.headers', true), ''), '{}')::jsonb ->> 'x-matearte-mcp-proof';
  route text := 'rest:' || current_setting('request.method', true) || ':' || current_setting('request.path', true);
  signed_at text;
  expected text;
begin
  if proof is null or proof !~ '^[0-9]{10}\.[0-9a-f]{64}$'
    or route is null or nullif(claims->>'client_id', '') is null
    or coalesce(claims->>'session_id', '') !~ '^[0-9a-fA-F]{8}(-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}$'
    or auth.uid() is null then
    return false;
  end if;
  signed_at := split_part(proof, '.', 1);
  if abs(extract(epoch from statement_timestamp()) - signed_at::bigint) > 30 then return false; end if;
  expected := encode(extensions.hmac(
    concat_ws(E'\n', 'matearte-mcp-v1', route, claims->>'sub', claims->>'session_id', claims->>'client_id', signed_at),
    public.gestion_mcp_bridge_key(), 'sha256'), 'hex');
  -- Compare hashes to avoid exposing the HMAC through early-exit string comparisons.
  return coalesce(sha256(convert_to(expected, 'UTF8')) = sha256(convert_to(split_part(proof, '.', 2), 'UTF8')), false)
    and exists (select 1 from auth.sessions s where s.id = (claims->>'session_id')::uuid
      and s.user_id = auth.uid() and s.oauth_client_id::text = claims->>'client_id'
      and (s.not_after is null or s.not_after > statement_timestamp()));
end;
$$;
revoke all on function private.gestion_mcp_signed_request() from public, anon, authenticated, service_role;

create table private.gestion_mcp_catalog_requests (
  id uuid primary key,
  actor_id uuid not null,
  payload_hash bytea not null
);
alter table private.gestion_mcp_catalog_requests enable row level security;
revoke all on private.gestion_mcp_catalog_requests from public, anon, authenticated, service_role;

-- One transaction for the draft, variants and retry receipt. All writable columns are explicit.
create function public.gestion_mcp_create_catalog_product(p_request_id uuid, p_product jsonb, p_variants jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  digest bytea;
  prior private.gestion_mcp_catalog_requests%rowtype;
  target_category text := p_product->>'category';
  product_name text := btrim(p_product->>'name');
  slug text := p_product->>'slug';
  inserted_id uuid;
  is_published boolean;
begin
  if not private.gestion_mcp_signed_request()
    or actor is distinct from '5afbc94d-aecf-44e8-b12e-e136f49abb62'::uuid
    or not exists (select 1 from public.commerce_admin_users where user_id = actor and active and access_user_id = 't1') then
    raise insufficient_privilege using message = 'El alta por MCP está reservada a Richard.';
  end if;
  if p_request_id is null or jsonb_typeof(p_product) is distinct from 'object'
    or jsonb_typeof(p_product->'attributes') is distinct from 'object'
    or jsonb_typeof(p_variants) is distinct from 'array'
    or jsonb_array_length(p_variants) > 15 or slug is null or length(slug) > 120
    or product_name is null or length(product_name) not between 1 and 160 then
    raise invalid_parameter_value using message = 'Revisá los datos de la ficha.';
  end if;
  digest := sha256(convert_to(jsonb_build_array(p_product, p_variants)::text, 'UTF8'));
  perform pg_advisory_xact_lock(hashtextextended('gestion-mcp-product:' || p_request_id::text, 0));
  select * into prior from private.gestion_mcp_catalog_requests where id = p_request_id;
  if found then
    if prior.actor_id <> actor or prior.payload_hash <> digest then
      raise unique_violation using message = 'La clave de alta ya corresponde a otros datos.';
    end if;
    select p.published into is_published from public.commerce_products p where p.id = p_request_id;
    if not found then
      raise invalid_parameter_value using message = 'La ficha que se había creado ya no existe.';
    end if;
    return jsonb_build_object('id', p_request_id, 'ya_registrado', true, 'publicado', is_published);
  end if;
  if target_category = 'servicios' or not exists (
    select 1 from public.commerce_categories c where c.code = target_category and c.active
  ) then
    raise invalid_parameter_value using message = 'La categoría no está activa.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('gestion-mcp-name:' || target_category || ':' || lower(product_name), 0));
  if exists (select 1 from public.commerce_products p where p.category_code = target_category and lower(btrim(p.name)) = lower(product_name)) then
    raise unique_violation using message = 'Ya hay un producto con ese nombre en la categoría.';
  end if;
  insert into public.commerce_products
    (id, editorial_slug, name, category, category_code, description, sale_mode, peso, attributes, published)
  values (p_request_id, slug, product_name, target_category, target_category, p_product->>'description',
    p_product->>'sale_mode', (p_product->>'peso')::int, p_product->'attributes', false)
  on conflict (editorial_slug) do nothing returning id into inserted_id;
  if inserted_id is null then
    insert into public.commerce_products
      (id, editorial_slug, name, category, category_code, description, sale_mode, peso, attributes, published)
    values (p_request_id, rtrim(left(slug, 83), '-') || '-' || replace(p_request_id::text, '-', ''),
      product_name, target_category, target_category, p_product->>'description', p_product->>'sale_mode',
      (p_product->>'peso')::int, p_product->'attributes', false);
  end if;
  insert into public.commerce_variants
    (product_id, sku, name, price_minor, base_price_minor, color, option_values, active, available_local, available_web, available_wholesale)
  select p_request_id, v.sku, v.name, v.price_minor, v.price_minor, v.color,
    case when v.color is null then '{}'::jsonb else jsonb_build_object('color', v.color) end,
    false, false, false, false
  from jsonb_to_recordset(p_variants) as v(sku text, name text, price_minor bigint, color text);
  insert into private.gestion_mcp_catalog_requests (id, actor_id, payload_hash) values (p_request_id, actor, digest);
  return jsonb_build_object('id', p_request_id, 'ya_registrado', false, 'publicado', false);
end;
$$;
revoke all on function public.gestion_mcp_create_catalog_product(uuid,jsonb,jsonb) from public, anon, authenticated, service_role;
grant execute on function public.gestion_mcp_create_catalog_product(uuid,jsonb,jsonb) to authenticated;
