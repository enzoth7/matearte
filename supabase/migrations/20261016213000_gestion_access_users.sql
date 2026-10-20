alter table public.commerce_admin_users
  add column if not exists access_user_id text;

update public.commerce_admin_users
set access_user_id = case
  when lower(display_name) like 'richard%' then 't1'
  when lower(display_name) like 'florencia costa%' then 't2'
  when lower(display_name) like 'florencia pizzorno%' then 't3'
  else access_user_id
end
where access_user_id is null;

alter table public.commerce_admin_users
  drop constraint if exists commerce_admin_users_access_user_id_check;
alter table public.commerce_admin_users
  add constraint commerce_admin_users_access_user_id_check
  check (access_user_id is null or access_user_id in ('t1', 't2', 't3'));

create unique index if not exists commerce_admin_users_access_user_id_key
  on public.commerce_admin_users (access_user_id)
  where access_user_id is not null;
