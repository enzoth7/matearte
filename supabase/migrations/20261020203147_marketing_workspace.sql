-- Marketing has its own access level. It must not inherit commerce or finance RLS.
alter table public.commerce_admin_users
  drop constraint if exists commerce_admin_users_access_user_id_check;
alter table public.commerce_admin_users
  add constraint commerce_admin_users_access_user_id_check
  check (access_user_id is null or access_user_id in ('t1', 't2', 't3', 't5'));

alter table public.commerce_admin_users
  drop constraint if exists commerce_admin_users_allowed_paths_check;
alter table public.commerce_admin_users
  add constraint commerce_admin_users_allowed_paths_check
  check (
    allowed_paths is null or (
      access_user_id in ('t2', 't3', 't5')
      and array_position(allowed_paths, '/administracion/usuarios') is null
      and array_to_string(allowed_paths, ',') !~ '(^|,)[^/]'
      and array_to_string(allowed_paths, ',') !~ '(^|,)/finanzas/'
    )
  );

update public.commerce_admin_users
set allowed_paths = array['/marketing/campanas','/marketing/contactos','/marketing/suscripcion','/marketing/descuentos','/marketing/avisos','/marketing/metricas']::text[]
where access_user_id = 't5' and allowed_paths is null;

update public.commerce_admin_users
set allowed_paths = array_replace(
  array_replace(allowed_paths, '/comercial/avisos', '/marketing/avisos'),
  '/comercial/descuentos', '/marketing/descuentos'
)
where allowed_paths is not null;

create or replace function private.is_commerce_admin(check_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.commerce_admin_users
    where user_id = check_user_id and active and access_user_id is distinct from 't5'
  );
$$;

create or replace function private.can_manage_visualizer_pricing()
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_pricing_admin()
    or exists (
      select 1 from public.commerce_admin_users as admin
      where admin.user_id = (select auth.uid()) and admin.active
        and admin.access_user_id is distinct from 't5'
        and (admin.allowed_paths is null or '/productos/personalizador' = any(admin.allowed_paths))
    );
$$;

drop policy if exists contact_history_admin_read on public.gestion_customer_contact_history;
create policy contact_history_admin_read on public.gestion_customer_contact_history
for select to authenticated using ((select private.is_commerce_admin()));
drop policy if exists contact_history_admin_insert on public.gestion_customer_contact_history;
create policy contact_history_admin_insert on public.gestion_customer_contact_history
for insert to authenticated with check (changed_by = (select auth.uid()) and (select private.is_commerce_admin()));

create function private.can_manage_marketing(p_path text, check_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.commerce_admin_users
    where user_id = check_user_id and active
      and (access_user_id = 't1' or p_path = any(coalesce(allowed_paths, array[]::text[])))
  );
$$;
revoke all on function private.can_manage_marketing(text, uuid) from public, anon;
grant execute on function private.can_manage_marketing(text, uuid) to authenticated, service_role;

create policy site_announcements_marketing_read on public.site_announcements
for select to authenticated using ((select private.can_manage_marketing('/marketing/avisos')));
create policy site_announcements_marketing_insert on public.site_announcements
for insert to authenticated with check ((select private.can_manage_marketing('/marketing/avisos')));
create policy site_announcements_marketing_update on public.site_announcements
for update to authenticated using ((select private.can_manage_marketing('/marketing/avisos')))
with check ((select private.can_manage_marketing('/marketing/avisos')));
create policy site_announcements_marketing_delete on public.site_announcements
for delete to authenticated using ((select private.can_manage_marketing('/marketing/avisos')));

create policy site_announcements_storage_marketing_select on storage.objects
for select to authenticated using (bucket_id = 'site-announcements' and (select private.can_manage_marketing('/marketing/avisos')));
create policy site_announcements_storage_marketing_insert on storage.objects
for insert to authenticated with check (bucket_id = 'site-announcements' and (select private.can_manage_marketing('/marketing/avisos')));
create policy site_announcements_storage_marketing_update on storage.objects
for update to authenticated using (bucket_id = 'site-announcements' and (select private.can_manage_marketing('/marketing/avisos')))
with check (bucket_id = 'site-announcements' and (select private.can_manage_marketing('/marketing/avisos')));
create policy site_announcements_storage_marketing_delete on storage.objects
for delete to authenticated using (bucket_id = 'site-announcements' and (select private.can_manage_marketing('/marketing/avisos')));

create policy commerce_discounts_marketing_read on public.commerce_discounts
for select to authenticated using ((select private.can_manage_marketing('/marketing/descuentos')));
create policy commerce_discounts_marketing_insert on public.commerce_discounts
for insert to authenticated with check ((select private.can_manage_marketing('/marketing/descuentos')));
create policy commerce_discounts_marketing_update on public.commerce_discounts
for update to authenticated using ((select private.can_manage_marketing('/marketing/descuentos')))
with check ((select private.can_manage_marketing('/marketing/descuentos')));

create table public.marketing_subscription_settings (
  id boolean primary key default true check (id),
  enabled boolean not null default true,
  headline text not null default 'Suscribite y recibí 10% de descuento',
  description text not null default 'Dejanos tu correo y activá tu beneficio para tu primera compra.',
  image_url text,
  discount_code text not null default 'BIENVENIDA10',
  updated_at timestamptz not null default now()
);
insert into public.marketing_subscription_settings (id) values (true);
revoke all on public.marketing_subscription_settings from public, anon, authenticated;
grant select on public.marketing_subscription_settings to anon, authenticated;
grant update on public.marketing_subscription_settings to authenticated;
grant all on public.marketing_subscription_settings to service_role;
alter table public.marketing_subscription_settings enable row level security;
create policy marketing_settings_public_read on public.marketing_subscription_settings
for select to anon, authenticated using (true);
create policy marketing_settings_admin_update on public.marketing_subscription_settings
for update to authenticated using ((select private.can_manage_marketing('/marketing/suscripcion')))
with check ((select private.can_manage_marketing('/marketing/suscripcion')));

create table public.marketing_campaigns (
  id uuid primary key default gen_random_uuid(),
  subject text not null,
  body text not null,
  image_url text,
  target_url text,
  resend_broadcast_id text,
  status text not null default 'draft' check (status in ('draft', 'sending', 'sent', 'scheduled')),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
revoke all on public.marketing_campaigns from public, anon, authenticated;
grant all on public.marketing_campaigns to service_role;
alter table public.marketing_campaigns enable row level security;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('marketing-campaigns', 'marketing-campaigns', true, 8388608,
  array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update set public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
create policy marketing_campaign_images_select on storage.objects
for select to authenticated using (bucket_id = 'marketing-campaigns' and ((select private.can_manage_marketing('/marketing/campanas')) or (select private.can_manage_marketing('/marketing/suscripcion'))));
create policy marketing_campaign_images_insert on storage.objects
for insert to authenticated with check (bucket_id = 'marketing-campaigns' and ((select private.can_manage_marketing('/marketing/campanas')) or (select private.can_manage_marketing('/marketing/suscripcion'))));
create policy marketing_campaign_images_delete on storage.objects
for delete to authenticated using (bucket_id = 'marketing-campaigns' and (select private.can_manage_marketing('/marketing/campanas')));

alter table public.newsletter_subscribers
  add column if not exists confirmed_at timestamptz,
  add column if not exists welcome_discount_sent_at timestamptz,
  add column if not exists marketing_synced_at timestamptz;
alter table public.newsletter_subscribers drop constraint if exists newsletter_subscribers_status_check;
alter table public.newsletter_subscribers
  add constraint newsletter_subscribers_status_check check (status in ('pending', 'active', 'unsubscribed'));

alter table public.commerce_discounts
  add column if not exists welcome_only boolean not null default false;
alter table public.commerce_discounts
  add constraint commerce_discounts_welcome_only_check
  check (not welcome_only or (discount_type = 'percentage' and value = 10));
insert into public.commerce_discounts (code, discount_type, value, valid_from, valid_until, enabled, welcome_only)
values ('BIENVENIDA10', 'percentage', 10, (now() at time zone 'America/Montevideo')::date, '2099-12-31', true, true)
on conflict (code) do nothing;
update public.commerce_discounts set welcome_only = true
where code = 'BIENVENIDA10' and discount_type = 'percentage' and value = 10;

create view public.marketing_active_offer as
select s.id, s.headline, s.description, s.image_url
from public.marketing_subscription_settings s
join public.commerce_discounts d on d.code = s.discount_code
where s.enabled and d.enabled and d.welcome_only
  and (now() at time zone 'America/Montevideo')::date between d.valid_from and d.valid_until;
revoke all on public.marketing_active_offer from public, anon, authenticated;
grant select on public.marketing_active_offer to anon, authenticated;

create view public.marketing_source_counts as
select source, status, count(*)::integer as contacts
from public.newsletter_subscribers
group by source, status;
revoke all on public.marketing_source_counts from public, anon, authenticated;
grant select on public.marketing_source_counts to service_role;

create function private.ensure_welcome_discount_eligible(p_discount public.commerce_discounts, p_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_email text;
begin
  if not p_discount.welcome_only then return; end if;
  select lower(btrim(email)) into v_email from auth.users where id = p_user_id and deleted_at is null;
  if v_email is null or not exists (
    select 1 from public.newsletter_subscribers
    where email = v_email and status = 'active' and confirmed_at is not null
  ) then raise exception 'discount:not_subscribed'; end if;
  if exists (select 1 from public.orders where user_id = p_user_id and paid_at is not null) then
    raise exception 'discount:first_purchase_only';
  end if;
end;
$$;
revoke all on function private.ensure_welcome_discount_eligible(public.commerce_discounts, uuid) from public, anon, authenticated;

create or replace function public.validate_commerce_discount(
  p_user_id uuid,
  p_code text,
  p_items_subtotal_minor bigint,
  p_design_subtotal_minor bigint
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_discount public.commerce_discounts%rowtype;
  v_today date := (now() at time zone 'America/Montevideo')::date;
begin
  if p_user_id is null then raise exception 'discount:unauthorized'; end if;

  select * into v_discount
  from public.commerce_discounts
  where code = upper(btrim(coalesce(p_code, '')));
  if not found or (v_discount.owner_user_id is not null and v_discount.owner_user_id <> p_user_id) then
    raise exception 'discount:not_found';
  end if;

  if not v_discount.enabled then raise exception 'discount:disabled'; end if;
  if v_today < v_discount.valid_from then raise exception 'discount:not_started'; end if;
  if v_today > v_discount.valid_until then raise exception 'discount:expired'; end if;
  perform private.ensure_welcome_discount_eligible(v_discount, p_user_id);

  if v_discount.redemption_limit is not null and (
    select count(*)
    from public.commerce_discount_usages usage_row
    where usage_row.discount_id = v_discount.id and usage_row.status = 'redeemed'
  ) >= v_discount.redemption_limit then
    raise exception 'discount:already_used';
  end if;

  if v_discount.redemption_limit is not null and exists (
    select 1
    from public.commerce_discount_usages usage_row
    where usage_row.discount_id = v_discount.id
      and usage_row.status = 'reserved'
      and usage_row.reserved_until > now()
  ) then
    raise exception 'discount:in_use';
  end if;

  return private.commerce_discount_result(
    v_discount,
    p_items_subtotal_minor,
    p_design_subtotal_minor
  );
end;
$$;
revoke all on function public.validate_commerce_discount(uuid, text, bigint, bigint)
from public, anon, authenticated;
grant execute on function public.validate_commerce_discount(uuid, text, bigint, bigint)
to service_role;

create or replace function public.validate_commerce_discount(
  p_user_id uuid,
  p_code text,
  p_subtotal_minor bigint
) returns jsonb
language sql
security definer
set search_path = ''
as $$
  select public.validate_commerce_discount(p_user_id, p_code, p_subtotal_minor, 0);
$$;
revoke all on function public.validate_commerce_discount(uuid, text, bigint)
from public, anon, authenticated;
grant execute on function public.validate_commerce_discount(uuid, text, bigint)
to service_role;

create or replace function public.reserve_commerce_discount(
  p_user_id uuid,
  p_code text,
  p_items_subtotal_minor bigint,
  p_design_subtotal_minor bigint,
  p_checkout_key uuid,
  p_reserved_until timestamptz
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_discount public.commerce_discounts%rowtype;
  v_usage public.commerce_discount_usages%rowtype;
  v_result jsonb;
  v_today date := (now() at time zone 'America/Montevideo')::date;
begin
  if p_user_id is null or p_checkout_key is null or p_reserved_until <= now() then
    raise exception 'discount:invalid_reservation';
  end if;

  select * into v_discount
  from public.commerce_discounts
  where code = upper(btrim(coalesce(p_code, '')))
  for update;
  if not found or (v_discount.owner_user_id is not null and v_discount.owner_user_id <> p_user_id) then
    raise exception 'discount:not_found';
  end if;

  select * into v_usage
  from public.commerce_discount_usages
  where checkout_key = p_checkout_key
  for update;
  if found then
    if v_usage.user_id <> p_user_id or v_usage.discount_id <> v_discount.id then
      raise exception 'discount:invalid_reservation';
    end if;
    v_result := private.commerce_discount_result(
      v_discount,
      p_items_subtotal_minor,
      p_design_subtotal_minor
    );
    if v_usage.discount_minor <> (v_result ->> 'discountMinor')::bigint then
      raise exception 'discount:invalid_reservation';
    end if;
    return v_result;
  end if;

  if not v_discount.enabled then raise exception 'discount:disabled'; end if;
  if v_today < v_discount.valid_from then raise exception 'discount:not_started'; end if;
  if v_today > v_discount.valid_until then raise exception 'discount:expired'; end if;
  perform private.ensure_welcome_discount_eligible(v_discount, p_user_id);

  delete from public.commerce_discount_usages usage_row
  where usage_row.discount_id = v_discount.id
    and usage_row.status = 'reserved'
    and usage_row.reserved_until <= now();

  if v_discount.redemption_limit is not null and (
    select count(*)
    from public.commerce_discount_usages usage_row
    where usage_row.discount_id = v_discount.id and usage_row.status = 'redeemed'
  ) >= v_discount.redemption_limit then
    raise exception 'discount:already_used';
  end if;

  if v_discount.redemption_limit is not null and exists (
    select 1
    from public.commerce_discount_usages usage_row
    where usage_row.discount_id = v_discount.id
      and usage_row.status = 'reserved'
      and usage_row.reserved_until > now()
  ) then
    raise exception 'discount:in_use';
  end if;

  v_result := private.commerce_discount_result(
    v_discount,
    p_items_subtotal_minor,
    p_design_subtotal_minor
  );
  insert into public.commerce_discount_usages (
    discount_id, user_id, checkout_key, status, code, discount_type,
    discount_value, discount_minor, reserved_until
  ) values (
    v_discount.id, p_user_id, p_checkout_key, 'reserved', v_discount.code,
    v_discount.discount_type, v_discount.value,
    (v_result ->> 'discountMinor')::bigint, p_reserved_until
  );

  return v_result;
end;
$$;
revoke all on function public.reserve_commerce_discount(uuid, text, bigint, bigint, uuid, timestamptz)
from public, anon, authenticated;
grant execute on function public.reserve_commerce_discount(uuid, text, bigint, bigint, uuid, timestamptz)
to service_role;

create or replace function public.reserve_commerce_discount(
  p_user_id uuid,
  p_code text,
  p_subtotal_minor bigint,
  p_checkout_key uuid,
  p_reserved_until timestamptz
) returns jsonb
language sql
security definer
set search_path = ''
as $$
  select public.reserve_commerce_discount(
    p_user_id,
    p_code,
    p_subtotal_minor,
    0,
    p_checkout_key,
    p_reserved_until
  );
$$;
revoke all on function public.reserve_commerce_discount(uuid, text, bigint, uuid, timestamptz)
from public, anon, authenticated;
grant execute on function public.reserve_commerce_discount(uuid, text, bigint, uuid, timestamptz)
to service_role;

\n