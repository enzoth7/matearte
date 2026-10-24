-- Isolated fixture + migration, then this test. All test data rolls back.
drop trigger if exists local_sale_items_write on local_sale_items;
create trigger local_sale_items_write instead of insert or update or delete on local_sale_items for each row execute function private.local_sale_items_write();
begin;
select set_config('app.staff','true',true);
do $test$
declare
 a jsonb := '{"tipo-mate":"imperial","interior":"ceramica","tipo-cuero":"croco","color":"mostaza-chocolate","tipo-virola":"alpaca-y-bronce","diseno-fleje":"laureles","posamate":"con-posamate","pie":"alpaca","tamano":"grande"}';
 design jsonb := '{"configuration":{"engravingTypeId":"laser","rim":{"textMode":"text","texts":[{"text":"ENZO"}],"imageMode":"image","icons":[{"selectedImageId":"corazon"}]}}}';
 q jsonb; result jsonb; payload jsonb; failed boolean; sale_uuid uuid; old_price bigint; f jsonb; o jsonb;
begin
 q:=gestion_quote_mate_assembly(a,design);
 assert (q->>'baseMinor')::bigint=450000,'Base differs from the frontend';
 assert (q->'baseItems')::text not like '%assembly:color:%','Color must not have a price line';
 assert (gestion_quote_mate_assembly(a||'{"color":"negro"}', '{}')->>'baseMinor')::bigint=450000,'Color changed the base price';
 assert (q->>'extrasMinor')::bigint=30000,'Laser must be charged once for text and icon';
 assert (q->>'totalMinor')::bigint=480000;
 assert (gestion_quote_mate_assembly(a||'{"tipo-cuero":"crudo"}', '{}')->>'baseMinor')::bigint=425000,'Posamate double charge';
 assert (gestion_quote_mate_assembly(a||'{"tipo-mate":"criollo","forma-criollo":"imperial"}', '{}')->>'baseMinor')::bigint=370000,'Criollo posamate double charge';
 for f in select v from jsonb_array_elements(get_mate_assembly_fields()) v loop
   if f->>'code' in ('tipo-mate','forma-criollo') then continue; end if;
   for o in select v from jsonb_array_elements(f->'options') v loop
     perform gestion_quote_mate_assembly(a||jsonb_build_object(f->>'code',o->>'value'),'{}');
   end loop;
 end loop;
 payload:=jsonb_build_object('item_kind','custom_mate','variant_id',null,'quantity',2,'unit_price_minor',480000,'customization',design||jsonb_build_object('assembly',jsonb_build_object('schemaVersion',1,'selections',a),'localPricing',jsonb_build_object('versionId',q->>'versionId')));
 result:=gestion_create_local_sale_with_items(null,current_date,'Efectivo',jsonb_build_array(payload),null,'Local');
 sale_uuid:=(result->>'id')::uuid;
 assert (select total_minor=960000 and sku is null and source_variant_id is null and item_type='design' and immutable_snapshot->'assembly'->'selections'=a from order_items where order_id=sale_uuid),'Saved assembly lost data';
 assert (select count(*)=0 from commerce_variants),'Must not create a catalog variant';
 failed:=false;
 begin perform gestion_create_local_sale_with_items(null,current_date,'Efectivo',jsonb_build_array(payload||'{"unit_price_minor":1}'),null,'Local'); exception when sqlstate '22023' then failed:=true; end;
 assert failed,'Tampered price accepted';
 failed:=false;
 begin perform gestion_quote_mate_assembly(a||'{"pie":"inventado"}',design); exception when sqlstate '22023' then failed:=true; end;
 assert failed,'Unknown option accepted';
 failed:=false;
 begin perform gestion_quote_mate_assembly(a||'{"tipo-virola":"sin-virola"}',design); exception when sqlstate '22023' then failed:=true; end;
 assert failed,'Engraving without rim accepted';
 update pricing_catalog_values set value=3000 where rule_key='family:imperial' and version_id=(q->>'versionId')::uuid;
 assert (select unit_price_minor=480000 from order_items where order_id=sale_uuid),'Historical price changed';
 assert (select value=2600 from pricing_catalog_values where rule_key='family:imperial' and version_id=(select id from pricing_catalog_versions where version=1)),'Archived prices changed';
 failed:=false;
 begin perform gestion_create_local_sale_with_items(null,current_date,'Efectivo',jsonb_build_array(payload),null,'Local'); exception when sqlstate '22023' then failed:=true; end;
 assert failed,'Outdated quote accepted';
 perform set_config('app.staff','false',true);
 failed:=false;
 begin perform gestion_quote_mate_assembly(a,design); exception when insufficient_privilege then failed:=true; end;
 assert failed,'Non staff quoted an assembly';
 raise notice 'PASS: all pieces, independent save, laser, posamate, historical pricing and invalid input';
end $test$;
rollback;
