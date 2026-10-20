-- Account contacts are visible before their first order, so their editable
-- address fields must be available before their first order as well.
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
  where auth.uid() is not null and private.is_commerce_admin(auth.uid())
  order by p.user_id
  limit least(greatest(p_limit, 1), 100)
  offset greatest(p_offset, 0);
$$;
