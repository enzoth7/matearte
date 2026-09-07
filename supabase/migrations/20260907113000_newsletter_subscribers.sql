-- Storefront newsletter subscribers and unified marketing contacts view.

create table if not exists public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null check (email = lower(btrim(email)) and char_length(email) between 3 and 320),
  first_name text check (first_name is null or char_length(first_name) <= 100),
  status text not null default 'active' check (status in ('active', 'unsubscribed')),
  source text not null default 'footer' check (char_length(source) <= 50),
  resend_contact_id text,
  subscribed_at timestamptz not null default now(),
  unsubscribed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint newsletter_subscribers_email_unique unique (email)
);

create index if not exists newsletter_subscribers_email_idx on public.newsletter_subscribers (email);
create index if not exists newsletter_subscribers_status_idx on public.newsletter_subscribers (status);

drop trigger if exists newsletter_subscribers_updated_at on public.newsletter_subscribers;
create trigger newsletter_subscribers_updated_at
before update on public.newsletter_subscribers
for each row execute function private.set_updated_at();

revoke all on public.newsletter_subscribers from public, anon, authenticated;
grant select, insert, update on public.newsletter_subscribers to service_role;
alter table public.newsletter_subscribers enable row level security;

drop policy if exists newsletter_subscribers_backend_only on public.newsletter_subscribers;
create policy newsletter_subscribers_backend_only on public.newsletter_subscribers
for all to anon, authenticated using (false) with check (false);

create or replace view public.all_contacts as
select
  ns.id::text as id,
  ns.email,
  ns.first_name as name,
  'newsletter' as origin,
  ns.status,
  ns.created_at
from public.newsletter_subscribers ns
union all
select
  au.id::text as id,
  lower(btrim(au.email)) as email,
  nullif(btrim(cp.full_name), '') as name,
  'customer_account' as origin,
  'active' as status,
  cp.created_at
from public.customer_profiles cp
join auth.users au on au.id = cp.user_id
where au.deleted_at is null and au.email is not null;

revoke all on public.all_contacts from public, anon, authenticated;
grant select on public.all_contacts to service_role;

comment on table public.newsletter_subscribers is
'Public storefront newsletter subscribers synced with Resend contacts.';

comment on view public.all_contacts is
'Consolidated view of all marketing and user contacts across newsletter subscribers and registered customers.';
