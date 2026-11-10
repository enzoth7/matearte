drop policy if exists inventory_cost_profiles_access on public.inventory_cost_profiles;

create policy inventory_cost_profiles_read on public.inventory_cost_profiles
  for select to authenticated using (
    case when method = 'reventa' then (select private.gestion_has_page_access('/inventario/reventa'))
    else (select private.gestion_has_page_access('/inventario/insumos'))
      or (select private.gestion_has_page_access('/inventario/fabricados')) end
  );
create policy inventory_cost_profiles_insert on public.inventory_cost_profiles
  for insert to authenticated with check (
    case when method = 'reventa' then (select private.gestion_has_page_access('/inventario/reventa'))
    else (select private.gestion_has_page_access('/inventario/insumos')) end
  );
create policy inventory_cost_profiles_update on public.inventory_cost_profiles
  for update to authenticated
  using (case when method = 'reventa' then (select private.gestion_has_page_access('/inventario/reventa'))
    else (select private.gestion_has_page_access('/inventario/insumos')) end)
  with check (case when method = 'reventa' then (select private.gestion_has_page_access('/inventario/reventa'))
    else (select private.gestion_has_page_access('/inventario/insumos')) end);
create policy inventory_cost_profiles_delete on public.inventory_cost_profiles
  for delete to authenticated using (
    case when method = 'reventa' then (select private.gestion_has_page_access('/inventario/reventa'))
    else (select private.gestion_has_page_access('/inventario/insumos')) end
  );
