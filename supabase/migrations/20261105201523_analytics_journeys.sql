create table if not exists public.analytics_events (
  event_id uuid primary key,
  session_id uuid not null,
  occurred_at timestamptz not null default now(),
  journey text not null check (journey in ('catalog', 'custom')),
  device text not null check (device in ('desktop', 'mobile', 'tablet')),
  step text not null check (step in ('entry', 'catalog', 'product', 'custom_page', 'personalizer_open', 'mate_selected', 'design_started', 'summary', 'cart')),
  kind text not null check (kind in ('step', 'screen')),
  visible_ms integer not null default 0 check (visible_ms between 0 and 1800000),
  scroll_pct smallint not null default 0 check (scroll_pct between 0 and 100)
);
create index if not exists analytics_events_occurred_at_idx on public.analytics_events (occurred_at);

create table if not exists public.analytics_session_steps (
  day date not null,
  session_id uuid not null,
  journey text not null,
  device text not null,
  step text not null,
  primary key (day, session_id, journey, step)
);
create index if not exists analytics_session_steps_day_idx on public.analytics_session_steps (day, journey, device);

create table if not exists public.analytics_daily_steps (
  day date not null,
  journey text not null,
  device text not null,
  step text not null,
  sessions integer not null default 0,
  screen_samples integer not null default 0,
  visible_ms bigint not null default 0,
  scroll_25 integer not null default 0,
  scroll_50 integer not null default 0,
  scroll_75 integer not null default 0,
  scroll_90 integer not null default 0,
  primary key (day, journey, device, step)
);

create table if not exists public.analytics_changes (
  id uuid primary key default gen_random_uuid(),
  changed_on date not null,
  journey text not null check (journey in ('catalog', 'custom', 'both')),
  description text not null check (char_length(description) between 3 and 300),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.analytics_vercel_days (
  day date not null,
  site text not null check (site in ('web', 'personalizer')),
  status text not null check (status in ('complete', 'pending')),
  pageviews integer,
  daily_visitors integer,
  pages jsonb not null default '[]'::jsonb,
  error text,
  checked_at timestamptz not null default now(),
  primary key (day, site),
  check ((status = 'complete' and pageviews is not null and daily_visitors is not null) or status = 'pending')
);

create table if not exists public.analytics_state (
  id boolean primary key default true check (id),
  activated_on date,
  vercel_backfill_started_on date
);
insert into public.analytics_state(id) values (true) on conflict do nothing;

alter table public.analytics_events enable row level security;
alter table public.analytics_session_steps enable row level security;
alter table public.analytics_daily_steps enable row level security;
alter table public.analytics_changes enable row level security;
alter table public.analytics_vercel_days enable row level security;
alter table public.analytics_state enable row level security;
revoke all on public.analytics_events, public.analytics_session_steps, public.analytics_daily_steps, public.analytics_changes, public.analytics_vercel_days, public.analytics_state from anon, authenticated;

create or replace function public.analytics_rollup_event() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_day date := (new.occurred_at at time zone 'America/Montevideo')::date;
begin
  if new.kind = 'step' then
    insert into public.analytics_session_steps(day, session_id, journey, device, step)
    values (v_day, new.session_id, new.journey, new.device, new.step)
    on conflict do nothing;
    if found then
      insert into public.analytics_daily_steps(day, journey, device, step, sessions)
      values (v_day, new.journey, new.device, new.step, 1)
      on conflict (day, journey, device, step) do update
      set sessions = public.analytics_daily_steps.sessions + 1;
    end if;
  else
    insert into public.analytics_daily_steps(day, journey, device, step, screen_samples, visible_ms, scroll_25, scroll_50, scroll_75, scroll_90)
    values (v_day, new.journey, new.device, new.step, 1, new.visible_ms,
      (new.scroll_pct >= 25)::int, (new.scroll_pct >= 50)::int,
      (new.scroll_pct >= 75)::int, (new.scroll_pct >= 90)::int)
    on conflict (day, journey, device, step) do update set
      screen_samples = public.analytics_daily_steps.screen_samples + 1,
      visible_ms = public.analytics_daily_steps.visible_ms + excluded.visible_ms,
      scroll_25 = public.analytics_daily_steps.scroll_25 + excluded.scroll_25,
      scroll_50 = public.analytics_daily_steps.scroll_50 + excluded.scroll_50,
      scroll_75 = public.analytics_daily_steps.scroll_75 + excluded.scroll_75,
      scroll_90 = public.analytics_daily_steps.scroll_90 + excluded.scroll_90;
  end if;
  update public.analytics_state set activated_on = coalesce(activated_on, v_day) where id;
  return new;
end $$;
create trigger analytics_event_rollup after insert on public.analytics_events
for each row execute function public.analytics_rollup_event();
revoke all on function public.analytics_rollup_event() from public, anon, authenticated;

create or replace function public.analytics_prune_events() returns void
language sql security definer set search_path = public, pg_temp as $$
  delete from public.analytics_events where occurred_at < now() - interval '90 days';
  delete from public.analytics_session_steps where day < (now() at time zone 'America/Montevideo')::date - 90;
$$;
revoke all on function public.analytics_prune_events() from public, anon, authenticated;

create or replace function public.analytics_report(p_start date, p_end date, p_device text default null, p_journey text default null)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare result jsonb;
begin
  if p_start is null or p_end is null or p_end < p_start or p_end - p_start > 179
     or (p_device is not null and p_device not in ('desktop', 'mobile', 'tablet'))
     or (p_journey is not null and p_journey not in ('catalog', 'custom')) then
    raise exception 'Filtro de analítica inválido';
  end if;
  select jsonb_build_object(
    'steps', coalesce((select jsonb_agg(to_jsonb(s)) from (
      select map.journey, map.step,
        count(*) filter (where sessions.seen @> map.required)::int as sessions
      from (values
        ('catalog', 'entry', array['entry']),
        ('catalog', 'catalog', array['entry', 'catalog']),
        ('catalog', 'product', array['entry', 'catalog', 'product']),
        ('catalog', 'cart', array['entry', 'catalog', 'product', 'cart']),
        ('custom', 'entry', array['entry']),
        ('custom', 'custom_page', array['entry', 'custom_page']),
        ('custom', 'personalizer_open', array['entry', 'custom_page', 'personalizer_open']),
        ('custom', 'mate_selected', array['entry', 'custom_page', 'personalizer_open', 'mate_selected']),
        ('custom', 'design_started', array['entry', 'custom_page', 'personalizer_open', 'mate_selected', 'design_started']),
        ('custom', 'summary', array['entry', 'custom_page', 'personalizer_open', 'mate_selected', 'design_started', 'summary']),
        ('custom', 'cart', array['entry', 'custom_page', 'personalizer_open', 'mate_selected', 'design_started', 'summary', 'cart'])
      ) as map(journey, step, required)
      left join (
        select journey, session_id, array_agg(distinct step) as seen
        from public.analytics_session_steps
        where day between p_start and p_end and (p_device is null or device = p_device)
        group by journey, session_id
      ) sessions on sessions.journey = map.journey
      where p_journey is null or map.journey = p_journey
      group by map.journey, map.step
    ) s), '[]'::jsonb),
    'daily', coalesce((select jsonb_agg(to_jsonb(d)) from (
      select day, journey, step, sum(sessions)::int as sessions,
        sum(screen_samples)::int as screen_samples, sum(visible_ms)::bigint as visible_ms,
        sum(scroll_25)::int as scroll_25, sum(scroll_50)::int as scroll_50,
        sum(scroll_75)::int as scroll_75, sum(scroll_90)::int as scroll_90
      from public.analytics_daily_steps
      where day between p_start - 14 and p_end + 14 and (p_device is null or device = p_device)
        and (p_journey is null or journey = p_journey)
      group by day, journey, step
    ) d), '[]'::jsonb),
    'vercel', coalesce((select jsonb_agg(to_jsonb(v)) from (
      select day, site, status, pageviews, daily_visitors, pages, error
      from public.analytics_vercel_days where day between p_start and p_end order by day, site
    ) v), '[]'::jsonb),
    'changes', coalesce((select jsonb_agg(to_jsonb(c)) from (
      select id, changed_on, journey, description, created_at
      from public.analytics_changes where changed_on between p_start and p_end order by changed_on desc
    ) c), '[]'::jsonb),
    'activated_on', (select activated_on from public.analytics_state where id)
  ) into result;
  return result;
end $$;
revoke all on function public.analytics_report(date, date, text, text) from public, anon, authenticated;
grant execute on function public.analytics_report(date, date, text, text) to service_role;

select cron.schedule('matearte-analytics-prune', '20 11 * * *', 'select public.analytics_prune_events()');

select cron.schedule(
  'matearte-analytics-vercel-archive', '0 11 * * *',
  $$select net.http_post(
    url := 'https://agdkljuulwjwjasftcce.supabase.co/functions/v1/analytics-archive',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'matearte_lifecycle_service_role')),
    body := '{}'::jsonb
  )$$
);
select cron.alter_job(
  job_id := (select jobid from cron.job where jobname = 'matearte-analytics-vercel-archive'),
  active := false
);
