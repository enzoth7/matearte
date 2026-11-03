-- Disposable local PostgreSQL database only. No network calls or real mail.
create schema private;
create table public.orders (
  id uuid primary key default gen_random_uuid(), channel text default 'Web',
  status text, customer_snapshot jsonb, total_minor bigint, paid_at timestamptz, cancelled_at timestamptz
);
create table public.commerce_admin_users (user_id uuid primary key, active boolean);
create table public.commerce_bank_transfer_receipts (
  id uuid primary key default gen_random_uuid(), order_id uuid, status text default 'pending',
  reviewed_by uuid, reviewed_at timestamptz, rejection_reason text
);
create table public.order_items (
  order_id uuid, requires_review boolean, production_status text default 'pending', completed_at timestamptz
);
create table public.commerce_payments (
  order_id uuid, provider text, provider_payment_id text unique, status text, status_detail text,
  amount_minor bigint, currency text, raw_payload jsonb, approved_at timestamptz
);
create table public.commerce_email_outbox (
  id uuid primary key default gen_random_uuid(), order_id uuid references public.orders,
  event_type text, recipient_kind text, recipient_email text, payload jsonb,
  status text default 'pending', attempt_count integer default 0, available_at timestamptz default now(),
  claimed_at timestamptz, last_error text, created_at timestamptz default now(), updated_at timestamptz default now(),
  unique(order_id,event_type)
);
create table public.test_email_dispatch (order_id uuid, event_type text);
create function private.dispatch_commerce_email_on_enqueue() returns trigger language plpgsql as $$
begin
  insert into public.test_email_dispatch values(new.order_id,new.event_type);
  return new;
end $$;
create trigger commerce_email_outbox_dispatch after insert on public.commerce_email_outbox
for each row execute function private.dispatch_commerce_email_on_enqueue();
