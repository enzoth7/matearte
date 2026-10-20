-- A cart can remain open after Web is disabled. Recheck at the final order
-- insert, including paths that do not use the current checkout UI.
create or replace function private.check_web_order_item_availability()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if new.item_type = 'catalog' and not exists (
    select 1 from public.commerce_variants variant
    join public.commerce_products product on product.id = variant.product_id
    where variant.id = new.source_variant_id
      and variant.active and variant.available_web and product.published
  ) then
    raise exception 'La variante ya no está disponible en la web' using errcode = '22023';
  end if;
  return new;
end;
$$;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'web_order_item_channel_availability' and tgrelid = 'public.order_items'::regclass) then
    create trigger web_order_item_channel_availability before insert on public.order_items
    for each row execute function private.check_web_order_item_availability();
  end if;
end $$;
