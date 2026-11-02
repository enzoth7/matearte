alter table public.marketing_campaigns
  add column mode text not null default 'message' check (mode in ('message', 'image')),
  add column headline text,
  add column button_label text,
  add column audience_mode text not null default 'all' check (audience_mode in ('all', 'selected')),
  add column selected_emails text[] not null default '{}'::text[],
  add column recipient_count integer check (recipient_count is null or recipient_count >= 0),
  add column resend_segment_id text,
  add column send_requested_at timestamptz,
  add column send_attempted_at timestamptz;

create table public.marketing_campaign_targets (
  campaign_id uuid not null references public.marketing_campaigns(id) on delete cascade,
  email text not null,
  name text,
  status text not null default 'pending' check (status in ('pending', 'ready', 'excluded')),
  primary key (campaign_id, email)
);
create index marketing_campaign_targets_status_idx
  on public.marketing_campaign_targets (campaign_id, status);
revoke all on public.marketing_campaign_targets from public, anon, authenticated;
grant all on public.marketing_campaign_targets to service_role;
alter table public.marketing_campaign_targets enable row level security;

-- One address per recipient. If duplicate records disagree, an unsubscribe wins.
create view public.marketing_campaign_email_directory as
select distinct on (lower(d.email))
  lower(d.email) as email,
  d.name,
  d.subscription_status
from public.marketing_contact_directory d
where d.email is not null
order by lower(d.email),
  case when d.subscription_status = 'unsubscribed' then 0 else 1 end,
  d.name nulls last;
revoke all on public.marketing_campaign_email_directory from public, anon, authenticated;
grant select on public.marketing_campaign_email_directory to service_role;
