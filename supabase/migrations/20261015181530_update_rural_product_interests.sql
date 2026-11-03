-- Keep the campaign's product-interest options aligned in the website and database.
update public.rural_raffle_entries
set product_interest = 'otros-articulos-cuero'
where product_interest in ('regalos-empresariales', 'otro');

alter table public.rural_raffle_entries
  drop constraint if exists rural_raffle_entries_product_interest_check;

alter table public.rural_raffle_entries
  add constraint rural_raffle_entries_product_interest_check
  check (product_interest in (
    'mates',
    'bombillas',
    'materas',
    'termos',
    'personalizados',
    'botas',
    'carteras',
    'otros-articulos-cuero'
  ));

-- Gestión can read campaign contacts, but only through an active admin session.
grant select on public.rural_raffle_entries to authenticated;

drop policy if exists rural_raffle_entries_management_read on public.rural_raffle_entries;
create policy rural_raffle_entries_management_read
on public.rural_raffle_entries
for select
to authenticated
using (
  (select private.is_pricing_admin())
  or (select private.is_commerce_admin())
);
