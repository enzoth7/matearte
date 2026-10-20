-- Delete Web-only contacts without purchase history. Removing an account also
-- removes its Auth login; deleting only customer_profiles would leave it active.
create or replace function public.gestion_delete_unpurchased_web_lead(
  p_source_kind text, p_source_id uuid
)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  lead_email text;
  changed integer;
begin
  if auth.uid() is null or not private.is_commerce_admin(auth.uid()) then
    raise exception 'No tenés permiso para eliminar contactos Web.' using errcode = '42501';
  end if;
  if p_source_kind = 'account' then
    select lower(btrim(u.email)) into lead_email
    from auth.users u join public.customer_profiles p on p.user_id = u.id
    where u.id = p_source_id and u.deleted_at is null for update of u;
    if not found then raise exception 'La cuenta ya no existe. Actualizá la lista.'; end if;
    if exists (select 1 from public.commerce_admin_users where user_id = p_source_id)
      or exists (select 1 from public.admin_users where user_id = p_source_id) then
      raise exception 'No se puede eliminar una cuenta administrativa.';
    end if;
  elsif p_source_kind = 'newsletter' then
    select lower(btrim(n.email)) into lead_email
    from public.newsletter_subscribers n where n.id = p_source_id for update;
    if not found then raise exception 'La suscripción ya no existe. Actualizá la lista.'; end if;
    if exists (select 1 from auth.users u where lower(btrim(u.email)) = lead_email) then
      raise exception 'Este correo tiene una cuenta Web. Eliminá la ficha de la cuenta completa.';
    end if;
  else
    raise exception 'Origen Web desconocido.';
  end if;

  if exists (select 1 from public.orders o where
    (p_source_kind = 'account' and o.user_id = p_source_id)
    or lower(btrim(o.customer_snapshot->>'email')) = lead_email)
    or exists (select 1 from public.local_sales_customers c
      join public.local_sales s on s.customer_id = c.id
      where c.source_user_id = p_source_id or lower(btrim(c.email)) = lead_email)
  then
    raise exception 'No se puede eliminar: este contacto tiene compras vinculadas.';
  end if;
  if p_source_kind = 'account' then
    if exists (select 1 from public.local_sales_customers c
      where c.source_user_id = p_source_id or lower(btrim(c.email)) = lead_email)
      or exists (select 1 from public.designs where user_id = p_source_id)
      or exists (select 1 from public.commerce_discounts where owner_user_id = p_source_id)
    then
      raise exception 'Este contacto tiene otros datos vinculados. No se borró la cuenta.';
    end if;
    -- Cascades remove the profile, sessions and uncompleted carts. Restrictive
    -- foreign keys preserve orders and other financial records as a backstop.
    delete from auth.users where id = p_source_id;
    get diagnostics changed = row_count;
    if changed <> 1 then raise exception 'No se pudo eliminar la cuenta.'; end if;
    delete from public.newsletter_subscribers where lower(btrim(email)) = lead_email;
  else
    delete from public.newsletter_subscribers where id = p_source_id;
    get diagnostics changed = row_count;
    if changed <> 1 then raise exception 'No se pudo eliminar la suscripción.'; end if;
  end if;
  return true;
end;
$$;
revoke all on function public.gestion_delete_unpurchased_web_lead(text, uuid) from public, anon;
grant execute on function public.gestion_delete_unpurchased_web_lead(text, uuid) to authenticated;
