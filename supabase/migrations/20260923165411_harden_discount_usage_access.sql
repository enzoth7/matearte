-- Make backend-only access explicit and cover discount foreign keys used by
-- cleanup, account history and order reconciliation.

drop policy if exists commerce_discount_usages_backend_only
on public.commerce_discount_usages;

create policy commerce_discount_usages_backend_only
on public.commerce_discount_usages
for all
to anon, authenticated
using (false)
with check (false);

create index if not exists commerce_discount_usages_user_idx
  on public.commerce_discount_usages (user_id);

create index if not exists orders_discount_id_idx
  on public.orders (discount_id)
  where discount_id is not null;
