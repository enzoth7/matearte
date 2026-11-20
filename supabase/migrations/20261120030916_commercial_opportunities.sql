create table public.commercial_opportunities (
  id uuid primary key default gen_random_uuid(),
  empresa text not null check (btrim(empresa) <> ''),
  correo text check (correo is null or (correo = lower(btrim(correo)) and correo ~ '^[^ @]+@[^ @]+[.][^ @]+$')),
  actividad text not null,
  ubicacion text not null,
  pais text not null,
  mercado text not null check (mercado in ('Uruguay','Exterior')),
  region text not null,
  prioridad text not null check (prioridad in ('Alta','Media','Exploratoria')),
  canal text not null,
  destinatario text not null,
  propuesta text not null,
  senal text not null,
  motivo text not null,
  fuente_comercial text not null check (fuente_comercial like 'https://%'),
  fuente_contacto text not null check (fuente_contacto like 'https://%'),
  proxima_accion text not null,
  fecha_revision date not null,
  estado text not null default 'Sin contactar' check (estado in ('Sin contactar','En preparación','Contactada','Baja')),
  clave_envio uuid,
  referencia_correo text,
  contactada_en timestamptz,
  tiene_correo boolean generated always as (correo is not null) stored
);
create unique index commercial_opportunities_empresa_pais on public.commercial_opportunities(lower(btrim(empresa)),lower(btrim(pais)));
create unique index commercial_opportunities_correo on public.commercial_opportunities(correo) where correo is not null;

alter table public.commercial_opportunities enable row level security;
revoke all on public.commercial_opportunities from public, anon, authenticated;
grant select (id,empresa,correo,actividad,ubicacion,pais,mercado,region,prioridad,canal,destinatario,propuesta,senal,motivo,fuente_comercial,fuente_contacto,proxima_accion,fecha_revision,estado,contactada_en,tiene_correo)
  on public.commercial_opportunities to authenticated;
grant select, insert, update on public.commercial_opportunities to service_role;
create policy oportunidades_lectura on public.commercial_opportunities for select to authenticated
  using ((select private.gestion_has_page_access('/comercial/consultas')));

-- El transporte es la casilla de Richard. Una reserva ambigua nunca habilita un segundo envío.
create function public.gestion_reservar_contacto_comercial(p_id uuid, p_clave uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  fila public.commercial_opportunities;
begin
  if auth.uid() is distinct from '5afbc94d-aecf-44e8-b12e-e136f49abb62'::uuid
    or not private.gestion_has_page_access('/comercial/consultas') then
    raise insufficient_privilege using message='Esta operación requiere la cuenta de Richard.';
  end if;
  if p_clave is null then raise exception 'Falta la clave de envío.'; end if;
  select * into strict fila from public.commercial_opportunities where id = p_id for update;
  if fila.correo is null then return jsonb_build_object('puede_enviar',false,'motivo','Sin correo publicado'); end if;
  if exists (select 1 from public.marketing_unsubscribes u where lower(u.email) = fila.correo) then
    update public.commercial_opportunities set estado='Baja' where id=p_id and estado='Sin contactar';
    return jsonb_build_object('puede_enviar',false,'motivo','Baja registrada');
  end if;
  if fila.estado <> 'Sin contactar' then
    return jsonb_build_object('puede_enviar',false,'estado',fila.estado,'misma_reserva',coalesce(fila.clave_envio=p_clave,false));
  end if;
  if fila.clave_envio = p_clave then
    return jsonb_build_object('puede_enviar',false,'motivo','Esta reserva ya fue cancelada');
  end if;
  update public.commercial_opportunities set estado='En preparación',clave_envio=p_clave where id=p_id;
  return jsonb_build_object('puede_enviar',true,'empresa',fila.empresa,'correo',fila.correo);
end;
$$;

create function public.gestion_resolver_contacto_comercial(p_id uuid, p_clave uuid, p_enviado boolean, p_referencia text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  fila public.commercial_opportunities;
begin
  if auth.uid() is distinct from '5afbc94d-aecf-44e8-b12e-e136f49abb62'::uuid
    or not private.gestion_has_page_access('/comercial/consultas') then
    raise insufficient_privilege using message='Esta operación requiere la cuenta de Richard.';
  end if;
  if p_clave is null or p_enviado is null then raise exception 'Falta identificar el envío y su resultado.'; end if;
  if p_enviado and (coalesce(btrim(p_referencia),'')='' or length(p_referencia)>300) then raise exception 'Ingresá la referencia del mensaje enviado.'; end if;
  select * into strict fila from public.commercial_opportunities where id=p_id for update;
  if fila.clave_envio is distinct from p_clave then raise exception 'La clave no corresponde a esta reserva.'; end if;
  if fila.estado='Contactada' and p_enviado and fila.referencia_correo=btrim(p_referencia) then
    return jsonb_build_object('estado',fila.estado,'contactada_en',fila.contactada_en);
  end if;
  if fila.estado='Sin contactar' and not p_enviado then return jsonb_build_object('estado',fila.estado); end if;
  if fila.estado<>'En preparación' then raise exception 'La oportunidad no tiene esa reserva activa.'; end if;
  update public.commercial_opportunities
    set estado=case when p_enviado then 'Contactada' else 'Sin contactar' end,
        contactada_en=case when p_enviado then now() end,
        referencia_correo=case when p_enviado then btrim(p_referencia) end
    where id=p_id returning * into fila;
  return jsonb_build_object('estado',fila.estado,'contactada_en',fila.contactada_en);
end;
$$;
revoke all on function public.gestion_reservar_contacto_comercial(uuid,uuid), public.gestion_resolver_contacto_comercial(uuid,uuid,boolean,text) from public, anon;
grant execute on function public.gestion_reservar_contacto_comercial(uuid,uuid), public.gestion_resolver_contacto_comercial(uuid,uuid,boolean,text) to authenticated;

CREATE OR REPLACE FUNCTION public.gestion_data_api_access()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  route text := current_setting('request.path', true);
  method text := current_setting('request.method', true);
  richard boolean := auth.uid() = '5afbc94d-aecf-44e8-b12e-e136f49abb62'::uuid;
begin
  if not private.gestion_is_oauth_session() then return; end if;
  if private.gestion_mcp_signed_request() and (
    (method in ('GET', 'HEAD') and route in (
      '/commercial_opportunities', '/orders', '/order_items', '/ad_reports', '/local_sales', '/local_sale_items', '/local_sale_receipts',
      '/commerce_payments', '/commerce_bank_transfer_receipts', '/order_lines', '/commerce_products',
      '/commerce_variants', '/commerce_product_images', '/local_sales_customers', '/customers',
      '/rural_raffle_entries', '/purchases', '/fixed_expenses', '/fixed_expense_payments', '/expense_categories',
      '/shipping_rates', '/commerce_international_shipping_rates', '/commerce_exchange_rates', '/settings',
      '/commerce_discounts', '/commerce_categories', '/commerce_attribute_definitions', '/commerce_attribute_options',
      '/commerce_category_attributes', '/site_announcements', '/commerce_admin_users', '/commerce_settings',
      '/commerce_bank_transfer_settings', '/finance_income_categories', '/finance_manual_incomes',
      '/finance_monthly_openings', '/finance_monthly_adjustments', '/finance_accounts', '/finance_monthly_closes',
      '/contacts', '/customer_account_receipts', '/customer_account_allocations', '/wholesale_order_receipts',
      '/wholesale_order_payment_openings', '/wholesale_consignments', '/wholesale_consignment_lines',
      '/wholesale_consignment_movements', '/wholesale_consignment_allocations', '/inventory_cost_profiles',
      '/inventory_cost_lines', '/inventory_manufactured_products', '/inventory_manufactured_supplies'
    ))
    or (method = 'POST' and route in ('/rpc/gestion_customer_profile_details_full', '/rpc/gestion_web_leads'))
    or (richard and (
      (method = 'POST' and route in (
        '/rpc/gestion_reservar_contacto_comercial', '/rpc/gestion_resolver_contacto_comercial',
        '/purchases', '/fixed_expenses', '/fixed_expense_payments', '/expense_categories',
        '/finance_income_categories', '/finance_manual_incomes', '/finance_monthly_openings',
        '/finance_monthly_adjustments', '/inventory_cost_profiles', '/inventory_cost_lines',
        '/commerce_exchange_rates', '/rpc/gestion_mcp_create_catalog_product',
        '/rpc/gestion_record_wholesale_payment', '/rpc/gestion_record_local_sale_payment',
        '/rpc/gestion_record_customer_account_receipt', '/rpc/gestion_allocate_customer_account_receipt',
        '/rpc/gestion_mcp_create_local_credit_order', '/rpc/gestion_create_wholesale_consignment', '/rpc/gestion_link_wholesale_consignment',
        '/rpc/gestion_record_wholesale_consignment_movement',
        '/rpc/gestion_record_wholesale_consignment_payment',
        '/rpc/gestion_allocate_wholesale_consignment_receipt',
        '/rpc/gestion_mcp_save_manufactured_product'
      )) or (method = 'PATCH' and route = '/settings')
    ))
  ) then return; end if;
  raise insufficient_privilege using message = 'Usá las herramientas del MCP con esta credencial.';
end;
$function$;
notify pgrst, 'reload schema';
