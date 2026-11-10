-- The published client still reads this hidden legacy flag. New clients drop it
-- from their next permissions save; database authorization uses subtab paths.
update public.commerce_admin_users
set allowed_paths = array_append(allowed_paths, '/finanzas/editar-egresos')
where allowed_paths is not null
  and '/finanzas/egresos' = any(allowed_paths)
  and '/finanzas/gastos-fijos' = any(allowed_paths)
  and not '/finanzas/editar-egresos' = any(allowed_paths);
