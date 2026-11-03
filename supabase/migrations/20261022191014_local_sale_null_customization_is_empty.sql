-- Una línea sin personalización llega como customization: null (JSON null). Debe tratarse como ausencia, no como error.
do $patch$
declare v_def text;
begin
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'gestion_create_local_sale_with_items';
  v_def := replace(v_def, 'v_customization := v_item -> ''customization'';', 'v_customization := nullif(v_item -> ''customization'', ''null''::jsonb);');
  execute v_def;
end
$patch$;
