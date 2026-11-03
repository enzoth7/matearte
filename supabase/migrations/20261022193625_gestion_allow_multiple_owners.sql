-- Permite más de una cuenta con acceso completo (t1): Richard y la cuenta de desarrollo.
-- Los demás tipos de acceso siguen siendo únicos.
drop index public.commerce_admin_users_access_user_id_key;
create unique index commerce_admin_users_access_user_id_key on public.commerce_admin_users (access_user_id) where access_user_id is not null and access_user_id <> 't1';
-- Cuenta enzothome: mismo acceso que Richard.
update public.commerce_admin_users set access_user_id = 't1', allowed_paths = null where user_id = 'deeec8ea-ace6-4f0a-a578-17751a83f707';
