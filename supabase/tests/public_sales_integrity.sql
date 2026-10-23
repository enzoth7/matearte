-- Run against the isolated fixture after both sales migrations; no provider calls.
begin;
do $$
declare
 actor uuid := gen_random_uuid(); oid uuid := gen_random_uuid(); late uuid := gen_random_uuid();
 result jsonb; attempt jsonb; replay jsonb; payload jsonb; blocked boolean;
begin
 insert into auth.users values(actor);
 insert into public.commerce_admin_users values(actor,true);
 insert into public.orders(id,user_id,status,paypal_order_id,paypal_amount_usd_minor,reservation_expires_at)
 values(oid,actor,'pending_payment','ORDER',10000,now()+interval '2 hours');
 insert into public.order_items(order_id,requires_review,review_status) values(oid,true,'pending');
 update public.orders set checkout_idempotency_key=gen_random_uuid() where id=oid;
 result := public.create_paypal_international_order(actor,null,'{}','{}','{}',(select checkout_idempotency_key from public.orders where id=oid),0,200,null,99::numeric);
 assert (result->>'paypalAmountUsdMinor')::bigint=10000,'Retry changed historical USD quote';
 payload := '{"resource":{"amount":{"currency_code":"USD"}}}';
 result := public.process_paypal_payment('evt1','PAYMENT.CAPTURE.COMPLETED','ORDER','CAPTURE',10000,payload);
 assert result->>'manualReview'='false','Normal payment requires no manual review';
 assert (select status='paid_pending_review' from public.orders where id=oid),'Paid design review';
 perform public.process_paypal_payment('evt1','PAYMENT.CAPTURE.COMPLETED','ORDER','CAPTURE',10000,payload);
 perform public.process_paypal_payment('evt2','PAYMENT.CAPTURE.COMPLETED','ORDER','CAPTURE',10000,payload);
 assert (select count(*)=1 from public.commerce_payments where order_id=oid),'Duplicate capture created money';
 attempt := public.begin_commerce_order_review(oid,'reject','No es fabricable',actor);
 replay := public.begin_commerce_order_review(oid,'reject','No es fabricable',actor);
 assert attempt->>'dispatch'='true' and replay->>'dispatch'='false','Refund dispatch must happen once';
 assert attempt->>'id'=replay->>'id','Stable idempotency key';
 blocked := false;
 begin perform public.begin_commerce_order_review(oid,'approve','',actor);
 exception when others then blocked := true; end;
 assert blocked,'Approval raced refund';
 blocked := false;
 begin update public.orders set status='ready_for_production' where id=oid;
 exception when others then blocked := true; end;
 assert blocked,'Old client bypassed refund guard';
 perform public.finish_commerce_refund((attempt->>'id')::uuid,false,'REFUND','{"status":"PENDING"}');
 assert (select status='manual_review' from public.orders where id=oid),'Pending refund marked completed';
 payload := '{"resource":{"status":"COMPLETED","amount":{"currency_code":"USD"}}}';
 perform public.process_paypal_refund('r1','CAPTURE','PARTIAL',3000,payload);
 assert (select status='manual_review' from public.orders where id=oid),'Partial refund marked full';
 perform public.process_paypal_refund('r2','CAPTURE','REST',7000,payload);
 perform public.process_paypal_refund('r3','CAPTURE','REST',7000,payload);
 assert (select status='refunded' from public.orders where id=oid),'Full refund not reconciled';
 perform public.process_paypal_payment('evt3','PAYMENT.CAPTURE.COMPLETED','ORDER','CAPTURE',10000,payload);
 assert (select status='refunded' from public.commerce_payments where order_id=oid),'Late capture resurrected refund';
 assert (select count(*)=2 from private.commerce_paypal_refunds),'Duplicate refund counted';

 insert into public.orders(id,user_id,status,paypal_order_id,paypal_amount_usd_minor,reservation_expires_at)
 values(late,actor,'pending_payment','LATE',10000,now()-interval '1 day');
 perform public.expire_pending_commerce_orders();
 assert (select status='cancelled' from public.orders where id=late),'Expiry lost correlation';
 result := public.process_paypal_payment('late1','PAYMENT.CAPTURE.COMPLETED','LATE','LATECAP',10000,payload);
 assert result->>'manualReview'='true','Late payment must be reviewed';
 assert (select paid_at is not null from public.orders where id=late),'Late money missing';
 blocked := false;
 begin perform public.process_paypal_payment('wrong','PAYMENT.CAPTURE.COMPLETED','LATE','WRONG',10000,'{"resource":{"amount":{"currency_code":"EUR"}}}');
 exception when others then blocked := true; end;
 assert blocked,'Unexpected currency accepted';
 assert not has_function_privilege('anon','public.begin_commerce_order_review(uuid,text,text,uuid)','execute'),'Anonymous review';
 assert not has_function_privilege('authenticated','public.process_paypal_payment(text,text,text,text,bigint,jsonb)','execute'),'Buyer can forge payment';
 assert not has_table_privilege('authenticated','public.design_assets','insert'),'Buyer can forge asset metadata';
end;
$$;
set local role authenticated;
insert into storage.objects(bucket_id,name) values('design-previews','owned/preview.png');
do $$ declare blocked boolean := false; begin
 begin insert into storage.objects(bucket_id,name) values('design-assets','owned/unsafe.svg');
 exception when insufficient_privilege then blocked := true; end;
 assert blocked,'Direct upload bypassed sanitization';
 blocked := false;
 begin update storage.objects set bucket_id='design-assets';
 exception when insufficient_privilege then blocked := true; end;
 assert blocked,'Storage move bypassed sanitization';
end $$;
reset role;
rollback;
