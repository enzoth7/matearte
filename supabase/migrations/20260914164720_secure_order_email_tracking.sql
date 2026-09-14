create table private.order_tracking_tokens (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  token_hash bytea not null unique,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  constraint order_tracking_tokens_hash_length_check check (octet_length(token_hash) = 32)
);

create index order_tracking_tokens_order_idx
  on private.order_tracking_tokens (order_id, created_at desc);

alter table private.order_tracking_tokens enable row level security;
revoke all on table private.order_tracking_tokens from public, anon, authenticated;

create or replace function public.issue_order_tracking_token(p_order_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text;
begin
  if not exists (select 1 from public.orders where id = p_order_id) then
    raise exception 'Pedido inexistente';
  end if;

  v_token := rtrim(translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/', '-_'), '=');

  insert into private.order_tracking_tokens (order_id, token_hash)
  values (p_order_id, extensions.digest(convert_to(v_token, 'UTF8'), 'sha256'));

  return v_token;
end;
$$;

create or replace function public.verify_order_tracking_token(p_order_id uuid, p_token text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    p_token is not null
    and p_token ~ '^[A-Za-z0-9_-]{43}$'
    and exists (
      select 1
      from private.order_tracking_tokens token
      where token.order_id = p_order_id
        and token.revoked_at is null
        and token.token_hash = extensions.digest(convert_to(p_token, 'UTF8'), 'sha256')
    );
$$;

revoke all on function public.issue_order_tracking_token(uuid) from public, anon, authenticated;
revoke all on function public.verify_order_tracking_token(uuid, text) from public, anon, authenticated;
grant execute on function public.issue_order_tracking_token(uuid) to service_role;
grant execute on function public.verify_order_tracking_token(uuid, text) to service_role;

comment on table private.order_tracking_tokens is
  'Hashed bearer capabilities issued only for transactional order emails. The raw token exists only in the email link.';
comment on function public.issue_order_tracking_token(uuid) is
  'Issues a high-entropy, URL-safe order capability. Restricted to the service role used by the email worker.';
comment on function public.verify_order_tracking_token(uuid, text) is
  'Validates an email order capability without exposing token hashes. Restricted to trusted server code.';
