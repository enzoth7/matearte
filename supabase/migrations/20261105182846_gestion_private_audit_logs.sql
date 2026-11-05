-- Immutable server-side audit. No historical business events are reconstructed.
create table private.gestion_log_readers (user_id uuid primary key);
insert into private.gestion_log_readers values
 ('deeec8ea-ace6-4f0a-a578-17751a83f707'),
 ('5afbc94d-aecf-44e8-b12e-e136f49abb62');
create table private.gestion_log_config (id boolean primary key default true check(id), activated_at timestamptz not null default clock_timestamp());
insert into private.gestion_log_config default values;
create table private.gestion_audit_events (
 id bigint generated always as identity primary key,
 occurred_at timestamptz not null default clock_timestamp(),
 group_id text not null,
 actor_id uuid, actor_name text not null, access_user_id text,
 source text not null, entity_type text not null, entity_id text not null,
 reference text not null, operation text not null check(operation in ('INSERT','UPDATE','DELETE','LOGIN')),
 before_values jsonb not null default '{}', after_values jsonb not null default '{}',
 changed_fields text[] not null default '{}', monetary boolean not null default false,
 currency text not null default 'UYU', value_unit text
);
create index gestion_audit_recent_idx on private.gestion_audit_events(occurred_at desc,id desc);
create index gestion_audit_actor_idx on private.gestion_audit_events(actor_id,occurred_at desc);
create index gestion_audit_group_idx on private.gestion_audit_events(group_id);
create unique index gestion_audit_login_idx on private.gestion_audit_events(entity_id) where operation='LOGIN';
alter table private.gestion_log_readers enable row level security;
alter table private.gestion_log_config enable row level security;
alter table private.gestion_audit_events enable row level security;
revoke all on private.gestion_log_readers,private.gestion_log_config,private.gestion_audit_events from public,anon,authenticated,service_role;

create function private.gestion_logs_allowed() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.gestion_log_readers r join public.commerce_admin_users u on u.user_id=r.user_id where r.user_id=auth.uid() and u.active);
$$;
create function private.gestion_logs_immutable() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'El historial no se puede modificar ni eliminar' using errcode='42501'; end;
$$;
create trigger gestion_logs_immutable before update or delete or truncate on private.gestion_audit_events
 for each statement execute function private.gestion_logs_immutable();

create function private.gestion_audit_change() returns trigger language plpgsql security definer set search_path='' as $$
declare
 old_row jsonb := case when TG_OP='INSERT' then '{}'::jsonb else to_jsonb(old) end;
 new_row jsonb := case when TG_OP='DELETE' then '{}'::jsonb else to_jsonb(new) end;
 row_data jsonb := case when TG_OP='DELETE' then old_row else new_row end;
 previous jsonb := '{}'; following jsonb := '{}'; fields text[] := '{}'; key text;
 actor uuid := auth.uid(); actor_label text; access_id text; origin text := 'gestion';
 request_headers jsonb := coalesce(nullif(current_setting('request.headers',true),''),'{}')::jsonb;
 grouping text := 'tx:' || txid_current()::text;
 entity_key text; ref text; order_key uuid; money_change boolean := false; curr text; val_unit text; price_change record; prior_version uuid;
 deleted_refs jsonb := coalesce(nullif(current_setting('gestion.deleted_order_refs',true),''),'{}')::jsonb;
begin
 -- Only a trusted service JWT may supply the actor verified by its Edge Function.
 if auth.role()='service_role' then
   actor := null;
   if coalesce(request_headers->>'x-gestion-actor-id','') ~ '^[0-9a-fA-F-]{36}$' then
     actor := (request_headers->>'x-gestion-actor-id')::uuid;
     if not exists(select 1 from public.commerce_admin_users where user_id=actor and active) then
       raise exception 'Responsable de auditoría inválido' using errcode='42501';
     end if;
     origin := 'servidor';
     if coalesce(request_headers->>'x-gestion-operation-id','') ~ '^[0-9a-fA-F-]{36}$' then
       grouping := 'request:' || (request_headers->>'x-gestion-operation-id');
     end if;
   end if;
 end if;
 select display_name,access_user_id into actor_label,access_id from public.commerce_admin_users where user_id=actor;
 if actor_label is null then
   actor_label := case when actor is null then 'Sistema' else 'Cliente web' end;
   origin := case when actor is null then 'sistema' else 'web' end;
 end if;
 foreach key in array string_to_array(TG_ARGV[1],',') loop
   if (old_row->key) is distinct from (new_row->key) then
     fields := array_append(fields,key);
     previous := previous || jsonb_build_object(key,old_row->key);
     following := following || jsonb_build_object(key,new_row->key);
     if key=any(string_to_array(TG_ARGV[2],',')) then money_change:=true; end if;
   end if;
 end loop;
 if cardinality(fields)=0 then return coalesce(new,old); end if;
 entity_key := coalesce(row_data->>'id',row_data->>'user_id',row_data->>'rule_key',row_data->>'currency_code',row_data->>'code',row_data->>'contact_key',row_data->>'email',row_data->>'singleton','config');
 if TG_TABLE_NAME='pricing_catalog_values' then
   select case when value_kind='percent' then 'percent' else 'UYU' end into val_unit from public.pricing_rule_definitions where rule_key=row_data->>'rule_key';
 elsif TG_TABLE_NAME='commerce_discounts' then val_unit:=case when row_data->>'discount_type'='percentage' then 'percent' else 'UYU' end; end if;
 if row_data ? 'rule_key' then entity_key := coalesce(row_data->>'version_id','') || ':' || (row_data->>'rule_key'); end if;
 if row_data ? 'attribute_code' then entity_key := coalesce(row_data->>'category_code',row_data->>'attribute_code') || ':' || coalesce(row_data->>'code',row_data->>'attribute_code') || ':' || coalesce(row_data->>'scope',''); end if;
 curr := coalesce(row_data->>'currency','UYU');
 ref := coalesce(row_data->>'reference_code',row_data->>'sku',row_data->>'subject',row_data->>'name',row_data->>'full_name',row_data->>'label_es',row_data->>'rule_key',row_data->>'code',row_data->>'description',entity_key);
 if TG_TABLE_NAME='fixed_expense_payments' then
   select currency into curr from public.fixed_expenses where id=(row_data->>'fixed_expense_id')::uuid;
 elsif TG_TABLE_NAME='orders' then
   ref := coalesce(row_data->>'reference_code','#' || (row_data->>'order_number'),entity_key);
   if TG_OP='DELETE' then
     perform set_config('gestion.deleted_order_refs',(deleted_refs || jsonb_build_object(entity_key,ref))::text,true);
   end if;
 elsif TG_TABLE_NAME in ('order_items','local_sale_receipts','commerce_payments','commerce_bank_transfer_receipts') then
   order_key := coalesce(row_data->>'order_id',row_data->>'sale_id')::uuid;
   select coalesce(reference_code,'#' || order_number::text),currency into ref,curr from public.orders where id=order_key;
   ref := coalesce(ref,deleted_refs->>order_key::text,order_key::text);
   if TG_TABLE_NAME='order_items' then ref:=ref || ': ' || coalesce(row_data->>'sku',row_data->>'title','Artículo'); end if;
 elsif TG_TABLE_NAME='pricing_catalog_values' then
   select 'Personalizador v' || version::text || ' (' || status || '): ' || (row_data->>'rule_key') into ref from public.pricing_catalog_versions where id=(row_data->>'version_id')::uuid;
 end if;
 insert into private.gestion_audit_events(group_id,actor_id,actor_name,access_user_id,source,entity_type,entity_id,reference,operation,before_values,after_values,changed_fields,monetary,currency,value_unit)
 values(grouping,actor,actor_label,access_id,origin,TG_ARGV[0],entity_key,coalesce(ref,entity_key),TG_OP,previous,following,fields,money_change,coalesce(curr,'UYU'),val_unit);
 -- Publishing is versioned: compare with the previous published catalog, not
 -- merely with the working draft's status.
 if TG_TABLE_NAME='pricing_catalog_versions' and new_row->>'status'='published' and old_row->>'status' is distinct from 'published' then
   select id into prior_version from public.pricing_catalog_versions
   where id<>(new_row->>'id')::uuid and status in ('published','archived')
   order by published_at desc nulls last,version desc limit 1;
   for price_change in
    select coalesce(a.rule_key,b.rule_key) as rule_key,a.value as previous_value,b.value as next_value,d.label,d.value_kind
    from (select rule_key,value from public.pricing_catalog_values where version_id=prior_version) a
    full join (select rule_key,value from public.pricing_catalog_values where version_id=(new_row->>'id')::uuid) b using(rule_key)
    left join public.pricing_rule_definitions d on d.rule_key=coalesce(a.rule_key,b.rule_key)
    where a.value is distinct from b.value
   loop
    insert into private.gestion_audit_events(group_id,actor_id,actor_name,access_user_id,source,entity_type,entity_id,reference,operation,before_values,after_values,changed_fields,monetary,currency,value_unit)
    values(grouping,actor,actor_label,access_id,origin,'Precio publicado del personalizador',entity_key || ':' || price_change.rule_key,
     'Personalizador v' || (new_row->>'version') || ': ' || coalesce(price_change.label,price_change.rule_key),'UPDATE',
     jsonb_build_object('value',price_change.previous_value),jsonb_build_object('value',price_change.next_value),array['value'],true,'UYU',case when price_change.value_kind='percent' then 'percent' else 'UYU' end);
   end loop;
 end if;
 return coalesce(new,old);
end;
$$;

-- Explicit business-field allowlists. Credentials, tokens, provider payloads and
-- technical timestamps are deliberately absent.
do $$
declare r record;
begin
 for r in select * from (values
 ('orders','Pedido','reference_code,channel,customer_name,status,currency,items_subtotal_minor,shipping_minor,payment_fee_minor,total_minor,shipping_method,shipping_carrier,tracking_code,sold_on,payment_method,deposit_minor,discount_code,discount_type,discount_value,discount_minor,paid_at,cancelled_at,shipped_at,delivered_at','items_subtotal_minor,shipping_minor,payment_fee_minor,total_minor,deposit_minor,discount_value,discount_minor'),
 ('order_items','Artículo del pedido','order_id,sku,title,quantity,unit_price_minor,total_minor,review_status,review_reason,production_status,unit_price_arg,total_arg,exchange_rate,no_cost,discount_percent','unit_price_minor,total_minor,unit_price_arg,total_arg,exchange_rate,no_cost,discount_percent'),
 ('local_sale_receipts','Cobro','sale_id,amount_minor,payment_method,paid_on','amount_minor'),
 ('commerce_payments','Pago web','order_id,provider,status,status_detail,amount_minor,currency','amount_minor'),
 ('commerce_bank_transfer_receipts','Comprobante','order_id,status,rejection_reason,reviewed_by',''),
 ('commerce_products','Producto','name,category,description,sale_mode,published,category_code,attributes,peso,apply_catalog_price_adjustment','apply_catalog_price_adjustment'),
 ('commerce_variants','Variante','product_id,sku,name,price_minor,base_price_minor,currency,active,color,option_values,available_local,available_web,available_wholesale,wholesale_price_arg,rim_type,leather_type,weight_grams','price_minor,base_price_minor,wholesale_price_arg'),
 ('pricing_catalog_values','Precio del personalizador','version_id,rule_key,value','value'),
 ('pricing_catalog_versions','Versión de precios','version,status,note,published_by','status'),
 ('pricing_rule_definitions','Regla de precio','rule_key,rule_type,label,value_kind,required,active',''),
 ('commerce_discounts','Descuento','code,discount_type,value,valid_from,valid_until,enabled,applicability,redemption_limit,welcome_only,category_codes,include_design_items','value,discount_type,enabled,category_codes,include_design_items'),
 ('commerce_settings','Ajustes comerciales','commerce_enabled,mercado_pago_enabled,paypal_enabled,payment_fee_enabled,catalog_price_adjustment_enabled,catalog_price_adjustment_percent,wholesale_mate_discount_enabled,wholesale_mate_quantity_threshold,wholesale_mate_discount_percent,wholesale_discount_categories,ars_use_base_price,uruguay_transfer_discount_enabled,uruguay_transfer_discount_categories,uruguay_transfer_discount_designs','payment_fee_enabled,catalog_price_adjustment_enabled,catalog_price_adjustment_percent,wholesale_mate_discount_enabled,wholesale_mate_quantity_threshold,wholesale_mate_discount_percent,wholesale_discount_categories,ars_use_base_price,uruguay_transfer_discount_enabled,uruguay_transfer_discount_categories,uruguay_transfer_discount_designs'),
 ('commerce_exchange_rates','Cotización','currency_code,rate_to_uyu','rate_to_uyu'),
 ('shipping_rates','Tarifa de envío','code,name,departments,rate_minor,is_pickup,active','rate_minor'),
 ('commerce_international_shipping_rates','Envío internacional','weight_label,weight_min_g,weight_max_g,argentina,suramerica,estados_unidos,resto_america,espana,resto_europa,resto_mundo','argentina,suramerica,estados_unidos,resto_america,espana,resto_europa,resto_mundo'),
 ('commerce_bank_transfer_settings','Cuentas de cobro','account_holder,transfer_account,cash_deposit_account,cash_deposit_label',''),
 ('commerce_argentina_settings','Cobros Argentina','enabled,bank_name,account_holder,cbu,alias,account_type,account_name,account_number,swift_code,branch',''),
 ('purchases','Compra o gasto','purchased_on,supplier,description,category,amount_minor,currency,payment_method,status,paid_on,invoice_number,notes','amount_minor'),
 ('fixed_expenses','Gasto fijo','name,category,amount_minor,currency,due_day,payment_method,starts_on,ends_on,active,notes','amount_minor'),
 ('fixed_expense_payments','Pago de gasto fijo','fixed_expense_id,month,amount_minor,paid_on','amount_minor'),
 ('expense_categories','Categoría de gasto','name,kind,active',''),
 ('ad_reports','Informe de pauta','period_start,period_end,platform,currency,campaigns,deposit_minor,deposit_on,previous_balance_minor,notes','campaigns,deposit_minor,previous_balance_minor'),
 ('contacts','Cliente','full_name,email,phone,additional_phones,company_name,address,city,country,department,postal_code,birth_date,notes,origin_channel,customer_type,inferred_category,product_interest,wholesale_name,in_agenda',''),
 ('customer_profiles','Perfil de cliente','full_name,phone,company,birth_date,department,city,address_line1,postal_code,country_code,origin_channel,customer_type,notes,additional_phones',''),
 ('contact_origin_overrides','Origen del cliente','contact_key,origin',''),
 ('marketing_campaigns','Campaña','subject,body,image_url,target_url,status,sent_at,mode,headline,button_label,audience_mode,selected_emails,recipient_count,batch_group_id,batch_number,batch_total,segment_name,discount_code,utm_campaign',''),
 ('marketing_segments','Segmento','name,filters',''),
 ('marketing_subscription_settings','Suscripción','enabled,headline,description,image_url,discount_code',''),
 ('marketing_unsubscribes','Baja de Marketing','email',''),
 ('newsletter_subscribers','Suscriptor','email,first_name,status,source,origin_channel,customer_type,phone,company,notes',''),
 ('rural_raffle_entries','Contacto de sorteo','campaign,email,phone,full_name,city,country,notes,origin_channel,customer_type,marketing_opt_in',''),
 ('site_announcements','Aviso','image_path,alt_text,valid_from,valid_until,enabled',''),
 ('commerce_admin_users','Usuario y permisos','user_id,display_name,active,access_user_id,allowed_paths,can_manage_pricing',''),
 ('commerce_categories','Categoría','code,label_es,parent_code,active,sort_order',''),
 ('commerce_attribute_definitions','Atributo','code,label_es,data_type,unit,input_style,active,sort_order',''),
 ('commerce_attribute_options','Opción','attribute_code,code,label_es,swatch_hex,active,sort_order',''),
 ('commerce_category_attributes','Regla de catálogo','category_code,attribute_code,scope,required,filterable,sort_order,purchase_selectable',''),
 ('visualizer_catalog_versions','Configuración del personalizador','version,status,document,published_by',''),
 ('visualizer_icons','Imagen del personalizador','name,storage_path,is_active',''),
 ('visualizer_hidden_builtin_icons','Visibilidad de imagen','icon_id','')
 ) as sources(table_name,entity,fields,money_fields)
 loop
   if exists(select 1 from unnest(string_to_array(r.fields,',')) field where not exists(select 1 from information_schema.columns c where c.table_schema='public' and c.table_name=r.table_name and c.column_name=field)) then
     raise exception 'Audit allowlist has unknown fields for %',r.table_name;
   end if;
   execute format('create trigger gestion_audit_change after insert or update on public.%I for each row execute function private.gestion_audit_change(%L,%L,%L)',r.table_name,r.entity,r.fields,r.money_fields);
   execute format('create trigger gestion_audit_delete before delete on public.%I for each row execute function private.gestion_audit_change(%L,%L,%L)',r.table_name,r.entity,r.fields,r.money_fields);
 end loop;
end;
$$;

create function private.gestion_audit_login() returns trigger language plpgsql security definer set search_path='' as $$
declare member public.commerce_admin_users%rowtype;
begin
 select * into member from public.commerce_admin_users where user_id=new.user_id and active;
 if found then
   insert into private.gestion_audit_events(group_id,actor_id,actor_name,access_user_id,source,entity_type,entity_id,reference,operation)
   values('login:' || new.id,new.user_id,member.display_name,member.access_user_id,'autenticacion','Acceso',new.id::text,'Inicio de sesión','LOGIN') on conflict do nothing;
 end if;
 return new;
end;
$$;
create trigger gestion_audit_login after insert on auth.sessions for each row execute function private.gestion_audit_login();

-- Preserve raw append-only evidence while presenting each entity's effective
-- before/after within an operation. Draft saves delete and reinsert all rules;
-- unchanged rules must not look like price deletions.
create view private.gestion_audit_changes as
with grouped as (
 select group_id,entity_type,entity_id,max(id) as id,max(occurred_at) as occurred_at,
  max(actor_id::text)::uuid as actor_id,max(actor_name) as actor_name,max(access_user_id) as access_user_id,
  max(source) as source,(array_agg(reference order by occurred_at desc,id desc))[1] as reference,
  (array_agg(operation order by occurred_at,id))[1] as first_operation,
  (array_agg(operation order by occurred_at desc,id desc))[1] as last_operation,
  bool_or(monetary) as money_fields,max(currency) as currency,max(value_unit) as value_unit
 from private.gestion_audit_events group by group_id,entity_type,entity_id
), field_changes as (
 select e.group_id,e.entity_type,e.entity_id,f.key,
  (array_agg(coalesce(e.before_values->f.key,'null'::jsonb) order by e.occurred_at,e.id))[1] as before_value,
  (array_agg(coalesce(e.after_values->f.key,'null'::jsonb) order by e.occurred_at desc,e.id desc))[1] as after_value
 from private.gestion_audit_events e cross join lateral unnest(e.changed_fields) f(key)
 group by e.group_id,e.entity_type,e.entity_id,f.key
), diffs as (
 select group_id,entity_type,entity_id,jsonb_object_agg(key,before_value) as before_values,
 jsonb_object_agg(key,after_value) as after_values,array_agg(key order by key) as changed_fields
 from field_changes where before_value is distinct from after_value group by group_id,entity_type,entity_id
)
select g.id,g.group_id,g.occurred_at,g.actor_id,g.actor_name,g.access_user_id,g.source,g.entity_type,g.entity_id,g.reference,
 case when first_operation='LOGIN' then 'LOGIN' when first_operation='INSERT' then 'INSERT' when last_operation='DELETE' then 'DELETE' else 'UPDATE' end as operation,
 coalesce(d.before_values,'{}') as before_values,coalesce(d.after_values,'{}') as after_values,coalesce(d.changed_fields,'{}') as changed_fields,
 (first_operation<>'INSERT' and last_operation<>'DELETE' and money_fields) as monetary,g.currency,g.value_unit
from grouped g left join diffs d using(group_id,entity_type,entity_id)
where (first_operation='LOGIN' or d.changed_fields is not null) and not(first_operation='INSERT' and last_operation='DELETE');
revoke all on private.gestion_audit_changes from public,anon,authenticated,service_role;

create function public.gestion_logs_context() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not private.gestion_logs_allowed() then return jsonb_build_object('canViewLogs',false); end if;
 return jsonb_build_object('canViewLogs',true,'activatedAt',(select activated_at from private.gestion_log_config),'users',(
   select coalesce(jsonb_agg(to_jsonb(u) order by u.name),'[]'::jsonb) from (
    select distinct on (id) id,name,"accessId" from (
     select user_id as id,display_name as name,access_user_id as "accessId",1 as rank from public.commerce_admin_users
     union all select actor_id,actor_name,access_user_id,2 from private.gestion_audit_events where actor_id is not null and access_user_id is not null
    ) x order by id,rank
   ) u));
end;
$$;

create function public.gestion_logs_list(p_users uuid[] default null,p_from timestamptz default null,p_until timestamptz default null,p_operation text default null,p_money_only boolean default false,p_search text default '',p_page integer default 0)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not private.gestion_logs_allowed() then raise exception 'No tenés acceso a Logs' using errcode='42501'; end if;
 if p_page<0 or p_page>100000 then raise exception 'Página inválida'; end if;
 with matches as (
  select * from private.gestion_audit_changes e
  where (p_users is null or e.actor_id=any(p_users)) and (p_from is null or e.occurred_at>=p_from) and (p_until is null or e.occurred_at<p_until)
   and (p_operation is null or e.operation=p_operation) and (not p_money_only or e.monetary)
   and (coalesce(p_search,'')='' or e.reference ilike '%' || left(p_search,200) || '%' or e.entity_type ilike '%' || left(p_search,200) || '%')
 ), groups as (
  select group_id,max(occurred_at) as occurred_at,max(actor_name) as actor_name,max(source) as source,
   bool_or(monetary or operation='DELETE') as attention,count(*) as event_count,
   left(string_agg(distinct reference,', '),600) as reference,array_agg(distinct operation) as operations
  from matches group by group_id
 ), page as (select * from groups order by occurred_at desc,group_id desc limit 50 offset p_page*50)
 select jsonb_build_object('total',(select count(*) from groups),'groups',coalesce(jsonb_agg(to_jsonb(page) order by occurred_at desc,group_id desc),'[]'::jsonb)) into result from page;
 return result;
end;
$$;
create function public.gestion_logs_detail(p_group text) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not private.gestion_logs_allowed() then raise exception 'No tenés acceso a Logs' using errcode='42501'; end if;
 return (select coalesce(jsonb_agg((to_jsonb(e)-'id') || jsonb_build_object('id',e.id::text) order by e.occurred_at,e.id),'[]'::jsonb) from private.gestion_audit_changes e where group_id=p_group);
end;
$$;
revoke all on function private.gestion_logs_allowed(),private.gestion_logs_immutable(),private.gestion_audit_change(),private.gestion_audit_login() from public,anon,authenticated,service_role;
revoke all on function public.gestion_logs_context(),public.gestion_logs_list(uuid[],timestamptz,timestamptz,text,boolean,text,integer),public.gestion_logs_detail(text) from public,anon,authenticated;
grant execute on function public.gestion_logs_context(),public.gestion_logs_list(uuid[],timestamptz,timestamptz,text,boolean,text,integer),public.gestion_logs_detail(text) to authenticated;
