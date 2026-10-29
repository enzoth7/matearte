-- Run with psql -v ON_ERROR_STOP=1 against an isolated test database. All rows roll back.
begin;
create function pg_temp.check_amount(actual bigint, expected bigint, message text) returns void language plpgsql as $$
begin if actual is distinct from expected then raise exception '%: expected %, got %',message,expected,actual; end if; end;
$$;
create function pg_temp.expect_error(statement text, expected text) returns void language plpgsql as $$
begin
  begin execute statement;
  exception when others then
    if position(expected in sqlerrm)>0 then return; end if;
    raise exception 'Expected %, got %',expected,sqlerrm;
  end;
  raise exception 'Expected failure: %',expected;
end;
$$;
insert into auth.users(id,email) values ('71000000-0000-4000-8000-000000000001','scope-test@matearte.invalid');
insert into public.commerce_categories(code,label_es) values ('mates','Mates'),('personalizados','Personalizados'),('bombillas','Bombillas') on conflict do nothing;
insert into public.commerce_discounts(id,code,discount_type,value,valid_from,valid_until,applicability,category_codes)
values ('72000000-0000-4000-8000-000000000001','SCOPE-TEST','percentage',10,current_date-1,current_date+1,'categories',array['mates']);

do $$
declare
  u uuid := '71000000-0000-4000-8000-000000000001';
  d uuid := '72000000-0000-4000-8000-000000000001';
  totals jsonb := '{"mates":100000,"personalizados":200000}';
  result jsonb;
begin
  result := public.validate_commerce_discount_scoped(u,' scope-test ',600000,300000,totals);
  perform pg_temp.check_amount((result->>'discountMinor')::bigint,10000,'mates only');
  update public.commerce_discounts set category_codes=array['personalizados'] where id=d;
  result := public.validate_commerce_discount_scoped(u,'SCOPE-TEST',600000,300000,totals);
  perform pg_temp.check_amount((result->>'discountMinor')::bigint,20000,'catalog personalizados only');
  update public.commerce_discounts set category_codes='{}',include_design_items=true where id=d;
  result := public.validate_commerce_discount_scoped(u,'SCOPE-TEST',600000,300000,totals);
  perform pg_temp.check_amount((result->>'discountMinor')::bigint,30000,'personalizer designs only');
  update public.commerce_discounts set category_codes=array['personalizados'] where id=d;
  result := public.validate_commerce_discount_scoped(u,'SCOPE-TEST',600000,300000,totals);
  perform pg_temp.check_amount((result->>'discountMinor')::bigint,50000,'both kinds of personalizados');
  update public.commerce_discounts set applicability='all_items' where id=d;
  result := public.validate_commerce_discount_scoped(u,'SCOPE-TEST',600000,300000,totals);
  perform pg_temp.check_amount((result->>'discountMinor')::bigint,60000,'all items');
  result := public.validate_commerce_discount(u,'SCOPE-TEST',600000,300000);
  perform pg_temp.check_amount((result->>'discountMinor')::bigint,60000,'old client global coupon');
  update public.commerce_discounts set applicability='design_items' where id=d;
  result := public.validate_commerce_discount(u,'SCOPE-TEST',600000,300000);
  perform pg_temp.check_amount((result->>'discountMinor')::bigint,30000,'old client birthday coupon');
  update public.commerce_discounts set applicability='categories',category_codes=array[' MATES ','mates'] where id=d;
  perform pg_temp.check_amount((select cardinality(category_codes)::bigint from public.commerce_discounts where id=d),1,'normalize category codes');
  update public.commerce_discounts set discount_type='fixed',value=50000 where id=d;
  result := public.validate_commerce_discount_scoped(u,'SCOPE-TEST',600000,300000,totals);
  perform pg_temp.check_amount((result->>'discountMinor')::bigint,50000,'fixed amount on eligible subtotal');
end;
$$;

select pg_temp.expect_error($q$select public.validate_commerce_discount('71000000-0000-4000-8000-000000000001','SCOPE-TEST',600000,300000)$q$,'discount:not_applicable');
select pg_temp.expect_error($q$select public.validate_commerce_discount_scoped('71000000-0000-4000-8000-000000000001','SCOPE-TEST',600000,300000,'{"bombillas":300000}')$q$,'discount:not_applicable');
select pg_temp.expect_error($q$select public.validate_commerce_discount_scoped('71000000-0000-4000-8000-000000000001','SCOPE-TEST',600000,300000,'{"mates":300001}')$q$,'discount:invalid');
select pg_temp.expect_error($q$select public.validate_commerce_discount_scoped('71000000-0000-4000-8000-000000000001','SCOPE-TEST',600000,300000,'{"mates":-1}')$q$,'discount:invalid');
select pg_temp.expect_error($q$select public.validate_commerce_discount_scoped(null,'SCOPE-TEST',600000,300000,'{"mates":300000}')$q$,'discount:unauthorized');
select pg_temp.expect_error($q$update public.commerce_discounts set category_codes=array['missing-category'] where code='SCOPE-TEST'$q$,'discount:invalid_category');
select pg_temp.expect_error($q$update public.commerce_discounts set category_codes='{}' where code='SCOPE-TEST'$q$,'commerce_discounts_categories_check');
update public.commerce_discounts set value=150000 where code='SCOPE-TEST';
select pg_temp.expect_error($q$select public.validate_commerce_discount_scoped('71000000-0000-4000-8000-000000000001','SCOPE-TEST',600000,300000,'{"mates":100000,"personalizados":200000}')$q$,'discount:not_applicable');
update public.commerce_discounts set discount_type='percentage',value=10,enabled=false where code='SCOPE-TEST';
select pg_temp.expect_error($q$select public.validate_commerce_discount_scoped('71000000-0000-4000-8000-000000000001','SCOPE-TEST',600000,300000,'{"mates":300000}')$q$,'discount:disabled');
update public.commerce_discounts set enabled=true,owner_user_id='71000000-0000-4000-8000-000000000001',redemption_limit=1 where code='SCOPE-TEST';
select pg_temp.expect_error($q$select public.validate_commerce_discount_scoped('71000000-0000-4000-8000-000000000002','SCOPE-TEST',600000,300000,'{"mates":300000}')$q$,'discount:not_found');
update public.commerce_discounts set owner_user_id=null,redemption_limit=null,welcome_only=true where code='SCOPE-TEST';
select pg_temp.expect_error($q$select public.validate_commerce_discount_scoped('71000000-0000-4000-8000-000000000001','SCOPE-TEST',600000,300000,'{"mates":300000}')$q$,'discount:not_subscribed');
update public.commerce_discounts set welcome_only=false where code='SCOPE-TEST';

do $$
declare
  u uuid := '71000000-0000-4000-8000-000000000001';
  totals jsonb := '{"mates":100000,"personalizados":200000}';
  k uuid := '73000000-0000-4000-8000-000000000001';
  result jsonb;
begin
  result := public.reserve_commerce_discount_scoped(u,'SCOPE-TEST',600000,300000,k,now()+interval '1 hour',totals);
  perform pg_temp.check_amount((result->>'discountMinor')::bigint,10000,'first checkout reservation');
  update public.commerce_discounts set category_codes=array['personalizados'] where code='SCOPE-TEST';
  result := public.reserve_commerce_discount_scoped(u,'SCOPE-TEST',600000,300000,k,now()+interval '1 hour',totals);
  perform pg_temp.check_amount((result->>'discountMinor')::bigint,10000,'retry preserves quote after category edit');
  result := public.reserve_commerce_discount_scoped(u,'SCOPE-TEST',600000,300000,'73000000-0000-4000-8000-000000000002',now()+interval '1 hour',totals);
  perform pg_temp.check_amount((result->>'discountMinor')::bigint,20000,'new checkout uses edited scope');
end;
$$;
select pg_temp.expect_error($q$select public.reserve_commerce_discount_scoped('71000000-0000-4000-8000-000000000001','SCOPE-TEST',600000,300000,'73000000-0000-4000-8000-000000000001',now()+interval '1 hour','{"mates":200000,"personalizados":100000}')$q$,'discount:invalid_reservation');

-- The immutable order snapshot must preserve the separation too.
insert into public.orders(id,user_id,checkout_idempotency_key,order_number,status,items_subtotal_minor,shipping_minor,payment_fee_minor,total_minor,discount_minor,reservation_expires_at)
values ('74000000-0000-4000-8000-000000000001','71000000-0000-4000-8000-000000000001','73000000-0000-4000-8000-000000000003',1,'pending_payment',600000,50000,0,650000,0,now()+interval '1 hour');
insert into public.order_items(order_id,item_type,total_minor,immutable_snapshot) values
('74000000-0000-4000-8000-000000000001','catalog',100000,'{"product":{"category_code":"mates"}}'),
('74000000-0000-4000-8000-000000000001','catalog',200000,'{"product":{"category":"personalizados"}}'),
('74000000-0000-4000-8000-000000000001','design',300000,'{}');
select pg_temp.check_amount((private.order_discount_category_subtotals('74000000-0000-4000-8000-000000000001')->>'personalizados')::bigint,200000,'PayPal snapshots catalog category');
select pg_temp.check_amount((select sum(value::bigint)::bigint from jsonb_each_text(private.order_discount_category_subtotals('74000000-0000-4000-8000-000000000001'))),300000,'PayPal snapshots exclude designs');

select pg_temp.check_amount(has_function_privilege('authenticated','public.validate_commerce_discount_scoped(uuid,text,bigint,bigint,jsonb)','execute')::int::bigint,0,'customers cannot forge category totals');
select pg_temp.check_amount(has_function_privilege('service_role','public.reserve_commerce_discount_scoped(uuid,text,bigint,bigint,uuid,timestamptz,jsonb)','execute')::int::bigint,1,'server can reserve coupons');
rollback;
