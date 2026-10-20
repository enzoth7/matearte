-- Keep the new production page available to profiles that already had production access.
update public.commerce_admin_users
set allowed_paths = array_append(allowed_paths, '/produccion/personalizados')
where allowed_paths is not null
  and '/produccion/resumen' = any(allowed_paths)
  and not ('/produccion/personalizados' = any(allowed_paths));
