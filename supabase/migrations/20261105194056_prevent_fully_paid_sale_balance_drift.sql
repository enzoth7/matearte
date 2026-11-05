-- A sale without a deposit was recorded as paid in full. Its original payment
-- cannot silently become a partial payment when article values are edited.
do $$
declare
  definition text := pg_get_functiondef('public.gestion_update_local_sale(uuid,uuid,date,text,bigint,jsonb)'::regprocedure);
  anchor text := 'v_charged := v_order.total_minor;';
  replacement text := $new$v_charged := v_order.total_minor;
  if v_order.deposit_minor is null and v_items_total <> v_charged then
    raise exception 'Una venta ya cobrada debe conservar el mismo total de artículos; registrá una venta nueva o revisá los importes originales' using errcode = '22023';
  end if;$new$;
begin
  if (length(definition)-length(replace(definition,anchor,'')))/length(anchor) <> 1 then
    raise exception 'Unexpected charged amount calculation';
  end if;
  execute replace(definition,anchor,replacement);
end;
$$;
