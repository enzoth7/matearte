-- Bootstrap only from the existing database-backed admin membership.
-- No user_metadata claim is used for authorization.
insert into public.commerce_admin_users (user_id, display_name, active)
select user_id, username, active
from public.admin_users
where active
on conflict (user_id) do update set display_name = excluded.display_name, active = excluded.active;
