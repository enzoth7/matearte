-- Run after original lifecycle tests and the base-prices migration in a disposable DB.
do $$
declare u uuid:=gen_random_uuid(); c uuid; p uuid:=gen_random_uuid(); v uuid:=gen_random_uuid(); o uuid; first_order uuid; k uuid:=gen_random_uuid();
 cust jsonb:='{"fullName":"Test","phone":"Test","countryCode":"AR","department":"Test","city":"Test","postalCode":"1000","address":"Test"}';
begin
 update commerce_argentina_settings set enabled=true;
 update settings set exchange_rate=1;
 insert into commerce_products values(p,'Test rounding',true,'mates','mates');
 insert into commerce_variants(id,product_id,active,available_web,price_minor,base_price_minor,sku,name,option_values) values(v,p,true,true,680200,673300,'ROUND','Test','{}');
 c:=gen_random_uuid(); insert into carts values(c,u,'active');
 insert into cart_items values(gen_random_uuid(),c,'catalog',v,null,2,'{}');
 o:=(create_argentina_retail_order(u,c,cust,'{}',k)->>'id')::uuid; first_order:=o;
 if not exists(select 1 from orders where id=o and total_minor=1350000 and customer_snapshot->>'arsUseBasePrice'='true') then raise exception 'Base price / rounding failed'; end if;
 update commerce_settings set ars_use_base_price=false;
 perform create_argentina_retail_order(u,c,cust,'{}',k);
 if not exists(select 1 from orders where id=first_order and total_minor=1350000) then raise exception 'Existing order changed'; end if;
 c:=gen_random_uuid(); insert into carts values(c,u,'active');
 insert into cart_items values(gen_random_uuid(),c,'catalog',v,null,1,'{}');
 o:=(create_argentina_retail_order(u,c,cust,'{}',gen_random_uuid())->>'id')::uuid;
 if not exists(select 1 from orders where id=o and total_minor=680000 and customer_snapshot->>'arsUseBasePrice'='false') then raise exception 'Adjusted price / rounding failed'; end if;
end $$;
