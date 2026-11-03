alter table public.commerce_admin_users
  add column if not exists allowed_paths text[];

update public.commerce_admin_users
set allowed_paths = case access_user_id
  when 't2' then array[
    '/inicio/resumen',
    '/comercial/pedidos',
    '/comercial/registrar-min',
    '/clientes/base',
    '/clientes/segmentos'
  ]::text[]
  when 't3' then array[
    '/comercial/pedidos',
    '/comercial/registrar-may',
    '/clientes/base',
    '/clientes/segmentos',
    '/productos/catalogo',
    '/productos/ajustes',
    '/produccion/resumen',
    '/produccion/mayorista',
    '/produccion/minorista',
    '/produccion/capacidad',
    '/produccion/historico',
    '/inventario/stock',
    '/inventario/insumos',
    '/inventario/movimientos',
    '/inventario/reposicion',
    '/inventario/compras',
    '/inventario/proveedores',
    '/entregas/pendientes',
    '/entregas/retiros',
    '/entregas/envios',
    '/entregas/tarifas'
  ]::text[]
  else allowed_paths
end
where allowed_paths is null
  and access_user_id in ('t2', 't3');

alter table public.commerce_admin_users
  drop constraint if exists commerce_admin_users_allowed_paths_check;
alter table public.commerce_admin_users
  add constraint commerce_admin_users_allowed_paths_check
  check (
    allowed_paths is null
    or (
      access_user_id in ('t2', 't3')
      and array_position(allowed_paths, '/administracion/usuarios') is null
      and array_to_string(allowed_paths, ',') !~ '(^|,)[^/]'
      and array_to_string(allowed_paths, ',') !~ '(^|,)/finanzas/'
    )
  );
