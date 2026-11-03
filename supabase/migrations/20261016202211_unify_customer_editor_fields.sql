-- Every customer origin keeps its own legacy table, but Gestion can edit the
-- same contact fields in each one without dropping source-specific data.
alter table public.customers
  add column if not exists department text,
  add column if not exists postal_code text,
  add column if not exists additional_phones text[] not null default '{}',
  add column if not exists inferred_category text,
  add column if not exists product_interest text;
alter table public.local_sales_customers
  add column if not exists department text,
  add column if not exists postal_code text,
  add column if not exists product_interest text;
alter table public.rural_raffle_entries
  add column if not exists department text,
  add column if not exists postal_code text,
  add column if not exists additional_phones text[] not null default '{}',
  add column if not exists inferred_category text;
alter table public.customer_profiles
  add column if not exists notes text,
  add column if not exists additional_phones text[] not null default '{}',
  add column if not exists inferred_category text,
  add column if not exists product_interest text;
alter table public.newsletter_subscribers
  add column if not exists phone text,
  add column if not exists company text,
  add column if not exists birth_date date,
  add column if not exists city text,
  add column if not exists country_code text,
  add column if not exists department text,
  add column if not exists postal_code text,
  add column if not exists address text,
  add column if not exists notes text,
  add column if not exists additional_phones text[] not null default '{}',
  add column if not exists inferred_category text,
  add column if not exists product_interest text;

grant update (department, postal_code, product_interest) on public.local_sales_customers to authenticated;
grant update (department, postal_code, additional_phones, inferred_category) on public.rural_raffle_entries to authenticated;

drop function if exists public.gestion_web_leads(integer, integer);
create function public.gestion_web_leads(p_offset integer default 0, p_limit integer default 100)
returns table (
  source_kind text, source_id text, full_name text, email text, phone text,
  city text, country_code text, birth_date date, company text,
  origin_channel text, customer_type text, created_at timestamptz,
  address text, department text, postal_code text, notes text,
  additional_phones text[], inferred_category text, product_interest text
)
language sql stable security definer set search_path = ''
as $$
  select * from (
    select 'account'::text, p.user_id::text, nullif(btrim(p.full_name), ''),
      lower(btrim(u.email)), p.phone, p.city, p.country_code, p.birth_date,
      p.company, p.origin_channel, p.customer_type, p.created_at,
      p.address_line1, p.department, p.postal_code, p.notes,
      p.additional_phones, p.inferred_category, p.product_interest
    from public.customer_profiles p join auth.users u on u.id = p.user_id
    where u.deleted_at is null and u.email is not null
      and not exists (select 1 from public.commerce_admin_users a where a.user_id = p.user_id and a.active)
    union all
    select 'newsletter'::text, n.id::text, nullif(btrim(n.first_name), ''),
      n.email, n.phone, n.city, n.country_code, n.birth_date,
      n.company, n.origin_channel, n.customer_type, n.created_at,
      n.address, n.department, n.postal_code, n.notes,
      n.additional_phones, n.inferred_category, n.product_interest
    from public.newsletter_subscribers n
  ) leads(source_kind, source_id, full_name, email, phone, city, country_code,
          birth_date, company, origin_channel, customer_type, created_at,
          address, department, postal_code, notes, additional_phones,
          inferred_category, product_interest)
  where auth.uid() is not null and private.is_commerce_admin(auth.uid())
  order by created_at, source_kind, source_id
  limit least(greatest(p_limit, 1), 100) offset greatest(p_offset, 0);
$$;
revoke all on function public.gestion_web_leads(integer, integer) from public, anon;
grant execute on function public.gestion_web_leads(integer, integer) to authenticated;

create or replace function public.gestion_update_web_lead(p_source_kind text, p_source_id uuid, p_contact jsonb)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare changed integer;
begin
  if auth.uid() is null or not private.is_commerce_admin(auth.uid()) then
    raise exception 'No tenés permiso para editar contactos Web.' using errcode = '42501';
  end if;
  if jsonb_typeof(p_contact) <> 'object'
    or coalesce(length(p_contact->>'name'), 0) > 120
    or coalesce(length(p_contact->>'email'), 0) > 320
    or coalesce(length(p_contact->>'phone'), 0) > 40
    or coalesce(length(p_contact->>'company'), 0) > 160
    or coalesce(length(p_contact->>'city'), 0) > 120
    or coalesce(length(p_contact->>'address'), 0) > 250
    or coalesce(length(p_contact->>'department'), 0) > 120
    or coalesce(length(p_contact->>'postalCode'), 0) > 32
    or coalesce(length(p_contact->>'notes'), 0) > 2000
    or (p_contact ? 'additionalPhones' and jsonb_typeof(p_contact->'additionalPhones') <> 'array') then
    raise exception 'Revisá los datos del contacto.';
  end if;
  if p_source_kind = 'account' then
    if not exists (select 1 from auth.users u where u.id = p_source_id
      and lower(btrim(u.email)) = lower(btrim(p_contact->>'email'))) then
      raise exception 'El correo de acceso no se puede cambiar desde esta ficha.';
    end if;
    update public.customer_profiles set
      full_name = coalesce(btrim(p_contact->>'name'), ''),
      phone = nullif(btrim(p_contact->>'phone'), ''),
      company = nullif(btrim(p_contact->>'company'), ''),
      birth_date = nullif(btrim(p_contact->>'birthDate'), '')::date,
      city = nullif(btrim(p_contact->>'city'), ''),
      country_code = coalesce(nullif(btrim(p_contact->>'countryCode'), ''), country_code),
      address_line1 = nullif(btrim(p_contact->>'address'), ''),
      department = nullif(btrim(p_contact->>'department'), ''),
      postal_code = nullif(btrim(p_contact->>'postalCode'), ''),
      notes = nullif(btrim(p_contact->>'notes'), ''),
      additional_phones = case when p_contact ? 'additionalPhones' then array(select jsonb_array_elements_text(p_contact->'additionalPhones')) else additional_phones end,
      inferred_category = nullif(btrim(p_contact->>'inferredCategory'), ''),
      product_interest = nullif(btrim(p_contact->>'productInterest'), ''),
      origin_channel = coalesce(nullif(btrim(p_contact->>'originChannel'), ''), origin_channel),
      customer_type = coalesce(nullif(btrim(p_contact->>'customerType'), ''), customer_type), updated_at = now()
    where user_id = p_source_id;
  elsif p_source_kind = 'newsletter' then
    if coalesce(length(p_contact->>'name'), 0) > 100 then raise exception 'El nombre del suscriptor es demasiado largo.'; end if;
    update public.newsletter_subscribers set
      first_name = nullif(btrim(p_contact->>'name'), ''), email = lower(btrim(p_contact->>'email')),
      phone = nullif(btrim(p_contact->>'phone'), ''), company = nullif(btrim(p_contact->>'company'), ''),
      birth_date = nullif(btrim(p_contact->>'birthDate'), '')::date,
      city = nullif(btrim(p_contact->>'city'), ''), country_code = nullif(btrim(p_contact->>'countryCode'), ''),
      department = nullif(btrim(p_contact->>'department'), ''),
      postal_code = nullif(btrim(p_contact->>'postalCode'), ''), address = nullif(btrim(p_contact->>'address'), ''),
      notes = nullif(btrim(p_contact->>'notes'), ''),
      additional_phones = case when p_contact ? 'additionalPhones' then array(select jsonb_array_elements_text(p_contact->'additionalPhones')) else additional_phones end,
      inferred_category = nullif(btrim(p_contact->>'inferredCategory'), ''),
      product_interest = nullif(btrim(p_contact->>'productInterest'), ''),
      origin_channel = coalesce(nullif(btrim(p_contact->>'originChannel'), ''), origin_channel),
      customer_type = coalesce(nullif(btrim(p_contact->>'customerType'), ''), customer_type), updated_at = now()
    where id = p_source_id;
  else raise exception 'Origen Web desconocido.';
  end if;
  get diagnostics changed = row_count;
  return changed = 1;
end;
$$;
revoke all on function public.gestion_update_web_lead(text, uuid, jsonb) from public, anon;
grant execute on function public.gestion_update_web_lead(text, uuid, jsonb) to authenticated;

create or replace function public.gestion_update_customer_all(order_ids uuid[], contact jsonb)
returns integer language plpgsql security definer set search_path = ''
as $$
declare changed integer; profile_user_id uuid; details jsonb;
begin
  if auth.uid() is null or not private.is_commerce_admin(auth.uid()) then
    raise exception 'No tenés permiso para editar clientes.' using errcode = '42501';
  end if;
  if jsonb_typeof(contact) <> 'object'
    or coalesce(length(contact->>'company'), 0) > 160
    or coalesce(length(contact->>'address'), 0) > 250
    or coalesce(length(contact->>'city'), 0) > 120
    or coalesce(length(contact->>'department'), 0) > 120
    or coalesce(length(contact->>'postalCode'), 0) > 32
    or coalesce(length(contact->>'notes'), 0) > 2000
    or (contact ? 'additionalPhones' and jsonb_typeof(contact->'additionalPhones') <> 'array') then
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
    'postalCode', coalesce(btrim(contact->>'postalCode'), ''),
    'notes', coalesce(btrim(contact->>'notes'), ''),
    'additionalPhones', coalesce(contact->'additionalPhones', '[]'::jsonb),
    'inferredCategory', coalesce(btrim(contact->>'inferredCategory'), ''),
    'productInterest', coalesce(btrim(contact->>'productInterest'), '')
  );
  update public.orders o set customer_snapshot = coalesce(o.customer_snapshot, '{}'::jsonb) || details,
    updated_at = now() where o.id = any(order_ids);
  if profile_user_id is not null then
    insert into public.customer_profiles (
      user_id, full_name, phone, company, birth_date, city, country_code,
      address_line1, department, postal_code, notes, additional_phones,
      inferred_category, product_interest
    ) values (
      profile_user_id, btrim(contact->>'name'), coalesce(btrim(contact->>'phone'), ''),
      nullif(btrim(contact->>'company'), ''), nullif(btrim(contact->>'birthDate'), '')::date,
      nullif(btrim(contact->>'city'), ''),
      coalesce(nullif(btrim(contact->>'countryCode'), ''), (select cp.country_code from public.customer_profiles cp where cp.user_id = profile_user_id), 'UY'),
      nullif(btrim(contact->>'address'), ''), nullif(btrim(contact->>'department'), ''),
      nullif(btrim(contact->>'postalCode'), ''), nullif(btrim(contact->>'notes'), ''),
      array(select jsonb_array_elements_text(coalesce(contact->'additionalPhones', '[]'::jsonb))),
      nullif(btrim(contact->>'inferredCategory'), ''), nullif(btrim(contact->>'productInterest'), '')
    ) on conflict (user_id) do update set
      full_name = excluded.full_name, phone = excluded.phone, company = excluded.company,
      birth_date = excluded.birth_date, city = excluded.city, country_code = excluded.country_code,
      address_line1 = excluded.address_line1, department = excluded.department,
      postal_code = excluded.postal_code, notes = excluded.notes,
      additional_phones = excluded.additional_phones, inferred_category = excluded.inferred_category,
      product_interest = excluded.product_interest, updated_at = now();
  end if;
  return changed;
end;
$$;
revoke all on function public.gestion_update_customer_all(uuid[], jsonb) from public, anon;
grant execute on function public.gestion_update_customer_all(uuid[], jsonb) to authenticated;
