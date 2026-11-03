-- Count the same email contacts shown in Marketing, grouped by their displayed origin.
create view public.marketing_contact_origin_counts
with (security_invoker = true) as
select source, count(*)::integer as contacts
from public.marketing_contact_directory
where email is not null
group by source;

revoke all on public.marketing_contact_origin_counts from public, anon, authenticated;
grant select on public.marketing_contact_origin_counts to service_role;
