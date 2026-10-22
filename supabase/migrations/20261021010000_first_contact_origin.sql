-- El origen de una persona es el primer canal por el que entró. Sumarse después a un sorteo,
-- suscribirse o pedir un descuento no lo cambia. Marketing y Clientes leen el mismo cálculo.
--
-- Excepción deliberada: al suscribirse con el descuento de bienvenida se crea una cuenta web en el
-- mismo momento. Esa cuenta es parte de la misma entrada, así que se cuenta como "Suscripción con desc.".
create or replace view public.marketing_contact_directory as
with raw_contacts as (
  select 'account:' || u.id::text as source_id, nullif(trim(p.full_name), '') as name,
    nullif(lower(trim(u.email)), '') as email, nullif(trim(p.phone), '') as phone,
    coalesce(nullif(p.origin_channel, ''), 'Web') as source,
    u.created_at,
    case
      when coalesce(nullif(p.origin_channel, ''), 'Web') = 'Web' and exists (
        select 1 from public.newsletter_subscribers w
        where lower(trim(w.email)) = lower(trim(u.email)) and w.origin_channel = 'Suscripción con desc.'
          and w.created_at between u.created_at - interval '1 hour' and u.created_at + interval '1 hour'
      ) then u.created_at + interval '1 hour'
      else u.created_at
    end as entered_at,
    1 as priority, true as has_account
  from auth.users u
  left join public.customer_profiles p on p.user_id = u.id
  left join public.commerce_admin_users staff on staff.user_id = u.id and staff.active
  where staff.user_id is null
  union all
  select 'newsletter:' || n.id::text, nullif(trim(n.first_name), ''),
    nullif(lower(trim(n.email)), ''), nullif(trim(n.phone), ''),
    n.origin_channel, n.created_at, n.created_at, 2, false
  from public.newsletter_subscribers n
  union all
  select 'local:' || l.id::text, nullif(trim(l.full_name), ''),
    nullif(lower(trim(l.email)), ''), nullif(trim(l.phone), ''),
    coalesce(nullif(l.origin_channel, ''), 'Local'), l.created_at, l.created_at, 3, false
  from public.local_sales_customers l
  union all
  select 'raffle:' || r.id::text, nullif(trim(r.full_name), ''),
    nullif(lower(trim(r.email)), ''), nullif(trim(r.phone), ''),
    coalesce(nullif(r.origin_channel, ''), nullif(r.source, ''), 'Sorteo'),
    r.created_at, r.created_at, 4, false
  from public.rural_raffle_entries r
), keyed as (
  select *, case
    when email is not null then 'email:' || email
    else 'phone:' || regexp_replace(phone, '[^0-9]+', '', 'g')
  end as contact_key
  from raw_contacts
  where email is not null or phone is not null
), merged as (
  select contact_key as id,
    (array_agg(name order by priority, created_at) filter (where name is not null))[1] as name,
    (array_agg(email order by priority, created_at) filter (where email is not null))[1] as email,
    (array_agg(phone order by priority, created_at) filter (where phone is not null))[1] as phone,
    (array_agg(source order by entered_at, priority) filter (where source is not null))[1] as source,
    min(created_at) as created_at,
    bool_or(has_account) as has_account
  from keyed group by contact_key
)
select m.*, coalesce(n.status, 'none') as subscription_status
from merged m
left join public.newsletter_subscribers n on lower(n.email) = m.email;

revoke all on public.marketing_contact_directory from public, anon, authenticated;
grant select on public.marketing_contact_directory to service_role;

-- Gestión (Clientes) lee el mismo origen. Solo administradores del comercio.
create or replace function public.gestion_contact_origins()
returns table (contact_key text, origin text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (select private.is_commerce_admin()) then
    raise exception 'Sin acceso.' using errcode = '42501';
  end if;
  return query select d.id, d.source from public.marketing_contact_directory d;
end;
$$;
revoke all on function public.gestion_contact_origins() from public, anon;
grant execute on function public.gestion_contact_origins() to authenticated;
