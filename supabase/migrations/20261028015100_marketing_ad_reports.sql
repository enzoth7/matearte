-- Informes de pauta (Marketing → Informes de pauta): campañas pagas de un período, con el depósito,
-- el saldo anterior y las notas. Los totales (subtotal, nuevo saldo) se calculan en la app a partir de estos datos.
-- Solo pueden verlos y editarlos Richard (t1) y quienes tengan /marketing/pauta entre sus permisos.

create or replace function private.can_manage_ad_reports()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.commerce_admin_users as admin
    where admin.user_id = (select auth.uid())
      and admin.active
      and (
        admin.access_user_id = 't1'
        or admin.allowed_paths is null
        or '/marketing/pauta' = any(admin.allowed_paths)
      )
  );
$$;
revoke all on function private.can_manage_ad_reports() from public, anon;
grant execute on function private.can_manage_ad_reports() to authenticated;

create table public.ad_reports (
  id uuid primary key default gen_random_uuid(),
  period_start date not null,
  period_end date not null,
  platform text not null default 'Meta' check (char_length(btrim(platform)) between 1 and 40),
  currency text not null default 'USD' check (currency in ('USD', 'UYU', 'ARS')),
  -- [{ name, conversations, cost_per_conversation_minor, total_minor }]; importes en centavos.
  campaigns jsonb not null default '[]'::jsonb check (jsonb_typeof(campaigns) = 'array' and jsonb_array_length(campaigns) <= 50),
  deposit_minor bigint not null default 0 check (deposit_minor >= 0),
  deposit_on date,
  -- Con signo: negativo = saldo pendiente del informe anterior, positivo = saldo a favor.
  previous_balance_minor bigint not null default 0,
  notes text check (notes is null or char_length(notes) <= 2000),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (period_end >= period_start)
);
create index ad_reports_period_end_idx on public.ad_reports (period_end desc);

create trigger ad_reports_touch_updated_at before update on public.ad_reports
  for each row execute function private.touch_updated_at();

alter table public.ad_reports enable row level security;
create policy "ad_reports_manage" on public.ad_reports for all to authenticated
  using ((select private.can_manage_ad_reports())) with check ((select private.can_manage_ad_reports()));

grant select, insert, update, delete on public.ad_reports to authenticated;
