\ir fixtures/gestion_mcp_schema.sql
\ir ../migrations/20261106143342_gestion_mcp_catalog_and_bridge.sql
\ir ../migrations/20261106143343_gestion_mcp_enforce_oauth_boundary.sql

begin;
create function pg_temp.request_as(p_user uuid, p_session uuid, p_oauth boolean, p_method text, p_path text, p_sign boolean, p_age int default 0)
returns void language plpgsql as $$
declare
  oauth_client text := '30000000-0000-4000-8000-000000000001';
  signed_at text := (floor(extract(epoch from clock_timestamp()))::bigint - p_age)::text;
  signature text;
begin
  perform set_config('request.jwt.claims', jsonb_strip_nulls(jsonb_build_object(
    'role', 'authenticated', 'sub', p_user, 'session_id', p_session, 'client_id', case when p_oauth then oauth_client end))::text, true);
  perform set_config('request.method', p_method, true);
  perform set_config('request.path', p_path, true);
  if p_sign then
    signature := encode(extensions.hmac(concat_ws(E'\n', 'matearte-mcp-v1', 'rest:' || p_method || ':' || p_path,
      p_user::text, p_session::text, oauth_client, signed_at), public.gestion_mcp_bridge_key(), 'sha256'), 'hex');
  end if;
  perform set_config('request.headers', jsonb_build_object('x-matearte-mcp-proof',
    case when signature is null then 'intento-de-falsificar' else signed_at || '.' || signature end)::text, true);
end;
$$;

do $$
declare
  richard uuid := '5afbc94d-aecf-44e8-b12e-e136f49abb62';
  other_owner uuid := '10000000-0000-4000-8000-000000000002';
  connector uuid := '20000000-0000-4000-8000-000000000001';
  panel uuid := '20000000-0000-4000-8000-000000000002';
  other_connector uuid := '20000000-0000-4000-8000-000000000003';
  first_id uuid := '40000000-0000-4000-8000-000000000001';
  second_id uuid := '40000000-0000-4000-8000-000000000002';
  product jsonb := '{"slug":"bombilla-de-prueba","name":"Bombilla de prueba","category":"bombillas","description":"","sale_mode":"standard","peso":20,"attributes":{}}';
  variants jsonb := '[{"sku":"991","name":"Única","price_minor":12345,"color":null}]';
begin
  if has_function_privilege('authenticated', 'public.gestion_mcp_bridge_key()', 'EXECUTE')
     or has_function_privilege('anon', 'public.gestion_mcp_bridge_key()', 'EXECUTE') then
    raise exception 'An external role can read the signing secret';
  end if;

  perform pg_temp.request_as(richard, panel, false, 'POST', '/commerce_products', false);
  set local role authenticated;
  perform public.gestion_data_api_access();
  insert into storage.objects values ('panel.jpg');
  reset role;

  -- A connector still cannot enter if an upstream hook omits the client_id claim.
  perform pg_temp.request_as(richard, connector, false, 'POST', '/commerce_products', false);
  set local role authenticated;
  begin
    perform public.gestion_data_api_access();
    raise exception 'Accepted direct product write with an OAuth session';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into storage.objects values ('oauth.jpg');
    raise exception 'Accepted a direct OAuth storage write';
  exception when insufficient_privilege then null;
  end;
  reset role;

  perform pg_temp.request_as(richard, connector, true, 'GET', '/commerce_products', false);
  begin
    perform public.gestion_data_api_access();
    raise exception 'Accepted an unsigned read';
  exception when insufficient_privilege then null;
  end;
  perform pg_temp.request_as(richard, connector, true, 'GET', '/commerce_products', true);
  perform public.gestion_data_api_access();
  perform set_config('request.method', 'POST', true);
  begin
    perform public.gestion_data_api_access();
    raise exception 'Accepted reuse of a read signature for a write';
  exception when insufficient_privilege then null;
  end;
  perform pg_temp.request_as(richard, connector, true, 'POST', '/commerce_products', true);
  begin
    perform public.gestion_data_api_access();
    raise exception 'Accepted a write outside the tool paths';
  exception when insufficient_privilege then null;
  end;
  perform pg_temp.request_as(richard, connector, true, 'POST', '/purchases', true, 90);
  begin
    perform public.gestion_data_api_access();
    raise exception 'Accepted an expired signature';
  exception when insufficient_privilege then null;
  end;
  perform pg_temp.request_as(richard, connector, true, 'POST', '/purchases', true);
  perform public.gestion_data_api_access();

  perform pg_temp.request_as(other_owner, other_connector, true, 'POST', '/rpc/gestion_mcp_create_catalog_product', true);
  begin
    perform public.gestion_mcp_create_catalog_product(first_id, product, variants);
    raise exception 'Accepted a product write from a different owner';
  exception when insufficient_privilege then null;
  end;
  perform pg_temp.request_as(richard, connector, true, 'POST', '/rpc/gestion_mcp_create_catalog_product', false);
  begin
    perform public.gestion_mcp_create_catalog_product(first_id, product, variants);
    raise exception 'Accepted direct invocation of the catalog function';
  exception when insufficient_privilege then null;
  end;
  perform pg_temp.request_as(richard, connector, true, 'POST', '/rpc/gestion_mcp_create_catalog_product', true);
  set local role authenticated;
  perform public.gestion_data_api_access();
  if (public.gestion_mcp_create_catalog_product(first_id, product, variants)->>'ya_registrado')::boolean then
    raise exception 'The first insert was reported as a retry';
  end if;
  if not (public.gestion_mcp_create_catalog_product(first_id, product, variants)->>'ya_registrado')::boolean then
    raise exception 'A retry was not recognized';
  end if;
  begin
    perform public.gestion_mcp_create_catalog_product(second_id, product || '{"category":"servicios"}', variants);
    raise exception 'Accepted a service that its trigger would enable in Local';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.gestion_mcp_create_catalog_product(first_id, product || '{"description":"Otra"}', variants);
    raise exception 'A retry key was reused for a different payload';
  exception when unique_violation then null;
  end;
  begin
    perform public.gestion_mcp_create_catalog_product(second_id, product || '{"name":"Segunda bombilla","slug":"segunda"}', variants);
    raise exception 'Accepted a duplicate variant SKU';
  exception when unique_violation then null;
  end;
  reset role;
  update auth.sessions set not_after = clock_timestamp() - interval '1 minute' where id = connector;
  begin
    perform public.gestion_data_api_access();
    raise exception 'Accepted a proof for a session that is no longer valid';
  exception when insufficient_privilege then null;
  end;
  if (select count(*) from commerce_products) <> 1
     or not exists(select 1 from commerce_products where id = first_id and not published)
     or not exists(select 1 from commerce_variants where product_id = first_id and sku = '991' and price_minor = 12345
       and not (active or available_local or available_web or available_wholesale)) then
    raise exception 'An incomplete or published product escaped the transaction';
  end if;
end;
$$;
rollback;
