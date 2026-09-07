create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

create table public.lifecycle_email_outbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null check (event_type in ('welcome', 'birthday')),
  event_key text not null unique check (char_length(event_key) between 1 and 180),
  recipient_email text not null check (recipient_email = lower(btrim(recipient_email))),
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'sending', 'sent', 'skipped', 'failed')),
  attempt_count integer not null default 0 check (attempt_count between 0 and 5),
  provider_message_id text,
  last_error text,
  available_at timestamptz not null default now(),
  claimed_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index lifecycle_email_outbox_user_idx on public.lifecycle_email_outbox (user_id, created_at desc);
create index lifecycle_email_outbox_pending_idx on public.lifecycle_email_outbox (available_at, created_at)
where status in ('pending', 'failed', 'sending') and attempt_count < 5;

revoke all on public.lifecycle_email_outbox from public, anon, authenticated;
grant all on public.lifecycle_email_outbox to service_role;
alter table public.lifecycle_email_outbox enable row level security;

create policy lifecycle_email_outbox_backend_only on public.lifecycle_email_outbox
for all to anon, authenticated using (false) with check (false);

create or replace function public.get_email_delivery_config()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_object_agg(secret.name, secret.decrypted_secret), '{}'::jsonb)
  from vault.decrypted_secrets secret
  where secret.name in (
    'matearte_resend_api_key',
    'matearte_newsletter_topic_id',
    'matearte_email_from',
    'matearte_email_reply_to',
    'matearte_admin_email',
    'matearte_site_url',
    'matearte_newsletter_unsubscribe_secret',
    'matearte_lifecycle_service_role'
  );
$$;

revoke all on function public.get_email_delivery_config() from public, anon, authenticated;
grant execute on function public.get_email_delivery_config() to service_role;

create trigger lifecycle_email_outbox_updated_at
before update on public.lifecycle_email_outbox
for each row execute function private.set_updated_at();

create or replace function private.enqueue_customer_welcome_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text;
begin
  select lower(btrim(email)) into v_email
  from auth.users
  where id = new.user_id and deleted_at is null;

  if v_email is not null and v_email <> '' then
    insert into public.lifecycle_email_outbox (user_id, event_type, event_key, recipient_email, payload)
    values (
      new.user_id,
      'welcome',
      'welcome:' || new.user_id::text,
      v_email,
      jsonb_build_object('name', nullif(btrim(new.full_name), ''))
    )
    on conflict (event_key) do nothing;
  end if;

  return new;
end;
$$;

revoke all on function private.enqueue_customer_welcome_email() from public, anon, authenticated;

create trigger customer_profiles_enqueue_welcome_email
after insert on public.customer_profiles
for each row execute function private.enqueue_customer_welcome_email();

create or replace function public.queue_upcoming_birthday_emails(
  p_today date default ((now() at time zone 'America/Montevideo')::date)
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target date := p_today + 10;
  v_inserted integer;
begin
  insert into public.lifecycle_email_outbox (user_id, event_type, event_key, recipient_email, payload)
  select
    profile.user_id,
    'birthday',
    'birthday:' || profile.user_id::text || ':' || extract(year from v_target)::integer::text,
    lower(btrim(auth_user.email)),
    jsonb_build_object(
      'name', nullif(btrim(profile.full_name), ''),
      'birthdayDate', profile.birth_date,
      'birthdayYear', extract(year from v_target)::integer
    )
  from public.customer_profiles profile
  join auth.users auth_user on auth_user.id = profile.user_id
  where profile.birth_date is not null
    and auth_user.deleted_at is null
    and nullif(lower(btrim(auth_user.email)), '') is not null
    and (
      (
        extract(month from profile.birth_date) = extract(month from v_target)
        and extract(day from profile.birth_date) = extract(day from v_target)
      )
      or (
        extract(month from profile.birth_date) = 2
        and extract(day from profile.birth_date) = 29
        and extract(month from v_target) = 2
        and extract(day from v_target) = 28
        and v_target = (date_trunc('month', v_target)::date + interval '1 month - 1 day')::date
      )
    )
  on conflict (event_key) do nothing;

  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;

revoke all on function public.queue_upcoming_birthday_emails(date) from public, anon, authenticated;
grant execute on function public.queue_upcoming_birthday_emails(date) to service_role;

create or replace function public.claim_lifecycle_email_jobs(p_limit integer default 20)
returns setof public.lifecycle_email_outbox
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  with candidates as (
    select email.id
    from public.lifecycle_email_outbox email
    where email.attempt_count < 5
      and email.available_at <= now()
      and (
        email.status in ('pending', 'failed')
        or (email.status = 'sending' and email.claimed_at < now() - interval '15 minutes')
      )
    order by email.created_at, email.id
    limit least(greatest(p_limit, 1), 50)
    for update skip locked
  )
  update public.lifecycle_email_outbox email
  set status = 'sending',
      attempt_count = email.attempt_count + 1,
      claimed_at = now(),
      last_error = null,
      updated_at = now()
  from candidates
  where email.id = candidates.id
  returning email.*;
end;
$$;

revoke all on function public.claim_lifecycle_email_jobs(integer) from public, anon, authenticated;
grant execute on function public.claim_lifecycle_email_jobs(integer) to service_role;

do $$
declare
  v_job_id bigint;
begin
  select jobid into v_job_id from cron.job where jobname = 'matearte-lifecycle-email-worker';
  if v_job_id is not null then perform cron.unschedule(v_job_id); end if;
end;
$$;

select cron.schedule(
  'matearte-lifecycle-email-worker',
  '*/5 * * * *',
  $schedule$
    select net.http_post(
      url := 'https://agdkljuulwjwjasftcce.supabase.co/functions/v1/lifecycle-email',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'matearte_lifecycle_service_role')
      ),
      body := '{"source":"cron"}'::jsonb,
      timeout_milliseconds := 30000
    );
  $schedule$
);

comment on table public.lifecycle_email_outbox is
'Backend-only, idempotent queue for welcome and consent-gated birthday emails.';
