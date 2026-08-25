-- El dashboard vuelve a ofrecer dos acciones independientes: guardar el
-- borrador y publicar. La migración 20260820017000 había revocado estos
-- permisos cuando ambas acciones se resolvían mediante un único RPC.
--
-- Las funciones conservan su validación interna mediante
-- private.is_pricing_admin(); este grant solamente permite que PostgREST las
-- invoque para una sesión autenticada.
revoke all on function public.save_pricing_draft(uuid, timestamptz, jsonb)
  from public, anon, authenticated;
revoke all on function public.publish_pricing_draft(uuid, timestamptz)
  from public, anon, authenticated;

grant execute on function public.save_pricing_draft(uuid, timestamptz, jsonb)
  to authenticated;
grant execute on function public.publish_pricing_draft(uuid, timestamptz)
  to authenticated;

notify pgrst, 'reload schema';
