-- Solo el personal de comercio puede quitar fichas sin ventas vinculadas.
grant delete on public.local_sales_customers, public.rural_raffle_entries to authenticated;

create policy "commerce admins can delete local customers"
  on public.local_sales_customers for delete to authenticated
  using ((select private.is_commerce_admin()));

create policy "commerce admins can delete raffle entries"
  on public.rural_raffle_entries for delete to authenticated
  using ((select private.is_commerce_admin()));

create or replace function public.gestion_delete_unlinked_contact(
  p_local_id uuid default null,
  p_raffle_id uuid default null
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  local_contact public.local_sales_customers%rowtype;
  raffle_contact public.rural_raffle_entries%rowtype;
  removed integer := 0;
  changed integer;
begin
  if auth.uid() is null or not private.is_commerce_admin() then
    raise exception 'No tenés permiso para eliminar contactos.' using errcode = '42501';
  end if;
  if p_local_id is null and p_raffle_id is null then
    raise exception 'No se identificó una ficha para eliminar.';
  end if;

  if p_local_id is not null then
    select * into local_contact from public.local_sales_customers
      where id = p_local_id for update;
    if not found then raise exception 'La ficha ya no existe. Actualizá la página.'; end if;
  end if;
  if p_raffle_id is not null then
    select * into raffle_contact from public.rural_raffle_entries
      where id = p_raffle_id for update;
    if not found then raise exception 'La inscripción ya no existe. Actualizá la página.'; end if;
  end if;
  if p_local_id is not null and p_raffle_id is not null
    and lower(btrim(coalesce(local_contact.email, ''))) is distinct from lower(btrim(coalesce(raffle_contact.email, ''))) then
    raise exception 'Las fichas de origen no corresponden al mismo contacto.';
  end if;

  if p_local_id is not null and exists (
    select 1 from public.local_sales where customer_id = p_local_id
  ) then
    raise exception 'No se puede eliminar: este contacto tiene ventas vinculadas.';
  end if;
  if exists (
    select 1 from public.orders o
      where (p_local_id is not null and local_contact.source_user_id is not null and o.user_id = local_contact.source_user_id)
         or (p_local_id is not null and local_contact.email is not null and btrim(local_contact.email) <> '' and lower(btrim(o.customer_snapshot->>'email')) = lower(btrim(local_contact.email)))
         or (p_raffle_id is not null and lower(btrim(o.customer_snapshot->>'email')) = lower(btrim(raffle_contact.email)))
  ) then
    raise exception 'No se puede eliminar: este contacto tiene pedidos vinculados.';
  end if;

  if p_raffle_id is not null then
    delete from public.rural_raffle_entries where id = p_raffle_id;
    get diagnostics changed = row_count;
    if changed <> 1 then raise exception 'No se pudo eliminar la inscripción.'; end if;
    removed := removed + changed;
  end if;
  if p_local_id is not null then
    delete from public.local_sales_customers where id = p_local_id;
    get diagnostics changed = row_count;
    if changed <> 1 then raise exception 'No se pudo eliminar la ficha.'; end if;
    removed := removed + changed;
  end if;
  return removed;
end;
$$;

revoke all on function public.gestion_delete_unlinked_contact(uuid, uuid) from public, anon;
grant execute on function public.gestion_delete_unlinked_contact(uuid, uuid) to authenticated;
