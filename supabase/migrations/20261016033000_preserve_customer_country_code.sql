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
