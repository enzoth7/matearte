create or replace function public.get_email_delivery_config()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_object_agg(secret.name, secret.decrypted_secret), '{}'::jsonb)
  from vault.decrypted_secrets secret
  where secret.name in (
    'matearte_resend_api_key',
    'matearte_newsletter_topic_id',
    'matearte_email_from',
    'matearte_email_reply_to',
    'matearte_admin_email',
    'matearte_site_url',
    'matearte_newsletter_unsubscribe_secret',
    'matearte_lifecycle_service_role'
  );
$$;

revoke all on function public.get_email_delivery_config() from public, anon, authenticated;
grant execute on function public.get_email_delivery_config() to service_role;
