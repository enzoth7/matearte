-- Local customer edits use column-scoped privileges; new classification fields
-- need the same authenticated permission as the existing contact fields.
grant update (origin_channel, customer_type)
  on public.local_sales_customers to authenticated;
