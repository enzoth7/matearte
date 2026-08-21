-- La implementación privilegiada vive fuera del esquema expuesto.
-- El endpoint público es un wrapper invoker y la función interna vuelve a
-- comprobar que auth.uid() pertenezca a admin_users.
alter function public.save_and_publish_pricing(uuid, timestamptz, jsonb)
  set schema private;

alter function private.save_and_publish_pricing(uuid, timestamptz, jsonb)
  rename to save_and_publish_pricing_impl;

revoke all on function private.save_and_publish_pricing_impl(uuid, timestamptz, jsonb)
  from public, anon, authenticated;
grant execute on function private.save_and_publish_pricing_impl(uuid, timestamptz, jsonb)
  to authenticated;

create function public.save_and_publish_pricing(
  p_version_id uuid,
  p_expected_updated_at timestamptz,
  p_values jsonb
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.save_and_publish_pricing_impl(
    p_version_id,
    p_expected_updated_at,
    p_values
  );
$$;

revoke all on function public.save_and_publish_pricing(uuid, timestamptz, jsonb)
  from public, anon, authenticated;
grant execute on function public.save_and_publish_pricing(uuid, timestamptz, jsonb)
  to authenticated;

-- La interfaz ya no usa los endpoints separados. Revocarlos evita rutas de
-- escritura alternativas que podrían dejar cambios sin aplicar.
revoke execute on function public.save_pricing_draft(uuid, timestamptz, jsonb)
  from authenticated;
revoke execute on function public.publish_pricing_draft(uuid, timestamptz)
  from authenticated;
