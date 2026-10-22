-- Finanzas deja de ser exclusiva de Richard: él decide quién la ve desde Usuarios y permisos.
-- Solo Usuarios y permisos sigue reservado. Las dos Florencias (t2 y t3) pueden ingresar egresos (Compras) y ver Egresos.
alter table public.commerce_admin_users drop constraint if exists commerce_admin_users_allowed_paths_check;
alter table public.commerce_admin_users
  add constraint commerce_admin_users_allowed_paths_check
    check (
      allowed_paths is null or (
        (access_user_id in ('t2', 't3', 't5') or access_user_id ~ '^u[0-9a-f]{8}$')
        and array_position(allowed_paths, '/administracion/usuarios') is null
        and array_to_string(allowed_paths, ',') !~ '(^|,)[^/]'
      )
    );

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
            and granted.path <> '/administracion/usuarios'
        )
      )
  );
$$;

update public.commerce_admin_users
set allowed_paths = (select array_agg(distinct path order by path) from unnest(allowed_paths || array['/inventario/compras', '/finanzas/egresos']) as path)
where access_user_id in ('t2', 't3') and allowed_paths is not null;
