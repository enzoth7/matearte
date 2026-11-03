-- Preserve existing configurator access while its navigation moves from
-- Producción to Productos. Keep the old path during the frontend rollout;
-- only the new path authorizes future Visualizador administration.
update public.commerce_admin_users
set allowed_paths = array_append(allowed_paths, '/productos/personalizador')
where allowed_paths is not null
  and '/produccion/configurador-visualizador' = any(allowed_paths)
  and not ('/productos/personalizador' = any(allowed_paths));

create or replace function private.can_manage_visualizer_pricing()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_pricing_admin()
    or exists (
      select 1
      from public.commerce_admin_users as admin
      where admin.user_id = (select auth.uid())
        and admin.active
        and (
          admin.allowed_paths is null
          or '/productos/personalizador' = any(admin.allowed_paths)
        )
    );
$$;

revoke all on function private.can_manage_visualizer_pricing() from public, anon, authenticated;
grant execute on function private.can_manage_visualizer_pricing() to authenticated;
