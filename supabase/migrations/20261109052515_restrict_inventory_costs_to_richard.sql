create or replace function private.can_manage_inventory_costs()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.commerce_admin_users admin
    where admin.user_id = (select auth.uid())
      and admin.user_id = '5afbc94d-aecf-44e8-b12e-e136f49abb62'::uuid
      and admin.active
      and admin.access_user_id = 't1'
  );
$$;
