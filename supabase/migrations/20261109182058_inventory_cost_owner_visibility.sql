-- Enzo y Richard comparten la gestión de los costos de inventario.
create or replace function private.can_manage_inventory_costs()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.commerce_admin_users admin
    where admin.user_id = (select auth.uid())
      and admin.user_id in (
        '5afbc94d-aecf-44e8-b12e-e136f49abb62'::uuid,
        'deeec8ea-ace6-4f0a-a578-17751a83f707'::uuid
      )
      and admin.active
      and admin.access_user_id = 't1'
  );
$$;
