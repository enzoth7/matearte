-- Wholesale checkout by bank transfer with private payment receipts.

alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check check (status in (
  'pending_payment', 'payment_verification_pending', 'paid_pending_review',
  'ready_for_fulfillment', 'ready_for_production', 'shipped', 'payment_failed',
  'cancelled', 'refunded', 'manual_review'
));

alter table public.commerce_payments drop constraint if exists commerce_payments_provider_check;
alter table public.commerce_payments add constraint commerce_payments_provider_check
  check (provider in ('mercado_pago', 'paypal', 'bank_transfer'));

create table public.commerce_bank_transfer_settings (
  singleton boolean primary key default true check (singleton),
  account_holder text not null check (char_length(btrim(account_holder)) between 2 and 120),
  transfer_account text not null check (char_length(btrim(transfer_account)) between 3 and 160),
  cash_deposit_account text not null check (char_length(btrim(cash_deposit_account)) between 3 and 160),
  cash_deposit_label text not null check (char_length(btrim(cash_deposit_label)) between 3 and 240),
  updated_at timestamptz not null default now()
);

insert into public.commerce_bank_transfer_settings (
  singleton, account_holder, transfer_account, cash_deposit_account, cash_deposit_label
) values (
  true,
  'Richard Ortiz',
  'BROU CA $ 110882545-00002',
  '601-0384954',
  'Depósitos en RED PAGOS/ABITAB · BROU CA $ (numeración vieja)'
) on conflict (singleton) do nothing;

create trigger commerce_bank_transfer_settings_updated_at
before update on public.commerce_bank_transfer_settings
for each row execute function private.set_updated_at();

create table public.commerce_bank_transfer_receipts (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  storage_path text not null unique check (char_length(storage_path) between 10 and 500),
  original_name text not null check (char_length(original_name) between 1 and 240),
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')),
  byte_size bigint not null check (byte_size between 1 and 5242880),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  rejection_reason text check (rejection_reason is null or char_length(btrim(rejection_reason)) between 5 and 500),
  reviewed_by uuid references auth.users(id) on delete set null,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  check (
    (status = 'pending' and reviewed_by is null and reviewed_at is null and rejection_reason is null)
    or (status = 'approved' and reviewed_by is not null and reviewed_at is not null and rejection_reason is null)
    or (status = 'rejected' and reviewed_by is not null and reviewed_at is not null and rejection_reason is not null)
  )
);

create index commerce_bank_transfer_receipts_user_idx
  on public.commerce_bank_transfer_receipts (user_id, submitted_at desc);
create index commerce_bank_transfer_receipts_pending_idx
  on public.commerce_bank_transfer_receipts (submitted_at)
  where status = 'pending';
create index commerce_bank_transfer_receipts_reviewed_by_idx
  on public.commerce_bank_transfer_receipts (reviewed_by)
  where reviewed_by is not null;

revoke all on public.commerce_bank_transfer_settings, public.commerce_bank_transfer_receipts
  from public, anon, authenticated;
grant select, update on public.commerce_bank_transfer_settings to authenticated;
grant select on public.commerce_bank_transfer_receipts to authenticated;
grant all on public.commerce_bank_transfer_settings, public.commerce_bank_transfer_receipts to service_role;

alter table public.commerce_bank_transfer_settings enable row level security;
alter table public.commerce_bank_transfer_receipts enable row level security;

create policy bank_transfer_settings_admin_read
on public.commerce_bank_transfer_settings for select to authenticated
using ((select private.is_commerce_admin()));

create policy bank_transfer_settings_admin_update
on public.commerce_bank_transfer_settings for update to authenticated
using ((select private.is_commerce_admin()))
with check ((select private.is_commerce_admin()));

create policy bank_transfer_receipts_owner_or_admin_read
on public.commerce_bank_transfer_receipts for select to authenticated
using ((select auth.uid()) = user_id or (select private.is_commerce_admin()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'bank-transfer-receipts',
  'bank-transfer-receipts',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy bank_transfer_receipts_storage_admin_read
on storage.objects for select to authenticated
using (
  bucket_id = 'bank-transfer-receipts'
  and (select private.is_commerce_admin())
);

create or replace function public.create_wholesale_bank_transfer_order(
  p_user_id uuid,
  p_cart_id uuid,
  p_shipping_rate_id uuid,
  p_design_prices jsonb,
  p_customer_snapshot jsonb,
  p_idempotency_key uuid,
  p_receipt_id uuid,
  p_receipt_storage_path text,
  p_receipt_original_name text,
  p_receipt_mime_type text,
  p_receipt_byte_size bigint
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cart public.carts%rowtype;
  v_existing public.orders%rowtype;
  v_settings public.commerce_settings%rowtype;
  v_bank_settings public.commerce_bank_transfer_settings%rowtype;
  v_shipping public.shipping_rates%rowtype;
  v_variant record;
  v_design record;
  v_order public.orders%rowtype;
  v_mate_quantity integer := 0;
  v_catalog_subtotal bigint := 0;
  v_design_subtotal bigint := 0;
  v_design_price bigint;
  v_unit_price bigint;
  v_has_custom boolean := false;
begin
  -- Serialize retries for the same customer/key before checking for an existing
  -- order, so concurrent submissions return the first committed result.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_user_id::text || ':' || p_idempotency_key::text, 0)
  );

  select * into v_existing
  from public.orders
  where user_id = p_user_id and checkout_idempotency_key = p_idempotency_key;

  if found then
    return jsonb_build_object(
      'id', v_existing.id,
      'orderNumber', v_existing.order_number,
      'status', v_existing.status,
      'totalMinor', v_existing.total_minor,
      'existing', true
    );
  end if;

  select * into v_settings
  from public.commerce_settings
  where singleton
  for update;

  if not found or not v_settings.commerce_enabled then
    raise exception 'El comercio todavía no está habilitado';
  end if;
  if not coalesce(v_settings.wholesale_mate_discount_enabled, false)
     or v_settings.wholesale_mate_discount_percent <= 0 then
    raise exception 'La compra mayorista no está habilitada';
  end if;

  select * into v_bank_settings
  from public.commerce_bank_transfer_settings
  where singleton;
  if not found then raise exception 'La transferencia bancaria no está configurada'; end if;

  if p_receipt_mime_type not in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')
     or p_receipt_byte_size < 1 or p_receipt_byte_size > 5242880 then
    raise exception 'El comprobante no es válido';
  end if;
  if split_part(p_receipt_storage_path, '/', 1) <> p_user_id::text then
    raise exception 'La ruta del comprobante no es válida';
  end if;

  select * into v_cart
  from public.carts
  where id = p_cart_id and user_id = p_user_id and status = 'active'
  for update;
  if not found then raise exception 'El carrito no está disponible'; end if;
  if not exists (select 1 from public.cart_items where cart_id = p_cart_id) then
    raise exception 'El carrito está vacío';
  end if;

  select * into v_shipping
  from public.shipping_rates
  where id = p_shipping_rate_id and active;
  if not found then raise exception 'La modalidad de entrega no está disponible'; end if;

  select coalesce(sum(item.quantity), 0)::integer
  into v_mate_quantity
  from public.cart_items item
  join public.commerce_variants variant on variant.id = item.variant_id
  join public.commerce_products product on product.id = variant.product_id
  where item.cart_id = p_cart_id
    and item.item_type = 'catalog'
    and lower(trim(coalesce(nullif(product.category_code, ''), product.category))) = 'mates';

  if v_mate_quantity < v_settings.wholesale_mate_quantity_threshold then
    raise exception 'El pedido no alcanza el mínimo mayorista';
  end if;

  for v_variant in
    select variant.*, product.name as product_name, product.sale_mode, product.published,
           product.category, product.category_code, item.quantity
    from public.cart_items item
    join public.commerce_variants variant on variant.id = item.variant_id
    join public.commerce_products product on product.id = variant.product_id
    where item.cart_id = p_cart_id and item.item_type = 'catalog'
    order by variant.id
    for update of variant
  loop
    if not v_variant.active or not v_variant.published then
      raise exception 'Una variante ya no está publicada';
    end if;
    v_unit_price := case
      when lower(trim(coalesce(nullif(v_variant.category_code, ''), v_variant.category))) = 'mates'
      then greatest(0, round(v_variant.base_price_minor::numeric * (1 - v_settings.wholesale_mate_discount_percent / 100)))::bigint
      else v_variant.price_minor
    end;
    v_catalog_subtotal := v_catalog_subtotal + v_unit_price * v_variant.quantity;
  end loop;

  for v_design in
    select design.*, item.quantity
    from public.cart_items item
    join public.designs design on design.id = item.design_id
    where item.cart_id = p_cart_id and item.item_type = 'design' and design.user_id = p_user_id
    order by design.id
  loop
    v_design_price := nullif(p_design_prices ->> v_design.id::text, '')::bigint;
    if v_design_price is null or v_design_price <= 0 then
      raise exception 'No se pudo verificar el precio del diseño %', v_design.id;
    end if;
    v_design_subtotal := v_design_subtotal + v_design_price;
    v_has_custom := true;
  end loop;

  if (select count(*) from public.cart_items where cart_id = p_cart_id and item_type = 'design') <>
     (select count(*) from public.cart_items item join public.designs design on design.id = item.design_id
      where item.cart_id = p_cart_id and item.item_type = 'design' and design.user_id = p_user_id) then
    raise exception 'El carrito contiene un diseño inválido';
  end if;

  insert into public.orders (
    user_id, cart_id, status, items_subtotal_minor, shipping_minor, payment_fee_minor,
    total_minor, shipping_method, shipping_snapshot, customer_snapshot,
    checkout_idempotency_key, reservation_expires_at
  ) values (
    p_user_id, p_cart_id, 'payment_verification_pending',
    v_catalog_subtotal + v_design_subtotal, 0, 0,
    v_catalog_subtotal + v_design_subtotal,
    case when v_shipping.is_pickup then 'pickup' else 'national_shipping' end,
    to_jsonb(v_shipping) || jsonb_build_object('channel', 'bank_transfer', 'payOnDelivery', not v_shipping.is_pickup),
    p_customer_snapshot || jsonb_build_object('purchaseFlow', 'wholesale_bank_transfer'),
    p_idempotency_key, null
  ) returning * into v_order;

  insert into public.order_items (
    order_id, item_type, source_variant_id, sku, title, quantity,
    unit_price_minor, total_minor, immutable_snapshot, requires_review
  )
  select v_order.id, 'catalog', variant.id, variant.sku,
         product.name || ' — ' || variant.name, item.quantity,
         case
           when lower(trim(coalesce(nullif(product.category_code, ''), product.category))) = 'mates'
           then greatest(0, round(variant.base_price_minor::numeric * (1 - v_settings.wholesale_mate_discount_percent / 100)))::bigint
           else variant.price_minor
         end,
         (case
           when lower(trim(coalesce(nullif(product.category_code, ''), product.category))) = 'mates'
           then greatest(0, round(variant.base_price_minor::numeric * (1 - v_settings.wholesale_mate_discount_percent / 100)))::bigint
           else variant.price_minor
         end) * item.quantity,
         jsonb_build_object(
           'product', to_jsonb(product),
           'variant', to_jsonb(variant),
           'selectedOptions', coalesce(item.option_values_override, variant.option_values, '{}'::jsonb),
           'wholesaleBankTransfer', lower(trim(coalesce(nullif(product.category_code, ''), product.category))) = 'mates'
         ),
         false
  from public.cart_items item
  join public.commerce_variants variant on variant.id = item.variant_id
  join public.commerce_products product on product.id = variant.product_id
  where item.cart_id = p_cart_id and item.item_type = 'catalog';

  insert into public.order_items (
    order_id, item_type, source_design_id, title, quantity,
    unit_price_minor, total_minor, immutable_snapshot, requires_review, review_status
  )
  select v_order.id, 'design', design.id, design.title, 1,
         (p_design_prices ->> design.id::text)::bigint,
         (p_design_prices ->> design.id::text)::bigint,
         jsonb_build_object(
           'schemaVersion', design.schema_version,
           'configuration', design.configuration,
           'flejeConfiguration', design.fleje_configuration,
           'previewPath', design.preview_path,
           'assets', coalesce(
             (select jsonb_agg(to_jsonb(asset)) from public.design_assets asset where asset.design_id = design.id),
             '[]'::jsonb
           )
         ), true, 'pending'
  from public.cart_items item
  join public.designs design on design.id = item.design_id
  where item.cart_id = p_cart_id and item.item_type = 'design' and design.user_id = p_user_id;

  insert into public.commerce_bank_transfer_receipts (
    id, order_id, user_id, storage_path, original_name, mime_type, byte_size
  ) values (
    p_receipt_id, v_order.id, p_user_id, p_receipt_storage_path,
    left(p_receipt_original_name, 240), p_receipt_mime_type, p_receipt_byte_size
  );

  update public.carts set status = 'converted' where id = p_cart_id;

  return jsonb_build_object(
    'id', v_order.id,
    'orderNumber', v_order.order_number,
    'status', v_order.status,
    'itemsSubtotalMinor', v_order.items_subtotal_minor,
    'totalMinor', v_order.total_minor,
    'hasCustom', v_has_custom,
    'existing', false
  );
end;
$$;

revoke all on function public.create_wholesale_bank_transfer_order(
  uuid, uuid, uuid, jsonb, jsonb, uuid, uuid, text, text, text, bigint
) from public, anon, authenticated;
grant execute on function public.create_wholesale_bank_transfer_order(
  uuid, uuid, uuid, jsonb, jsonb, uuid, uuid, text, text, text, bigint
) to service_role;

create or replace function public.review_wholesale_bank_transfer_order(
  p_admin_id uuid,
  p_order_id uuid,
  p_decision text,
  p_reason text default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_receipt public.commerce_bank_transfer_receipts%rowtype;
  v_has_custom boolean := false;
  v_target_status text;
  v_reason text := nullif(left(btrim(coalesce(p_reason, '')), 500), '');
begin
  if not exists (
    select 1 from public.commerce_admin_users
    where user_id = p_admin_id and active
  ) then
    raise exception 'No tenés acceso al panel comercial';
  end if;
  if p_decision not in ('approve', 'reject') then
    raise exception 'Decisión inválida';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found or v_order.status <> 'payment_verification_pending'
     or v_order.customer_snapshot ->> 'purchaseFlow' <> 'wholesale_bank_transfer' then
    raise exception 'El pedido no está pendiente de verificación';
  end if;

  select * into v_receipt
  from public.commerce_bank_transfer_receipts
  where order_id = p_order_id
  for update;
  if not found or v_receipt.status <> 'pending' then
    raise exception 'El comprobante ya fue revisado';
  end if;

  if p_decision = 'approve' then
    select exists (
      select 1 from public.order_items where order_id = p_order_id and requires_review
    ) into v_has_custom;
    v_target_status := case when v_has_custom then 'paid_pending_review' else 'ready_for_fulfillment' end;

    update public.commerce_bank_transfer_receipts
    set status = 'approved', reviewed_by = p_admin_id, reviewed_at = now(), rejection_reason = null
    where id = v_receipt.id;

    insert into public.commerce_payments (
      order_id, provider, provider_payment_id, status, status_detail,
      amount_minor, currency, raw_payload, approved_at
    ) values (
      p_order_id, 'bank_transfer', 'bank-transfer:' || v_receipt.id::text,
      'approved', 'manually_verified', v_order.total_minor, 'UYU',
      jsonb_build_object('receiptId', v_receipt.id, 'reviewedBy', p_admin_id), now()
    ) on conflict (provider_payment_id) do nothing;

    update public.orders
    set status = v_target_status, paid_at = now()
    where id = p_order_id;
  else
    if v_reason is null or char_length(v_reason) < 5 then
      raise exception 'Indicá el motivo del rechazo';
    end if;
    v_target_status := 'cancelled';
    update public.commerce_bank_transfer_receipts
    set status = 'rejected', reviewed_by = p_admin_id, reviewed_at = now(), rejection_reason = v_reason
    where id = v_receipt.id;
    update public.orders
    set status = 'cancelled', cancelled_at = now()
    where id = p_order_id;
  end if;

  delete from public.commerce_email_outbox where order_id = p_order_id;

  return jsonb_build_object(
    'id', p_order_id,
    'status', v_target_status,
    'receiptStatus', case when p_decision = 'approve' then 'approved' else 'rejected' end
  );
end;
$$;

revoke all on function public.review_wholesale_bank_transfer_order(uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.review_wholesale_bank_transfer_order(uuid, uuid, text, text)
  to service_role;

-- Bank-transfer orders intentionally use only in-app status updates.
create or replace function private.enqueue_order_status_emails()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer_email text := new.customer_snapshot ->> 'email';
  v_has_rejected_custom boolean := false;
  v_is_confirmed_payment boolean := new.status in (
    'paid_pending_review', 'ready_for_fulfillment', 'ready_for_production', 'manual_review'
  );
begin
  if new.customer_snapshot ->> 'purchaseFlow' = 'wholesale_bank_transfer' then
    return new;
  end if;
  if new.customer_snapshot ->> 'purchaseFlow' = 'international_paypal'
     and new.paid_at is null then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.shipping_method = 'international_coordination' then
      perform private.enqueue_commerce_email(new.id, 'customer_international_received', 'customer', v_customer_email);
      perform private.enqueue_commerce_email(new.id, 'admin_order_created', 'admin');
      return new;
    end if;
    if v_is_confirmed_payment then
      perform private.enqueue_commerce_email(new.id, 'customer_order_received', 'customer', v_customer_email);
      perform private.enqueue_commerce_email(new.id, 'admin_order_created', 'admin');
      perform private.enqueue_commerce_email(new.id, 'customer_payment_confirmed', 'customer', v_customer_email);
      perform private.enqueue_commerce_email(new.id, 'admin_payment_confirmed', 'admin');
      if new.status = 'paid_pending_review' then
        perform private.enqueue_commerce_email(new.id, 'admin_custom_review_required', 'admin');
      elsif new.status = 'manual_review' then
        perform private.enqueue_commerce_email(new.id, 'admin_payment_review_required', 'admin');
      end if;
    end if;
    return new;
  end if;
  if new.status is not distinct from old.status then return new; end if;
  if old.status = 'pending_payment' and v_is_confirmed_payment then
    perform private.enqueue_commerce_email(new.id, 'customer_order_received', 'customer', v_customer_email);
    perform private.enqueue_commerce_email(new.id, 'admin_order_created', 'admin');
  end if;
  if new.status in ('paid_pending_review', 'ready_for_fulfillment') then
    perform private.enqueue_commerce_email(new.id, 'customer_payment_confirmed', 'customer', v_customer_email);
    perform private.enqueue_commerce_email(new.id, 'admin_payment_confirmed', 'admin');
  end if;
  if new.status = 'paid_pending_review' then
    perform private.enqueue_commerce_email(new.id, 'admin_custom_review_required', 'admin');
  elsif new.status = 'ready_for_production' then
    perform private.enqueue_commerce_email(new.id, 'customer_custom_approved', 'customer', v_customer_email);
  elsif new.status = 'manual_review' then
    perform private.enqueue_commerce_email(new.id, 'admin_payment_review_required', 'admin');
  elsif new.status = 'refunded' then
    select exists (
      select 1 from public.order_items
      where order_id = new.id and requires_review and review_status = 'rejected'
    ) into v_has_rejected_custom;
    perform private.enqueue_commerce_email(
      new.id,
      case when v_has_rejected_custom then 'customer_custom_rejected_refunded' else 'customer_order_refunded' end,
      'customer', v_customer_email
    );
  end if;
  return new;
end;
$$;

revoke all on function private.enqueue_order_status_emails() from public, anon, authenticated;
