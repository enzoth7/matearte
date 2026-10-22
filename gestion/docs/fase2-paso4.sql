-- Fase 2, paso 4: seguridad de cotizaciones y envíos, una sola tabla de administradores y tipo de cambio ARS unificado.
-- Todo en una transacción; la verificación final deshace todo si algo no cuadra.

-- 0) Guardas.
do $$
begin
  if (select count(*) from public.admin_users) <> 1
     or not exists (select 1 from public.admin_users a join public.commerce_admin_users c on c.user_id = a.user_id)
     or (select count(*) from public.settings) <> 1
     or exists (select 1 from public.commerce_exchange_rates where currency_code = 'ARS') then
    raise exception 'El estado de partida no coincide con el relevado';
  end if;
end $$;

-- 1) Seguridad: cotizaciones y tarifas internacionales solo las cambian administradores (antes, cualquier cuenta de cliente).
drop policy "Exchange rates can be inserted by authenticated users" on public.commerce_exchange_rates;
drop policy "Exchange rates can be updated by authenticated users" on public.commerce_exchange_rates;
create policy exchange_rates_admin_insert on public.commerce_exchange_rates for insert to authenticated
  with check ((select private.is_commerce_admin()));
create policy exchange_rates_admin_update on public.commerce_exchange_rates for update to authenticated
  using ((select private.is_commerce_admin())) with check ((select private.is_commerce_admin()));
revoke insert, update, delete, truncate, trigger, references on public.commerce_exchange_rates from anon;

drop policy "International shipping rates editable by authenticated" on public.commerce_international_shipping_rates;
create policy international_shipping_admin_write on public.commerce_international_shipping_rates for all to authenticated
  using ((select private.is_commerce_admin())) with check ((select private.is_commerce_admin()));
revoke insert, update, delete, truncate, trigger, references on public.commerce_international_shipping_rates from anon;

-- 2) Una sola tabla de administradores: el permiso de precios pasa a commerce_admin_users.
alter table public.commerce_admin_users add column if not exists can_manage_pricing boolean not null default false;
update public.commerce_admin_users c set can_manage_pricing = true
from public.admin_users a where a.user_id = c.user_id and a.active;

create or replace function private.is_pricing_admin() returns boolean language sql stable security definer set search_path = '' as $f$
  select exists (
    select 1 from public.commerce_admin_users
    where user_id = (select auth.uid()) and active and can_manage_pricing
  );
$f$;

alter table public.admin_users set schema private;
alter table private.admin_users rename to legacy_admin_users_20261022;

-- Vista compatible (la lee localventas para saber si la sesión administra precios).
create view public.admin_users with (security_invoker = true) as
select c.user_id, coalesce(c.display_name, '') as username, c.active, c.created_at
from public.commerce_admin_users c
where c.can_manage_pricing;
revoke all on public.admin_users from public, anon;
grant select on public.admin_users to authenticated;

-- 3) Tipo de cambio ARS junto a USD y BRL; settings queda como vista editable (gestión la sigue usando igual).
insert into public.commerce_exchange_rates (currency_code, rate_to_uyu, updated_at)
select 'ARS', s.exchange_rate, now() from public.settings s where s.id = 1;

alter table public.settings set schema private;
alter table private.settings rename to legacy_settings_20261022;

create view public.settings with (security_invoker = true) as
select 1 as id, r.rate_to_uyu as exchange_rate, 'commerce_exchange_rates'::text as source, r.updated_at as generated_at
from public.commerce_exchange_rates r
where r.currency_code = 'ARS';
revoke all on public.settings from public, anon;
grant select, update on public.settings to authenticated;

notify pgrst, 'reload schema';

-- 4) Verificación.
do $$
declare r record;
begin
  select
    (select count(*) from public.commerce_admin_users where can_manage_pricing) admins_precios,
    (select count(*) from public.admin_users) vista_admin,
    (select rate_to_uyu from public.commerce_exchange_rates where currency_code = 'ARS') ars,
    (select exchange_rate from private.legacy_settings_20261022 where id = 1) ars_antes,
    (select exchange_rate from public.settings where id = 1) vista_settings,
    (select count(*) from pg_policies where tablename = 'commerce_exchange_rates' and coalesce(qual, '') || coalesce(with_check, '') ~ 'auth\.role\(\)') reglas_viejas_cotizacion,
    (select count(*) from pg_policies where tablename = 'commerce_international_shipping_rates' and coalesce(qual, '') || coalesce(with_check, '') ~ 'auth\.role\(\)') reglas_viejas_envio
  into r;
  if r.admins_precios <> 1 or r.vista_admin <> 1 or r.ars <> r.ars_antes or r.vista_settings <> r.ars_antes
     or r.reglas_viejas_cotizacion <> 0 or r.reglas_viejas_envio <> 0 then
    raise exception 'La verificación no cuadra: %', row_to_json(r);
  end if;
  raise notice 'Verificación OK: %', row_to_json(r);
end $$;
