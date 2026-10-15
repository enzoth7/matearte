-- Edición atómica de contactos; conserva cada versión anterior y respeta las políticas de Commerce.
create table public.gestion_customer_contact_history (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders(id),
  previous_contact jsonb not null,
  next_contact jsonb not null,
  changed_by uuid not null,
  changed_at timestamptz not null default now()
);
alter table public.gestion_customer_contact_history enable row level security;
create policy contact_history_admin_read on public.gestion_customer_contact_history for select to authenticated
using (exists(select 1 from public.commerce_admin_users a where a.user_id=(select auth.uid()) and a.active));
create policy contact_history_admin_insert on public.gestion_customer_contact_history for insert to authenticated
with check (changed_by=(select auth.uid()) and exists(select 1 from public.commerce_admin_users a where a.user_id=(select auth.uid()) and a.active));
grant select, insert on public.gestion_customer_contact_history to authenticated;
grant usage, select on sequence public.gestion_customer_contact_history_id_seq to authenticated;
create index gestion_contact_history_order_idx on public.gestion_customer_contact_history(order_id);
create function public.gestion_update_customer_contact(order_ids uuid[], contact jsonb)
returns integer language plpgsql security invoker set search_path = '' as $$
declare
  updated_count integer := 0;
  expected_count integer;
  row_record record;
  patch jsonb;
  anchor_user uuid;
  anchor_email text;
begin
  if not exists(select 1 from public.commerce_admin_users a where a.user_id=auth.uid() and a.active) then
    raise exception 'No tenés permiso para editar clientes.' using errcode='42501';
  end if;
  select count(distinct item) into expected_count from unnest(order_ids) item;
  if expected_count=0 or expected_count>10000 then raise exception 'Seleccioná los pedidos del cliente.'; end if;
  if jsonb_typeof(contact) <> 'object' or coalesce(length(trim(contact->>'name')),0) < 2
    or coalesce(length(trim(contact->>'email')),0) < 3
    or length(contact->>'name')>200 or length(contact->>'email')>320 or length(contact->>'phone')>80 then
    raise exception 'Revisá el nombre, correo y teléfono.';
  end if;
  select user_id, lower(trim(customer_snapshot->>'email')) into anchor_user,anchor_email from public.orders where id=order_ids[1];
  patch := jsonb_build_object('fullName',trim(contact->>'name'),'full_name',trim(contact->>'name'),'name',trim(contact->>'name'),'email',trim(contact->>'email'),'phone',coalesce(trim(contact->>'phone'),''));
  for row_record in select id,user_id,customer_snapshot from public.orders where id=any(order_ids) order by id for update loop
    if anchor_user is not null then
      if row_record.user_id is distinct from anchor_user then raise exception 'Los pedidos pertenecen a diferentes clientes.'; end if;
    elsif row_record.user_id is not null or (expected_count>1 and (coalesce(anchor_email,'')='' or lower(trim(row_record.customer_snapshot->>'email')) is distinct from anchor_email)) then
      raise exception 'Los pedidos pertenecen a diferentes clientes.';
    end if;
    insert into public.gestion_customer_contact_history(order_id,previous_contact,next_contact,changed_by)
      values(row_record.id,row_record.customer_snapshot,coalesce(row_record.customer_snapshot,'{}'::jsonb)||patch,auth.uid());
    update public.orders set customer_snapshot=coalesce(customer_snapshot,'{}'::jsonb)||patch,updated_at=now() where id=row_record.id;
    if not found then raise exception 'No se pudo actualizar el contacto.'; end if;
    updated_count := updated_count+1;
  end loop;
  if updated_count <> expected_count then raise exception 'Algún pedido dejó de estar disponible. Actualizá e intentá nuevamente.'; end if;
  return updated_count;
end;
$$;
revoke all on function public.gestion_update_customer_contact(uuid[],jsonb) from public,anon;
grant execute on function public.gestion_update_customer_contact(uuid[],jsonb) to authenticated;
