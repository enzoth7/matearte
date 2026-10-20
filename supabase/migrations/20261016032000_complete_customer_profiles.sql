alter table public.local_sales_customers
  add column if not exists address text;

alter table public.rural_raffle_entries
  add column if not exists company_name text,
  add column if not exists address text,
  add column if not exists notes text;

grant update (address) on public.local_sales_customers to authenticated;
grant update (company_name, address, notes) on public.rural_raffle_entries to authenticated;

-- Lectura administrativa de los campos de perfil que Gestión permite editar.
create or replace function public.gestion_customer_profile_details_full(
  p_offset integer default 0,
  p_limit integer default 100
)
returns table (
  user_id uuid, birth_date date, city text, country_code text,
  company text, address_line1 text, department text, postal_code text
)
language sql stable security definer set search_path = ''
as $$
  select p.user_id, p.birth_date, p.city, p.country_code,
    p.company, p.address_line1, p.department, p.postal_code
  from public.customer_profiles p
  where auth.uid() is not null
    and private.is_commerce_admin(auth.uid())
    and exists (select 1 from public.orders o where o.user_id = p.user_id)
  order by p.user_id
  limit least(greatest(p_limit, 1), 100)
  offset greatest(p_offset, 0);
$$;

revoke all on function public.gestion_customer_profile_details_full(integer, integer) from public, anon;
grant execute on function public.gestion_customer_profile_details_full(integer, integer) to authenticated;

-- La edición Web sigue actualizando todos los pedidos mediante la función
-- existente y guarda los datos de perfil en la misma transacción.
create or replace function public.gestion_update_customer_all(
  order_ids uuid[], contact jsonb
)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  changed integer;
  profile_user_id uuid;
  details jsonb;
begin
  if auth.uid() is null or not private.is_commerce_admin(auth.uid()) then
    raise exception 'No tenés permiso para editar clientes.' using errcode = '42501';
  end if;
  if jsonb_typeof(contact) <> 'object'
    or coalesce(length(contact->>'company'), 0) > 160
    or coalesce(length(contact->>'address'), 0) > 250
    or coalesce(length(contact->>'city'), 0) > 120
    or coalesce(length(contact->>'department'), 0) > 120
    or coalesce(length(contact->>'postalCode'), 0) > 32 then
    raise exception 'Revisá los datos del perfil.';
  end if;
  select o.user_id into profile_user_id from public.orders o where o.id = order_ids[1];
  changed := public.gestion_update_customer_contact(order_ids, contact);

  details := jsonb_build_object(
    'company', coalesce(btrim(contact->>'company'), ''),
    'birthDate', coalesce(btrim(contact->>'birthDate'), ''),
    'city', coalesce(btrim(contact->>'city'), ''),
    'country', coalesce(btrim(contact->>'country'), ''),
    'address', coalesce(btrim(contact->>'address'), ''),
    'department', coalesce(btrim(contact->>'department'), ''),
    'postalCode', coalesce(btrim(contact->>'postalCode'), '')
  );
  update public.orders o
    set customer_snapshot = coalesce(o.customer_snapshot, '{}'::jsonb) || details,
        updated_at = now()
    where o.id = any(order_ids);

  if profile_user_id is not null then
    insert into public.customer_profiles (
      user_id, full_name, phone, company, birth_date, city,
      country_code, address_line1, department, postal_code
    ) values (
      profile_user_id, btrim(contact->>'name'), coalesce(btrim(contact->>'phone'), ''),
      nullif(btrim(contact->>'company'), ''), nullif(btrim(contact->>'birthDate'), '')::date,
      nullif(btrim(contact->>'city'), ''), coalesce(nullif(btrim(contact->>'countryCode'), ''), (select cp.country_code from public.customer_profiles cp where cp.user_id = profile_user_id), 'UY'),
      nullif(btrim(contact->>'address'), ''), nullif(btrim(contact->>'department'), ''),
      nullif(btrim(contact->>'postalCode'), '')
    ) on conflict (user_id) do update set
      full_name = excluded.full_name,
      phone = excluded.phone,
      company = excluded.company,
      birth_date = excluded.birth_date,
      city = excluded.city,
      country_code = excluded.country_code,
      address_line1 = excluded.address_line1,
      department = excluded.department,
      postal_code = excluded.postal_code,
      updated_at = now();
  end if;
  return changed;
end;
$$;

revoke all on function public.gestion_update_customer_all(uuid[], jsonb) from public, anon;
grant execute on function public.gestion_update_customer_all(uuid[], jsonb) to authenticated;
