-- Leads and raffle entries captured by the dedicated La Rural landing page.

create table if not exists public.rural_raffle_entries (
  id uuid primary key default gen_random_uuid(),
  campaign text not null default 'rural-2026'
    check (campaign = lower(btrim(campaign)) and char_length(campaign) between 3 and 50),
  email text not null
    check (email = lower(btrim(email)) and char_length(email) between 3 and 320),
  phone text not null
    check (phone ~ '^\+[1-9][0-9]{7,14}$'),
  product_interest text not null
    check (product_interest in (
      'mates',
      'bombillas',
      'materas',
      'termos',
      'personalizados',
      'regalos-empresariales',
      'otro'
    )),
  privacy_consent_at timestamptz not null,
  marketing_opt_in boolean not null default false,
  marketing_opt_in_at timestamptz,
  source text not null default 'qr-rural'
    check (char_length(source) between 3 and 50),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rural_raffle_entries_campaign_email_unique unique (campaign, email),
  constraint rural_raffle_entries_marketing_consent_consistent check (
    (marketing_opt_in and marketing_opt_in_at is not null)
    or (not marketing_opt_in and marketing_opt_in_at is null)
  )
);

create index if not exists rural_raffle_entries_campaign_created_idx
  on public.rural_raffle_entries (campaign, created_at desc);

create index if not exists rural_raffle_entries_phone_idx
  on public.rural_raffle_entries (phone);

drop trigger if exists rural_raffle_entries_updated_at on public.rural_raffle_entries;
create trigger rural_raffle_entries_updated_at
before update on public.rural_raffle_entries
for each row execute function private.set_updated_at();

revoke all on public.rural_raffle_entries from public, anon, authenticated;
grant select, insert, update on public.rural_raffle_entries to service_role;
alter table public.rural_raffle_entries enable row level security;

drop policy if exists rural_raffle_entries_backend_only on public.rural_raffle_entries;
create policy rural_raffle_entries_backend_only on public.rural_raffle_entries
for all to anon, authenticated using (false) with check (false);

comment on table public.rural_raffle_entries is
'Raffle participants and product interests captured from MateArte campaign landing pages.';
