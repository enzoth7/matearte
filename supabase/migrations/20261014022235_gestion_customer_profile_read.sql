-- Gestión lee únicamente fecha de nacimiento y ubicación de perfiles con pedidos.
-- El acceso general a customer_profiles conserva su política de lectura propia.
create function public.gestion_customer_profile_details(p_offset integer default 0, p_limit integer default 100)
returns table (user_id uuid, birth_date date, city text, country_code text)
language sql stable security definer set search_path = '' as $$
  select profile.user_id, profile.birth_date, profile.city, profile.country_code
  from public.customer_profiles profile
  where auth.uid() is not null
    and private.is_commerce_admin(auth.uid())
    and exists (select 1 from public.orders orders where orders.user_id = profile.user_id)
  order by profile.user_id
  limit least(greatest(p_limit, 1), 100)
  offset greatest(p_offset, 0);
$$;
revoke all on function public.gestion_customer_profile_details(integer, integer) from public, anon;
grant execute on function public.gestion_customer_profile_details(integer, integer) to authenticated;
