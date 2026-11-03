-- `active` is the legacy storefront switch. A variant enabled for Local must be
-- sellable there even if it is hidden from the website. Preserve every function's
-- existing validation, authorization, and grants; replace only this predicate.
do $$
declare
  target record;
  definition text;
  occurrences integer;
begin
  for target in
    select * from (values
      ('private.check_local_sale_item_availability()', 'and variant.active and variant.available_local', 'and variant.available_local', 1),
      ('private.local_sale_items_write()', 'and variant.active and variant.available_local', 'and variant.available_local', 1),
      ('public.create_local_sale(uuid,date,text,uuid,integer,bigint)', 'and variant.active;', 'and variant.available_local;', 1),
      ('public.create_local_sale_with_items(uuid,date,text,jsonb,bigint)', 'and variant.active;', 'and variant.available_local;', 2),
      ('public.create_channel_sale_with_items(uuid,date,text,jsonb,bigint,text)', 'and variant.active;', 'and variant.available_local;', 2),
      ('public.gestion_create_local_sale_with_items(uuid,date,text,jsonb,bigint,text)', 'and variant.active;', 'and variant.available_local;', 2)
    ) as changes(signature, previous_predicate, local_predicate, expected_occurrences)
  loop
    definition := pg_get_functiondef(to_regprocedure(target.signature));
    if definition is null then
      raise exception 'Missing sale function: %', target.signature;
    end if;
    occurrences := (length(definition) - length(replace(definition, target.previous_predicate, '')))
      / length(target.previous_predicate);
    if occurrences <> target.expected_occurrences then
      raise exception 'Unexpected availability predicate in %: found %, expected %',
        target.signature, occurrences, target.expected_occurrences;
    end if;
    execute replace(definition, target.previous_predicate, target.local_predicate);
  end loop;
end;
$$;
