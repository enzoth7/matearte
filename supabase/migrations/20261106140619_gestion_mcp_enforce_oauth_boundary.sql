-- Apply after the signed MCP bridge and the Edge/API guards are deployed.
create function private.gestion_is_oauth_session()
returns boolean language sql stable security definer set search_path = '' as $$
  select nullif(auth.jwt()->>'client_id', '') is not null or exists (
    select 1 from auth.sessions s
    where s.id = case
      when auth.jwt()->>'session_id' ~ '^[0-9a-fA-F]{8}(-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}$'
        then (auth.jwt()->>'session_id')::uuid
      else null
    end
      and s.user_id = auth.uid() and s.oauth_client_id is not null
  );
$$;
revoke all on function private.gestion_is_oauth_session() from public, anon, authenticated, service_role;
grant execute on function private.gestion_is_oauth_session() to authenticated;

create function public.gestion_data_api_access()
returns void language plpgsql security definer set search_path = '' as $$
declare
  route text := current_setting('request.path', true);
  method text := current_setting('request.method', true);
begin
  if not private.gestion_is_oauth_session() then return; end if;
  if private.gestion_mcp_signed_request() and (
    (method in ('GET', 'HEAD') and route in (
      '/orders', '/order_items', '/ad_reports', '/local_sales', '/local_sale_items', '/local_sale_receipts',
      '/commerce_payments', '/commerce_bank_transfer_receipts', '/order_lines', '/commerce_products',
      '/commerce_variants', '/commerce_product_images', '/local_sales_customers', '/customers',
      '/rural_raffle_entries', '/purchases', '/fixed_expenses', '/fixed_expense_payments', '/expense_categories',
      '/shipping_rates', '/commerce_international_shipping_rates', '/commerce_exchange_rates', '/settings',
      '/commerce_discounts', '/commerce_categories', '/commerce_attribute_definitions', '/commerce_attribute_options',
      '/commerce_category_attributes', '/site_announcements', '/commerce_admin_users', '/commerce_settings',
      '/commerce_bank_transfer_settings'
    ))
    or (method = 'POST' and route in ('/rpc/gestion_customer_profile_details_full', '/rpc/gestion_web_leads'))
    or (method = 'POST' and route in ('/purchases', '/rpc/gestion_mcp_create_catalog_product')
      and auth.uid() = '5afbc94d-aecf-44e8-b12e-e136f49abb62'::uuid)
  ) then return; end if;
  raise insufficient_privilege using message = 'Usá las herramientas del MCP con esta credencial.';
end;
$$;
revoke all on function public.gestion_data_api_access() from public, anon, authenticated, service_role;
grant execute on function public.gestion_data_api_access() to anon, authenticated, service_role;
alter role authenticator set pgrst.db_pre_request = 'public.gestion_data_api_access';
notify pgrst, 'reload config';

-- Storage evaluates its own policies. Public images remain readable as public assets.
create policy gestion_storage_no_oauth on storage.objects as restrictive
for all to authenticated using (not (select private.gestion_is_oauth_session()))
with check (not (select private.gestion_is_oauth_session()));
