-- Run only in an isolated database with fixtures/gestion_audit_schema.sql and
-- 20261105182846_gestion_private_audit_logs.sql loaded. All test data rolls back.
begin;
insert into public.commerce_admin_users(user_id,display_name,access_user_id,active) values
 ('deeec8ea-ace6-4f0a-a578-17751a83f707','Enzo Thome','t1',true),
 ('5afbc94d-aecf-44e8-b12e-e136f49abb62','Richard Ortiz','t1',true),
 ('e3320318-091a-4a36-be72-3964e1e36fef','Florencia Costa','t2',true),
 ('578f5e77-403c-4b60-a736-b7692f2d348f','Florencia Pizzorno','t3',true),
 ('e9955dff-0bae-4bdb-b58e-f142c92b7e75','Marketing','t5',true),
 ('00000000-0000-0000-0000-000000000001','Otra dirección','t1',true);
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','e3320318-091a-4a36-be72-3964e1e36fef',true);
-- Forged browser headers must never impersonate a director.
select set_config('request.headers','{"x-gestion-actor-id":"deeec8ea-ace6-4f0a-a578-17751a83f707","x-gestion-operation-id":"00000000-0000-0000-0000-000000000003"}',true);
insert into public.orders(id,reference_code,order_number,channel,deposit_minor,total_minor,currency,status) values
 ('00000000-0000-0000-0000-000000000004','#R004',4,'Instagram',199500,199500,'UYU','internal_completed'),
 ('00000000-0000-0000-0000-000000000006','#R006',6,'Local',75000,75000,'UYU','internal_completed');
insert into public.order_items(id,order_id,title,quantity,unit_price_minor,total_minor) values
 ('10000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000004','Mate Imperial',1,405000,405000),
 ('10000000-0000-0000-0000-000000000006','00000000-0000-0000-0000-000000000006','Bombillon',1,160000,160000);
select set_config('request.jwt.claim.role','service_role',true);
select set_config('request.jwt.claim.sub','',true);
select set_config('request.headers','{"x-gestion-actor-id":"e3320318-091a-4a36-be72-3964e1e36fef","x-gestion-operation-id":"00000000-0000-0000-0000-000000000004"}',true);
update public.order_items set unit_price_minor=399000,total_minor=399000 where id='10000000-0000-0000-0000-000000000004';
update public.order_items set unit_price_minor=150000,total_minor=150000 where id='10000000-0000-0000-0000-000000000006';
insert into public.local_sale_receipts(id,sale_id,amount_minor,payment_method,paid_on) values
 ('20000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000004',199500,'Transferencia','2026-11-05');
do $$
declare n bigint; e private.gestion_audit_events%rowtype;
begin
 select * into strict e from private.gestion_audit_events where entity_id='10000000-0000-0000-0000-000000000004' and operation='UPDATE';
 if e.before_values->>'unit_price_minor'<>'405000' or e.after_values->>'unit_price_minor'<>'399000' or not e.monetary or e.actor_name<>'Florencia Costa' or e.reference not like '#R004:%' or e.group_id<>'request:00000000-0000-0000-0000-000000000004' then raise exception 'Price audit or actor attribution failed'; end if;
 select * into strict e from private.gestion_audit_events where entity_id='10000000-0000-0000-0000-000000000006' and operation='UPDATE';
 if (e.after_values->>'total_minor')::bigint-(e.before_values->>'total_minor')::bigint<>-10000 then raise exception 'R006 delta failed'; end if;
 if exists(select 1 from private.gestion_audit_events where entity_type='Pedido' and operation='INSERT' and (actor_name<>'Florencia Costa' or group_id like 'request:%')) then raise exception 'Forged browser actor accepted'; end if;
 select count(*) into n from private.gestion_audit_events;
 update public.orders set updated_at=now() where id='00000000-0000-0000-0000-000000000004';
 if (select count(*) from private.gestion_audit_events)<>n then raise exception 'Timestamp-only noise'; end if;
 begin
   update public.order_items set unit_price_minor=1 where id='10000000-0000-0000-0000-000000000004';
   raise exception 'rollback fixture';
 exception when raise_exception then null;
 end;
 if (select count(*) from private.gestion_audit_events)<>n then raise exception 'Rolled-back mutation left an event'; end if;
end;
$$;
-- Service attribution is checked against the verified employee membership.
select set_config('request.jwt.claim.role','service_role',true);
select set_config('request.jwt.claim.sub','',true);
select set_config('request.headers','{"x-gestion-actor-id":"e9955dff-0bae-4bdb-b58e-f142c92b7e75","x-gestion-operation-id":"00000000-0000-0000-0000-000000000007"}',true);
insert into public.marketing_campaigns(id,subject,status) values('30000000-0000-0000-0000-000000000001','Campaña de prueba','draft');
update public.marketing_campaigns set subject='Campaña modificada' where id='30000000-0000-0000-0000-000000000001';
insert into public.commerce_discounts(id,code,discount_type,value,enabled) values('40000000-0000-0000-0000-000000000001','TESTLOG','percentage',10,true);
update public.commerce_discounts set value=15 where code='TESTLOG';
do $$ begin
 if (select count(*) from private.gestion_audit_events where group_id='request:00000000-0000-0000-0000-000000000007' and actor_name='Marketing')<>4 then raise exception 'Service grouping failed'; end if;
end; $$;
-- One event per session creation. Refreshing a session does not log in again.
insert into auth.sessions(id,user_id) values('50000000-0000-0000-0000-000000000001','e9955dff-0bae-4bdb-b58e-f142c92b7e75');
update auth.sessions set created_at=now() where id='50000000-0000-0000-0000-000000000001';
delete from auth.sessions where id='50000000-0000-0000-0000-000000000001';
do $$ begin
 if (select count(*) from private.gestion_audit_events where operation='LOGIN')<>1 then raise exception 'Login dedup failed'; end if;
end; $$;
-- Parent and child references survive cascading deletion.
delete from public.orders where id='00000000-0000-0000-0000-000000000006';
update public.commerce_admin_users set display_name='Nombre cambiado' where access_user_id='t2';
do $$ begin
 if not exists(select 1 from private.gestion_audit_events where entity_id='10000000-0000-0000-0000-000000000006' and operation='DELETE' and reference like '#R006:%') then raise exception 'Deleted order reference lost'; end if;
 if not exists(select 1 from private.gestion_audit_events where actor_name='Florencia Costa' and operation='UPDATE') then raise exception 'Historical name lost'; end if;
 begin update private.gestion_audit_events set actor_name='Changed'; raise exception 'Immutable update allowed'; exception when insufficient_privilege then null; end;
 begin delete from private.gestion_audit_events; raise exception 'Immutable delete allowed'; exception when insufficient_privilege then null; end;
 begin truncate private.gestion_audit_events; raise exception 'Immutable truncate allowed'; exception when insufficient_privilege then null; end;
end; $$;
-- Versioned price drafts replace their rows. The display must compare values,
-- suppress unchanged rules, and compare a publication with the prior catalog.
select set_config('request.headers','{"x-gestion-actor-id":"578f5e77-403c-4b60-a736-b7692f2d348f","x-gestion-operation-id":"00000000-0000-0000-0000-000000000010"}',true);
insert into public.pricing_rule_definitions(rule_key,label,value_kind) values('family:imperial','Imperial','uyu'),('leather:pelos','Pelos','uyu');
insert into public.pricing_catalog_versions(id,version,status,published_at) values
 ('60000000-0000-0000-0000-000000000001',1,'published',now()-interval '1 day'),
 ('60000000-0000-0000-0000-000000000002',2,'draft',null);
insert into public.pricing_catalog_values(version_id,rule_key,value) values
 ('60000000-0000-0000-0000-000000000001','family:imperial',3000),
 ('60000000-0000-0000-0000-000000000002','family:imperial',2950),
 ('60000000-0000-0000-0000-000000000002','leather:pelos',700);
select set_config('request.headers','{"x-gestion-actor-id":"578f5e77-403c-4b60-a736-b7692f2d348f","x-gestion-operation-id":"00000000-0000-0000-0000-000000000011"}',true);
delete from public.pricing_catalog_values where version_id='60000000-0000-0000-0000-000000000002';
insert into public.pricing_catalog_values(version_id,rule_key,value) values
 ('60000000-0000-0000-0000-000000000002','family:imperial',2900),
 ('60000000-0000-0000-0000-000000000002','leather:pelos',700);
do $$ declare e record; begin
 select * into strict e from private.gestion_audit_changes where group_id='request:00000000-0000-0000-0000-000000000011';
 if e.operation<>'UPDATE' or not e.monetary or (e.before_values->>'value')::numeric<>2950 or (e.after_values->>'value')::numeric<>2900 then raise exception 'Draft effective diff failed'; end if;
end; $$;
select set_config('request.headers','{"x-gestion-actor-id":"578f5e77-403c-4b60-a736-b7692f2d348f","x-gestion-operation-id":"00000000-0000-0000-0000-000000000012"}',true);
update public.pricing_catalog_versions set status='archived' where version=1;
update public.pricing_catalog_versions set status='published',published_at=now() where version=2;
do $$ begin
 if not exists(select 1 from private.gestion_audit_changes where entity_type='Precio publicado del personalizador' and group_id='request:00000000-0000-0000-0000-000000000012' and (before_values->>'value')::numeric=3000 and (after_values->>'value')::numeric=2900 and value_unit='UYU') then raise exception 'Published catalog comparison failed'; end if;
end; $$;
-- Real database role checks, including a third account with the same t1 profile.
set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
do $$ declare uid text; begin
 foreach uid in array array['e3320318-091a-4a36-be72-3964e1e36fef','578f5e77-403c-4b60-a736-b7692f2d348f','e9955dff-0bae-4bdb-b58e-f142c92b7e75','00000000-0000-0000-0000-000000000001'] loop
   perform set_config('request.jwt.claim.sub',uid,true);
   if public.gestion_logs_context()->>'canViewLogs'<>'false' then raise exception 'Unexpected viewer'; end if;
   begin perform public.gestion_logs_list(); raise exception 'Unauthorized list allowed'; exception when insufficient_privilege then null; end;
   begin perform public.gestion_logs_detail('anything'); raise exception 'Unauthorized detail allowed'; exception when insufficient_privilege then null; end;
   begin perform count(*) from private.gestion_audit_events; raise exception 'Direct read allowed'; exception when insufficient_privilege then null; end;
 end loop;
 foreach uid in array array['deeec8ea-ace6-4f0a-a578-17751a83f707','5afbc94d-aecf-44e8-b12e-e136f49abb62'] loop
   perform set_config('request.jwt.claim.sub',uid,true);
   if public.gestion_logs_context()->>'canViewLogs'<>'true' then raise exception 'Reader rejected'; end if;
   if (public.gestion_logs_list(p_money_only=>true,p_search=>'R004')->>'total')::integer<>1 then raise exception 'Search or monetary filter failed'; end if;
   if (public.gestion_logs_list(p_users=>array['e9955dff-0bae-4bdb-b58e-f142c92b7e75'::uuid],p_operation=>'LOGIN')->>'total')::integer<>1 then raise exception 'Login filter failed'; end if;
   if jsonb_array_length(public.gestion_logs_list(p_page=>1)->'groups')<>0 then raise exception 'Pagination failed'; end if;
   begin insert into private.gestion_audit_events(group_id,actor_name,source,entity_type,entity_id,reference,operation) values('fake','fake','fake','fake','fake','fake','INSERT'); raise exception 'Direct insert allowed'; exception when insufficient_privilege then null; end;
 end loop;
end; $$;
reset role;
update public.commerce_admin_users set active=false where user_id='5afbc94d-aecf-44e8-b12e-e136f49abb62';
select set_config('request.jwt.claim.sub','5afbc94d-aecf-44e8-b12e-e136f49abb62',true);
do $$ begin if public.gestion_logs_context()->>'canViewLogs'<>'false' then raise exception 'Inactive reader allowed'; end if; end; $$;
rollback;
