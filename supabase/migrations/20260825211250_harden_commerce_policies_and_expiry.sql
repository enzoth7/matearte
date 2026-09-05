create index auth_handoffs_user_idx on public.auth_handoffs (user_id);
create index design_assets_design_user_idx on public.design_assets (design_id, user_id);
create index if not exists order_lines_customer_idx on public.order_lines (customer);

-- Explicit deny policies document that these tables are backend-only.
create policy auth_handoffs_backend_only on public.auth_handoffs for all to anon, authenticated using (false) with check (false);
create policy payment_webhook_events_backend_only on public.payment_webhook_events for all to anon, authenticated using (false) with check (false);

-- Avoid overlapping SELECT policies while preserving the same admin capabilities.
drop policy products_admin_write on public.commerce_products;
create policy products_admin_insert on public.commerce_products for insert to authenticated with check ((select private.is_commerce_admin()));
create policy products_admin_update on public.commerce_products for update to authenticated using ((select private.is_commerce_admin())) with check ((select private.is_commerce_admin()));
create policy products_admin_delete on public.commerce_products for delete to authenticated using ((select private.is_commerce_admin()));

drop policy variants_admin_write on public.commerce_variants;
create policy variants_admin_insert on public.commerce_variants for insert to authenticated with check ((select private.is_commerce_admin()));
create policy variants_admin_update on public.commerce_variants for update to authenticated using ((select private.is_commerce_admin())) with check ((select private.is_commerce_admin()));
create policy variants_admin_delete on public.commerce_variants for delete to authenticated using ((select private.is_commerce_admin()));

drop policy shipping_admin_write on public.shipping_rates;
create policy shipping_admin_insert on public.shipping_rates for insert to authenticated with check ((select private.is_commerce_admin()));
create policy shipping_admin_update on public.shipping_rates for update to authenticated using ((select private.is_commerce_admin())) with check ((select private.is_commerce_admin()));
create policy shipping_admin_delete on public.shipping_rates for delete to authenticated using ((select private.is_commerce_admin()));

create or replace function public.expire_pending_commerce_orders()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order record;
  v_released integer := 0;
begin
  for v_order in
    select id from public.orders
    where status = 'pending_payment' and reservation_expires_at < now()
    order by reservation_expires_at
    for update skip locked
  loop
    update public.orders set status = 'cancelled', cancelled_at = now() where id = v_order.id;
    v_released := v_released + 1;
  end loop;
  return v_released;
end;
$$;
revoke all on function public.expire_pending_commerce_orders() from public, anon, authenticated;
grant execute on function public.expire_pending_commerce_orders() to service_role;
