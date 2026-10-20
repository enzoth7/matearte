-- Instagram, Facebook and WhatsApp orders use the same retail register and
-- retail variants. Local availability applies to every sale from that register.
create or replace function private.check_local_sale_item_availability()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if exists (select 1 from public.local_sales sale where sale.id = new.sale_id)
     and not exists (select 1 from public.commerce_variants variant
                     where variant.id = new.variant_id and variant.active and variant.available_local) then
    raise exception 'La variante ya no está disponible en Local' using errcode = '22023';
  end if;
  return new;
end;
$$;
