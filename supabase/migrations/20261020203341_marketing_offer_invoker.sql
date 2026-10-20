-- The public offer view must honor the querying role's permissions and RLS.
grant select (code, enabled, welcome_only, valid_from, valid_until)
on public.commerce_discounts to anon;

create policy commerce_discounts_public_welcome_read on public.commerce_discounts
for select to anon, authenticated
using (
  welcome_only and enabled and exists (
    select 1 from public.marketing_subscription_settings s
    where s.id and s.enabled and s.discount_code = code
  )
);

alter view public.marketing_active_offer set (security_invoker = true);
