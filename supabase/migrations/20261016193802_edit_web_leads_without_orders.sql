-- Admin-only edits for customer accounts and newsletter-only leads. Auth email
-- is intentionally immutable here; changing a login requires the Auth flow.
create or replace function public.gestion_update_web_lead(
  p_source_kind text, p_source_id uuid, p_contact jsonb
)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare changed integer;
begin
  if auth.uid() is null or not private.is_commerce_admin(auth.uid()) then
    raise exception 'No tenés permiso para editar contactos Web.' using errcode = '42501';
  end if;
  if jsonb_typeof(p_contact) <> 'object'
    or coalesce(length(p_contact->>'name'), 0) > 120
    or coalesce(length(p_contact->>'phone'), 0) > 40
    or coalesce(length(p_contact->>'company'), 0) > 120
    or coalesce(length(p_contact->>'city'), 0) > 120
    or coalesce(length(p_contact->>'address'), 0) > 180
    or coalesce(length(p_contact->>'department'), 0) > 80
    or coalesce(length(p_contact->>'postalCode'), 0) > 20 then
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
      origin_channel = coalesce(nullif(btrim(p_contact->>'originChannel'), ''), origin_channel),
      customer_type = coalesce(nullif(btrim(p_contact->>'customerType'), ''), customer_type),
      updated_at = now()
    where user_id = p_source_id;
  elsif p_source_kind = 'newsletter' then
    if coalesce(length(p_contact->>'name'), 0) > 100 then
      raise exception 'El nombre del suscriptor es demasiado largo.';
    end if;
    update public.newsletter_subscribers set
      first_name = nullif(btrim(p_contact->>'name'), ''),
      email = lower(btrim(p_contact->>'email')),
      origin_channel = coalesce(nullif(btrim(p_contact->>'originChannel'), ''), origin_channel),
      customer_type = coalesce(nullif(btrim(p_contact->>'customerType'), ''), customer_type),
      updated_at = now()
    where id = p_source_id;
  else
    raise exception 'Origen Web desconocido.';
  end if;
  get diagnostics changed = row_count;
  return changed = 1;
end;
$$;
revoke all on function public.gestion_update_web_lead(text, uuid, jsonb) from public, anon;
grant execute on function public.gestion_update_web_lead(text, uuid, jsonb) to authenticated;
