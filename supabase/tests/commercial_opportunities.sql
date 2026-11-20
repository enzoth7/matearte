-- Prueba transaccional de las reservas de correo. Todas las operaciones se revierten.
begin;
do $test$
declare
  ficha uuid;
  sin_correo uuid;
  intento uuid := gen_random_uuid();
  siguiente uuid := gen_random_uuid();
  res jsonb;
begin
  insert into public.commercial_opportunities
    (empresa,correo,actividad,ubicacion,pais,mercado,region,prioridad,canal,destinatario,propuesta,senal,motivo,fuente_comercial,fuente_contacto,proxima_accion,fecha_revision)
    values ('Fixture ' || intento, intento || '@example.invalid','Prueba','Prueba','Uruguay','Uruguay','Uruguay','Media','Correo','Pruebas','Prueba','Prueba','Prueba','https://example.invalid','https://example.invalid','Prueba',current_date)
    returning id into ficha;
  insert into public.commercial_opportunities
    (empresa,actividad,ubicacion,pais,mercado,region,prioridad,canal,destinatario,propuesta,senal,motivo,fuente_comercial,fuente_contacto,proxima_accion,fecha_revision)
    select empresa || ' sin correo',actividad,ubicacion,pais,mercado,region,prioridad,canal,destinatario,propuesta,senal,motivo,fuente_comercial,fuente_contacto,proxima_accion,fecha_revision
    from public.commercial_opportunities where id=ficha returning id into sin_correo;
  begin
    perform public.gestion_reservar_contacto_comercial(ficha,intento);
    raise exception 'Se esperaba rechazo sin usuario';
  exception when insufficient_privilege then null;
  end;
  perform set_config('request.jwt.claim.sub','5afbc94d-aecf-44e8-b12e-e136f49abb62',true);
  res := public.gestion_reservar_contacto_comercial(sin_correo,intento);
  assert res->'puede_enviar' = 'false'::jsonb;
  res := public.gestion_reservar_contacto_comercial(ficha,intento);
  assert res->'puede_enviar' = 'true'::jsonb;
  res := public.gestion_reservar_contacto_comercial(ficha,intento);
  assert res->'puede_enviar' = 'false'::jsonb;
  res := public.gestion_reservar_contacto_comercial(ficha,siguiente);
  assert res->'puede_enviar' = 'false'::jsonb;
  res := public.gestion_resolver_contacto_comercial(ficha,intento,false);
  assert res->>'estado' = 'Sin contactar';
  res := public.gestion_reservar_contacto_comercial(ficha,intento);
  assert res->'puede_enviar' = 'false'::jsonb;
  res := public.gestion_reservar_contacto_comercial(ficha,siguiente);
  assert res->'puede_enviar' = 'true'::jsonb;
  res := public.gestion_resolver_contacto_comercial(ficha,siguiente,true,'fixture-mensaje');
  assert res->>'estado' = 'Contactada';
  res := public.gestion_resolver_contacto_comercial(ficha,siguiente,true,'fixture-mensaje');
  assert res->>'estado' = 'Contactada';
  res := public.gestion_reservar_contacto_comercial(ficha,gen_random_uuid());
  assert res->'puede_enviar' = 'false'::jsonb;
  update public.commercial_opportunities set estado='Sin contactar' where id=ficha;
  insert into public.marketing_unsubscribes(email) values (intento || '@example.invalid');
  res := public.gestion_reservar_contacto_comercial(ficha,gen_random_uuid());
  assert res->>'motivo' = 'Baja registrada';
end;
$test$;
rollback;
