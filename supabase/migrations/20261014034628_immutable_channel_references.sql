-- References are customer-facing identifiers and must not change after insert.
create function private.prevent_channel_reference_change()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
  if new.reference_code is distinct from old.reference_code then
    raise exception 'La referencia del pedido no se puede modificar' using errcode = '22023';
  end if;
  if tg_table_name = 'local_sales' then
    if new.channel is distinct from old.channel then
      raise exception 'El canal de la venta no se puede modificar' using errcode = '22023';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function private.prevent_channel_reference_change() from public;

create trigger orders_reference_immutable
  before update on public.orders
  for each row execute function private.prevent_channel_reference_change();
create trigger local_sales_reference_immutable
  before update on public.local_sales
  for each row execute function private.prevent_channel_reference_change();
