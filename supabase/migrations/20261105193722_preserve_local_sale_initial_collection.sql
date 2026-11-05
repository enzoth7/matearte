-- A completed internal sale's initial collection is a historical payment,
-- separate from the editable article prices and later receipt rows.
create function private.preserve_local_sale_initial_collection()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if old.channel in ('Local', 'Feria', 'WhatsApp', 'Instagram', 'Facebook')
    and old.sold_on is not null
    and (new.total_minor is distinct from old.total_minor
      or new.deposit_minor is distinct from old.deposit_minor
      or new.payment_method is distinct from old.payment_method) then
    raise exception 'El cobro inicial de la venta no se puede modificar; registrá otro cobro por separado' using errcode = '22023';
  end if;
  return new;
end;
$$;

revoke all on function private.preserve_local_sale_initial_collection() from public, anon, authenticated, service_role;
create trigger orders_preserve_initial_collection
before update on public.orders
for each row execute function private.preserve_local_sale_initial_collection();

-- Preserve the RPC signature for older clients, but reject attempts to
-- rewrite the original date or payment. Article corrections still work.
do $$
declare
  definition text := pg_get_functiondef('public.gestion_update_local_sale(uuid,uuid,date,text,bigint,jsonb)'::regprocedure);
  old_text text;
  new_text text;
begin
  old_text := $old$if p_sold_on is null or p_sold_on > current_date then raise exception 'La fecha de venta no es válida' using errcode = '22023'; end if;$old$;
  new_text := $new$if p_sold_on is distinct from v_order.sold_on then raise exception 'La fecha original de la venta no se puede modificar' using errcode = '22023'; end if;$new$;
  if (length(definition)-length(replace(definition,old_text,'')))/length(old_text) <> 1 then raise exception 'Unexpected sale date validation'; end if;
  definition := replace(definition,old_text,new_text);

  old_text := $old$if p_payment_method is null or p_payment_method not in ('Efectivo', 'Débito', 'Crédito', 'Transferencia', 'Seña') then
    raise exception 'La forma de pago no es válida' using errcode = '22023';
  end if;$old$;
  new_text := old_text || E'\n' || $new$  if p_payment_method is distinct from v_order.payment_method or p_deposit_minor is distinct from v_order.deposit_minor then
    raise exception 'El cobro inicial no se puede modificar; registrá otro cobro por separado' using errcode = '22023';
  end if;$new$;
  if (length(definition)-length(replace(definition,old_text,'')))/length(old_text) <> 1 then raise exception 'Unexpected initial payment validation'; end if;
  definition := replace(definition,old_text,new_text);

  old_text := $old$if p_payment_method = 'Seña' and p_deposit_minor is null then raise exception 'El monto de la seña no es válido' using errcode = '22023'; end if;
  if p_deposit_minor is not null then
    if p_deposit_minor not between 1 and v_items_total then
      raise exception 'El monto de la seña no es válido' using errcode = '22023';
    end if;
    v_charged := p_deposit_minor;
  else
    v_charged := v_items_total;
  end if;$old$;
  new_text := $new$v_charged := v_order.total_minor;$new$;
  if (length(definition)-length(replace(definition,old_text,'')))/length(old_text) <> 1 then raise exception 'Unexpected charged amount calculation'; end if;
  definition := replace(definition,old_text,new_text);

  old_text := $old$      sold_on = p_sold_on,
      payment_method = p_payment_method,
      items_subtotal_minor = v_charged,
      total_minor = v_charged,
      deposit_minor = p_deposit_minor
  where id = p_sale_id;$old$;
  new_text := $new$      items_subtotal_minor = v_order.items_subtotal_minor
  where id = p_sale_id;$new$;
  if (length(definition)-length(replace(definition,old_text,'')))/length(old_text) <> 1 then raise exception 'Unexpected sale update'; end if;
  definition := replace(definition,old_text,new_text);

  execute definition;
end;
$$;
