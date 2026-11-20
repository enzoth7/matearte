alter table public.commercial_opportunities
  drop constraint commercial_opportunities_estado_check,
  add constraint commercial_opportunities_estado_check
  check (estado in ('Sin contactar','En preparación','Contactada','No hubo respuesta','Baja'));

create function private.gestion_editar_estado_oportunidad(
  p_id uuid, p_estado_anterior text, p_estado text
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  fila public.commercial_opportunities;
begin
  if auth.uid() is null or not private.gestion_has_page_access('/comercial/consultas')
    or private.gestion_is_oauth_session() then
    raise insufficient_privilege using message='Se requiere acceso a Consultas y oportunidades en Gestión.';
  end if;
  if p_estado is null or p_estado not in ('Sin contactar','Contactada','No hubo respuesta') then
    raise invalid_parameter_value using message='Elegí un estado válido.';
  end if;
  select * into strict fila from public.commercial_opportunities where id=p_id for update;
  if fila.estado in ('En preparación','Baja') then
    raise invalid_parameter_value using message='La oportunidad tiene una reserva de envío o una baja.';
  end if;
  if fila.estado <> p_estado then
    if fila.estado is distinct from p_estado_anterior then
      raise serialization_failure using message='El estado cambió. Volvé a elegir después de actualizar.';
    end if;
    update public.commercial_opportunities
      set estado=p_estado,
          contactada_en=case when p_estado='Sin contactar' and fila.referencia_correo is null then null
                             when p_estado='Sin contactar' then fila.contactada_en
                             else coalesce(fila.contactada_en, now()) end
      where id=p_id returning * into fila;
  end if;
  return jsonb_build_object('estado',fila.estado,'contactada_en',fila.contactada_en);
end;
$$;

create function public.gestion_editar_estado_oportunidad(
  p_id uuid, p_estado_anterior text, p_estado text
)
returns jsonb language sql security invoker set search_path = '' as $$
  select private.gestion_editar_estado_oportunidad(p_id, p_estado_anterior, p_estado);
$$;

revoke all on function private.gestion_editar_estado_oportunidad(uuid,text,text), public.gestion_editar_estado_oportunidad(uuid,text,text)
  from public, anon, authenticated;
grant execute on function private.gestion_editar_estado_oportunidad(uuid,text,text), public.gestion_editar_estado_oportunidad(uuid,text,text)
  to authenticated;

create or replace function public.gestion_reservar_contacto_comercial(p_id uuid, p_clave uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  fila public.commercial_opportunities;
begin
  if auth.uid() is distinct from '5afbc94d-aecf-44e8-b12e-e136f49abb62'::uuid
    or not private.gestion_has_page_access('/comercial/consultas') then
    raise insufficient_privilege using message='Esta operación requiere la cuenta de Richard.';
  end if;
  if p_clave is null then raise exception 'Falta la clave de envío.'; end if;
  select * into strict fila from public.commercial_opportunities where id = p_id for update;
  if fila.correo is null then return jsonb_build_object('puede_enviar',false,'motivo','Sin correo publicado'); end if;
  if exists (select 1 from public.marketing_unsubscribes u where lower(u.email) = fila.correo) then
    update public.commercial_opportunities set estado='Baja' where id=p_id and estado='Sin contactar';
    return jsonb_build_object('puede_enviar',false,'motivo','Baja registrada');
  end if;
  if fila.referencia_correo is not null then
    return jsonb_build_object('puede_enviar',false,'estado',fila.estado,'motivo','Ya se registró un correo enviado');
  end if;
  if fila.estado <> 'Sin contactar' then
    return jsonb_build_object('puede_enviar',false,'estado',fila.estado,'misma_reserva',coalesce(fila.clave_envio=p_clave,false));
  end if;
  if fila.clave_envio = p_clave then
    return jsonb_build_object('puede_enviar',false,'motivo','Esta reserva ya fue cancelada');
  end if;
  update public.commercial_opportunities set estado='En preparación',clave_envio=p_clave where id=p_id;
  return jsonb_build_object('puede_enviar',true,'empresa',fila.empresa,'correo',fila.correo);
end;
$$;

create or replace function public.gestion_resolver_contacto_comercial(p_id uuid, p_clave uuid, p_enviado boolean, p_referencia text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  fila public.commercial_opportunities;
begin
  if auth.uid() is distinct from '5afbc94d-aecf-44e8-b12e-e136f49abb62'::uuid
    or not private.gestion_has_page_access('/comercial/consultas') then
    raise insufficient_privilege using message='Esta operación requiere la cuenta de Richard.';
  end if;
  if p_clave is null or p_enviado is null then raise exception 'Falta identificar el envío y su resultado.'; end if;
  if p_enviado and (coalesce(btrim(p_referencia),'')='' or length(p_referencia)>300) then raise exception 'Ingresá la referencia del mensaje enviado.'; end if;
  select * into strict fila from public.commercial_opportunities where id=p_id for update;
  if fila.clave_envio is distinct from p_clave then raise exception 'La clave no corresponde a esta reserva.'; end if;
  if p_enviado and fila.referencia_correo=btrim(p_referencia) then
    return jsonb_build_object('estado',fila.estado,'contactada_en',fila.contactada_en);
  end if;
  if fila.estado='Sin contactar' and not p_enviado then return jsonb_build_object('estado',fila.estado); end if;
  if fila.estado<>'En preparación' then raise exception 'La oportunidad no tiene esa reserva activa.'; end if;
  update public.commercial_opportunities
    set estado=case when p_enviado then 'Contactada' else 'Sin contactar' end,
        contactada_en=case when p_enviado then now() end,
        referencia_correo=case when p_enviado then btrim(p_referencia) end
    where id=p_id returning * into fila;
  return jsonb_build_object('estado',fila.estado,'contactada_en',fila.contactada_en);
end;
$$;

notify pgrst, 'reload schema';
