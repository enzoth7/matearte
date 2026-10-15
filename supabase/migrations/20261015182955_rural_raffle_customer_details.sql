-- Keep existing entries valid while new signups collect the full customer details.
alter table public.rural_raffle_entries
  add column full_name text
    check (full_name is null or (full_name = btrim(full_name) and char_length(full_name) between 2 and 120)),
  add column city text
    check (city is null or (city = btrim(city) and char_length(city) between 1 and 120)),
  add column country text
    check (country is null or (country = btrim(country) and char_length(country) between 1 and 120)),
  add column birth_date date
    check (birth_date is null or (birth_date between date '1900-01-01' and current_date));

-- Only active administrators can edit participant contact details in Gestión.
grant update (full_name, email, phone, city, country, birth_date, product_interest)
  on public.rural_raffle_entries to authenticated;

create policy rural_raffle_entries_management_update
on public.rural_raffle_entries
for update
to authenticated
using (
  (select private.is_pricing_admin())
  or (select private.is_commerce_admin())
)
with check (
  (select private.is_pricing_admin())
  or (select private.is_commerce_admin())
);
