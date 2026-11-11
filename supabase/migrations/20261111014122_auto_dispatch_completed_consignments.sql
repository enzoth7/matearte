-- Completar una línea mayorista consignada registra su envío en la misma transacción.
-- Vincular un pedido ya terminado también registra las unidades disponibles.
create function private.auto_dispatch_completed_consignment()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_line public.wholesale_consignment_lines%rowtype;
  v_sent integer;
  v_occurred_on date;
begin
  if tg_table_name = 'order_items' then
    if new.production_status <> 'completed' or old.production_status = 'completed' then return new; end if;
    select * into v_line from public.wholesale_consignment_lines
      where order_item_id = new.id for update;
    v_occurred_on := coalesce((new.completed_at at time zone 'America/Montevideo')::date,
      (now() at time zone 'America/Montevideo')::date);
  else
    select * into v_line from public.wholesale_consignment_lines where id = new.id for update;
    select coalesce((i.completed_at at time zone 'America/Montevideo')::date,
      (now() at time zone 'America/Montevideo')::date) into v_occurred_on
      from public.order_items i where i.id = new.order_item_id and i.production_status = 'completed';
    if not found then return new; end if;
  end if;
  if v_line.id is null then return new; end if;
  select coalesce(sum(quantity), 0) into v_sent
    from public.wholesale_consignment_movements
    where line_id = v_line.id and kind = 'dispatch';
  if v_sent < v_line.quantity then
    insert into public.wholesale_consignment_movements
      (id, line_id, kind, quantity, occurred_on, note, created_by)
    values (gen_random_uuid(), v_line.id, 'dispatch', v_line.quantity - v_sent,
      v_occurred_on, 'Envío automático al completar producción', auth.uid());
  end if;
  return new;
end;
$$;
revoke all on function private.auto_dispatch_completed_consignment() from public, anon, authenticated;

create trigger order_item_auto_dispatch_consignment
  after update of production_status on public.order_items
  for each row when (new.production_status = 'completed')
  execute function private.auto_dispatch_completed_consignment();

create trigger consignment_line_auto_dispatch_completed
  after insert on public.wholesale_consignment_lines
  for each row execute function private.auto_dispatch_completed_consignment();

-- Reconcilia las líneas completadas antes de instalar los triggers sin duplicar envíos.
insert into public.wholesale_consignment_movements
  (id, line_id, kind, quantity, occurred_on, note)
select gen_random_uuid(), l.id, 'dispatch', l.quantity - coalesce(sent.quantity, 0),
  coalesce((i.completed_at at time zone 'America/Montevideo')::date,
    (now() at time zone 'America/Montevideo')::date),
  'Envío automático al completar producción'
from public.wholesale_consignment_lines l
join public.order_items i on i.id = l.order_item_id
left join lateral (
  select sum(m.quantity) as quantity from public.wholesale_consignment_movements m
  where m.line_id = l.id and m.kind = 'dispatch'
) sent on true
where i.production_status = 'completed' and l.quantity > coalesce(sent.quantity, 0);
