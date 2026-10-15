-- Retire the generic channel after verifying that no sale uses it.
do $$
begin
  if exists (select 1 from public.local_sales where channel = 'Redes Sociales') then
    raise exception 'Hay ventas con el canal genérico; clasificarlas antes de retirarlo';
  end if;
end;
$$;

drop function if exists public.create_social_sale_with_items(uuid, date, text, jsonb, bigint);

alter table public.local_sales drop constraint local_sales_channel_check;
alter table public.local_sales add constraint local_sales_channel_check
  check (channel in ('Local', 'Instagram', 'Facebook', 'WhatsApp'));

create or replace function private.assign_local_sale_reference()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_number bigint;
  v_prefix text;
begin
  if new.channel in ('Instagram', 'Facebook', 'WhatsApp') then
    v_number := nextval('private.matearte_social_reference_seq'::regclass);
    v_prefix := 'R';
  elsif new.channel = 'Local' then
    v_number := nextval('private.matearte_local_reference_seq'::regclass);
    v_prefix := 'L';
  else
    raise exception 'El canal no es válido' using errcode = '22023';
  end if;
  new.reference_code := '#' || v_prefix ||
    lpad(v_number::text, greatest(3, length(v_number::text)), '0');
  return new;
end;
$$;
