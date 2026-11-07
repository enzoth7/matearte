create or replace view public.local_sales with (security_invoker = true) as
select
  o.id,
  coalesce((o.customer_snapshot ->> 'legacySaleNumber')::bigint, o.order_number) as sale_number,
  nullif(o.customer_snapshot ->> 'localCustomerId', '')::uuid as customer_id,
  o.customer_name,
  o.sold_on,
  o.payment_method,
  o.total_minor,
  o.currency,
  nullif(o.customer_snapshot ->> 'createdBy', '')::uuid as created_by,
  o.created_at,
  o.reference_code,
  o.channel,
  o.deposit_minor,
  o.status,
  o.shipping_method,
  o.shipping_carrier,
  o.tracking_code
from public.orders o
where o.channel in ('Local', 'Feria', 'WhatsApp', 'Instagram', 'Facebook');
