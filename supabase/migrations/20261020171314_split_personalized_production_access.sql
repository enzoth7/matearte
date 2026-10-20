-- Existing production users keep access to the newly separated configurator.
-- The two pages can be assigned independently from now on.
update public.commerce_admin_users
set allowed_paths = array_append(allowed_paths, '/produccion/configurador-visualizador')
where allowed_paths is not null
  and '/produccion/personalizados' = any(allowed_paths)
  and not ('/produccion/configurador-visualizador' = any(allowed_paths));

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
          or '/produccion/configurador-visualizador' = any(admin.allowed_paths)
        )
    );
$$;

revoke all on function private.can_manage_visualizer_pricing() from public, anon;
grant execute on function private.can_manage_visualizer_pricing() to authenticated;
