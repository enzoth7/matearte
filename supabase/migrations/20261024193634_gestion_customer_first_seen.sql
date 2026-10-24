-- Read the first recorded appearance of each contact without exposing the
-- marketing directory to ordinary signed-in users.
create or replace function public.gestion_customer_first_seen(p_offset integer default 0, p_limit integer default 500)
returns table (contact_key text, first_seen_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not private.is_commerce_admin(auth.uid()) then
    raise exception 'Sin acceso.' using errcode = '42501';
  end if;

  return query
    select d.id, d.created_at
    from public.marketing_contact_directory d
    order by d.id
    limit least(greatest(p_limit, 1), 500) offset greatest(p_offset, 0);
end;
$$;

revoke all on function public.gestion_customer_first_seen(integer, integer) from public, anon;
grant execute on function public.gestion_customer_first_seen(integer, integer) to authenticated;
