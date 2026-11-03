-- Usuarios de Gestión agregados desde Administración > Usuarios: ids u + 8 hex,
-- además de los fijos t1/t2/t3/t5. Mantiene las reglas: solo Richard (t1) ve
-- Usuarios y Finanzas, y los demás no pueden recibir esas rutas.
alter table public.commerce_admin_users
  drop constraint commerce_admin_users_access_user_id_check,
  drop constraint commerce_admin_users_allowed_paths_check;

alter table public.commerce_admin_users
  add constraint commerce_admin_users_access_user_id_check
    check (access_user_id is null or access_user_id in ('t1', 't2', 't3', 't5') or access_user_id ~ '^u[0-9a-f]{8}$'),
  add constraint commerce_admin_users_allowed_paths_check
    check (
      allowed_paths is null or (
        access_user_id in ('t2', 't3', 't5') or access_user_id ~ '^u[0-9a-f]{8}$'
      )
      and array_position(allowed_paths, '/administracion/usuarios') is null
      and array_to_string(allowed_paths, ',') !~ '(^|,)[^/]'
      and array_to_string(allowed_paths, ',') !~ '(^|,)/finanzas/'
    );
