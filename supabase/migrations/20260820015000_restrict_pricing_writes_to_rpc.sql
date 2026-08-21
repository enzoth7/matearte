-- Los tokens administrativos no reciben escritura directa sobre las tablas.
-- Toda mutación pasa por RPC validados y transaccionales.
revoke insert, update, delete on table public.pricing_catalog_versions from anon, authenticated;
revoke insert, update, delete on table public.pricing_catalog_values from anon, authenticated;

alter function public.save_pricing_draft(uuid, timestamptz, jsonb) security definer;
alter function public.publish_pricing_draft(uuid, timestamptz) security definer;

revoke all on function public.save_pricing_draft(uuid, timestamptz, jsonb) from public, anon, authenticated;
revoke all on function public.publish_pricing_draft(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.save_pricing_draft(uuid, timestamptz, jsonb) to authenticated;
grant execute on function public.publish_pricing_draft(uuid, timestamptz) to authenticated;
