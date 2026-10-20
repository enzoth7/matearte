-- Betiana starts with Marketing only, but Richard can grant her other Gestión pages.
-- Do not grant commerce access while her saved permissions remain Marketing-only.
create or replace function private.is_commerce_admin(check_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.commerce_admin_users as admin
    where admin.user_id = check_user_id
      and admin.active
      and (
        admin.access_user_id is distinct from 't5'
        or exists (
          select 1
          from unnest(coalesce(admin.allowed_paths, array[]::text[])) as granted(path)
          where granted.path not like '/marketing/%'
            and granted.path not like '/finanzas/%'
            and granted.path <> '/administracion/usuarios'
        )
      )
  );
$$;

create or replace function private.can_manage_visualizer_pricing()
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_pricing_admin()
    or exists (
      select 1 from public.commerce_admin_users as admin
      where admin.user_id = (select auth.uid())
        and admin.active
        and (admin.allowed_paths is null or '/productos/personalizador' = any(admin.allowed_paths))
    );
$$;
