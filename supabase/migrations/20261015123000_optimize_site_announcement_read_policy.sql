-- Keep one permissive SELECT policy per role while preserving public and admin visibility.

drop policy site_announcements_public_current_read on public.site_announcements;
drop policy site_announcements_admin_read on public.site_announcements;

create policy site_announcements_anon_current_read
on public.site_announcements
for select
to anon
using (
  enabled
  and (now() at time zone 'America/Montevideo')::date between valid_from and valid_until
);

create policy site_announcements_authenticated_read
on public.site_announcements
for select
to authenticated
using (
  (
    enabled
    and (now() at time zone 'America/Montevideo')::date between valid_from and valid_until
  )
  or (select private.is_commerce_admin())
);
