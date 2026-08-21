-- La contraseña se crea/rota exclusivamente mediante Supabase Auth y nunca vive en SQL.
-- Esta migración confirma la identidad ya provisionada y le concede el rol interno.
with confirmed_admin as (
  update auth.users
  set email_confirmed_at = coalesce(email_confirmed_at, now()),
      updated_at = now()
  where lower(email) = 'pricing-admin@matearte.uy'
  returning id
)
insert into public.admin_users (user_id, username, active)
select id, 'user', true
from confirmed_admin
on conflict (user_id) do update
set username = excluded.username,
    active = true;

do $$
begin
  if not exists (
    select 1
    from public.admin_users admin_user
    join auth.users auth_user on auth_user.id = admin_user.user_id
    where admin_user.username = 'user'
      and admin_user.active = true
      and lower(auth_user.email) = 'pricing-admin@matearte.uy'
      and auth_user.email_confirmed_at is not null
  ) then
    raise exception 'The pricing administrator identity was not provisioned in Supabase Auth';
  end if;
end;
$$;
