-- Horarios del personal registrados desde Gestión.
create table public.personnel_time_entries (
  id uuid primary key default gen_random_uuid(),
  employee_name text not null check (char_length(btrim(employee_name)) between 1 and 120),
  work_date date not null,
  clock_in text check (clock_in is null or clock_in ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$|^-$'),
  clock_out text check (clock_out is null or clock_out ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$|^-$'),
  source text not null default 'gestion' check (source in ('gestion', 'planilla')),
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  updated_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint personnel_time_entries_one_shift_per_day unique (employee_name, work_date),
  constraint personnel_time_entries_has_a_time check (clock_in is not null or clock_out is not null)
);

create index personnel_time_entries_date_idx on public.personnel_time_entries (work_date desc);

create function private.touch_personnel_time_entry()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;
create trigger personnel_time_entries_touch before update on public.personnel_time_entries
  for each row execute function private.touch_personnel_time_entry();

create function private.can_read_personnel_hours()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.commerce_admin_users as admin
    where admin.user_id = (select auth.uid()) and admin.active
      and (admin.access_user_id = 't1' or admin.allowed_paths is null
        or '/personal/horas' = any(admin.allowed_paths))
  );
$$;

create function private.can_manage_personnel_hours()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.commerce_admin_users as admin
    where admin.user_id = (select auth.uid()) and admin.active
      and admin.access_user_id = 't1'
  );
$$;

revoke all on function private.can_read_personnel_hours() from public, anon;
revoke all on function private.can_manage_personnel_hours() from public, anon;
grant execute on function private.can_read_personnel_hours() to authenticated;
grant execute on function private.can_manage_personnel_hours() to authenticated;

alter table public.personnel_time_entries enable row level security;
create policy personnel_time_entries_read on public.personnel_time_entries
  for select to authenticated using ((select private.can_read_personnel_hours()));
create policy personnel_time_entries_insert on public.personnel_time_entries
  for insert to authenticated with check ((select private.can_manage_personnel_hours())
    and created_by = (select auth.uid()) and updated_by = (select auth.uid()));
create policy personnel_time_entries_update on public.personnel_time_entries
  for update to authenticated using ((select private.can_manage_personnel_hours()))
  with check ((select private.can_manage_personnel_hours()) and updated_by = (select auth.uid()));

grant select, insert on public.personnel_time_entries to authenticated;
grant update (clock_in, clock_out) on public.personnel_time_entries to authenticated;
