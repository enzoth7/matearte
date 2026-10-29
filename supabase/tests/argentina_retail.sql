-- Run after argentina_retail_fixture.sql and the argentina_retail_transfer migration in a disposable database.
set client_min_messages=warning;
do $$
declare u uuid:=gen_random_uuid(); a uuid:=gen_random_uuid(); c uuid:=gen_random_uuid(); p uuid:=gen_random_uuid(); v uuid:=gen_random_uuid(); k uuid:=gen_random_uuid(); o uuid; c2 uuid:=gen_random_uuid(); o2 uuid; r uuid:=gen_random_uuid(); r2 uuid:=gen_random_uuid(); result jsonb; cust jsonb:=jsonb_build_object('fullName','Test Buyer','phone','+541111111111','countryCode','AR','department','Buenos Aires','city','Test','postalCode','1000','address','Test 123');
begin
 if has_function_privilege('anon','public.create_argentina_retail_order(uuid,uuid,jsonb,jsonb,uuid)','EXECUTE') or has_function_privilege('authenticated','public.submit_argentina_receipt(uuid,uuid,uuid,text,text,text,bigint)','EXECUTE') then raise exception 'Unsafe function grants'; end if;
 insert into commerce_settings values(true,true,true,10,10,array['mates']);
 insert into commerce_admin_users values(a,true);
 insert into carts values(c,u,'active');
 insert into commerce_products values(p,'Test mate',true,'mates','mates');
 insert into commerce_variants values(v,p,true,true,12345,'TEST','Test','{}');
 insert into cart_items values(gen_random_uuid(),c,'catalog',v,null,2,'{}');
 begin
  perform create_argentina_retail_order(u,c,cust,'{}',k);
  raise exception 'TEST FAILED: disabled checkout accepted';
 exception when raise_exception then if sqlerrm like 'TEST FAILED:%' then raise; end if; end;
 update commerce_argentina_settings set enabled=true,bank_name='Test Bank',account_holder='Test Holder',cbu='0000000000000000000000',alias='test.only';
 begin
  perform create_argentina_retail_order(u,c,cust,'{}',k);
  raise exception 'TEST FAILED: missing finance rate accepted';
 exception when raise_exception then if sqlerrm like 'TEST FAILED:%' then raise; end if; end;
 insert into settings values(1,0.04);
 result:=create_argentina_retail_order(u,c,cust,'{}',k); o:=(result->>'id')::uuid;
 if not exists(select 1 from orders where id=o and currency='ARS' and total_minor=617200 and shipping_minor=0 and status='pending_payment') then raise exception 'Wrong quote'; end if;
 update settings set exchange_rate=0.01 where id=1;
 result:=create_argentina_retail_order(u,c,cust,'{}',k);
 if (result->>'id')::uuid<>o or not exists(select 1 from orders where id=o and total_minor=617200 and (customer_snapshot->>'arsPerUyu')::numeric=25) then raise exception 'Quote not frozen'; end if;
 insert into carts values(c2,u,'active');
 insert into cart_items values(gen_random_uuid(),c2,'catalog',v,null,2,'{}');
 result:=create_argentina_retail_order(u,c2,cust,'{}',gen_random_uuid()); o2:=(result->>'id')::uuid;
 if not exists(select 1 from orders where id=o2 and total_minor=2469000 and (customer_snapshot->>'arsPerUyu')::numeric=100) then raise exception 'New quote did not use finance rate'; end if;

 begin
  perform submit_argentina_receipt(a,o,r,a||'/'||o||'/a.pdf','a.pdf','application/pdf',100);
  raise exception 'TEST FAILED: foreign user accepted';
 exception when raise_exception then if sqlerrm like 'TEST FAILED:%' then raise; end if; end;
 perform submit_argentina_receipt(u,o,r,u||'/'||o||'/a.pdf','a.pdf','application/pdf',100);
 perform submit_argentina_receipt(u,o,r,u||'/'||o||'/a.pdf','a.pdf','application/pdf',100);
 if (select count(*) from commerce_bank_transfer_receipts where order_id=o)<>1 then raise exception 'Duplicate receipt'; end if;
 perform review_argentina_transfer(a,o,'reject','Comprobante incorrecto');
 if (select status from orders where id=o)<>'payment_failed' then raise exception 'Rejection cancelled order'; end if;
 perform submit_argentina_receipt(u,o,r2,u||'/'||o||'/b.pdf','b.pdf','application/pdf',100);
 perform review_argentina_transfer(a,o,'approve');
 if not exists(select 1 from commerce_payments where order_id=o and currency='ARS' and amount_minor=617200) then raise exception 'Wrong payment currency'; end if;
 if (select status from orders where id=o)<>'ready_for_fulfillment' then raise exception 'Wrong approved status'; end if;
 begin
  perform review_argentina_transfer(a,o,'approve');
  raise exception 'TEST FAILED: approved twice';
 exception when raise_exception then if sqlerrm like 'TEST FAILED:%' then raise; end if; end;
 if (select count(*) from commerce_payments where order_id=o)<>1 then raise exception 'Duplicate payment'; end if;
 raise notice 'Lifecycle assertions passed';
end $$;
set role anon;
select case when count(*)=1 then 'PASS: enabled settings visible to anon' else 'FAIL' end from commerce_argentina_settings;
reset role;
update commerce_argentina_settings set enabled=false;
set role anon;
select case when count(*)=0 then 'PASS: disabled settings hidden from anon' else 'FAIL' end from commerce_argentina_settings;
reset role;
set role authenticated;
set test.admin='no';
update commerce_argentina_settings set enabled=true;
reset role;
select case when not enabled then 'PASS: customer cannot change settings' else 'FAIL' end from commerce_argentina_settings;
