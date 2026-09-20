-- Increase every currently published, active catalog variant by 13.64%.
-- Prices are stored in minor units and rounded to the nearest whole UYU.
-- The private backup makes the data migration auditable and idempotent.

create table if not exists private.catalog_price_adjustment_20260920 (
  variant_id uuid primary key,
  old_price_minor bigint not null check (old_price_minor >= 0),
  new_price_minor bigint not null check (new_price_minor >= 0),
  adjustment_percent numeric(6, 2) not null default 13.64,
  applied_at timestamptz not null default now()
);

alter table private.catalog_price_adjustment_20260920 enable row level security;
revoke all on table private.catalog_price_adjustment_20260920 from public, anon, authenticated;

insert into private.catalog_price_adjustment_20260920 (
  variant_id,
  old_price_minor,
  new_price_minor
)
select
  variant.id,
  variant.price_minor,
  round((variant.price_minor::numeric * 1.1364) / 100) * 100
from public.commerce_variants as variant
join public.commerce_products as product on product.id = variant.product_id
where product.published
  and variant.active
on conflict (variant_id) do nothing;

update public.commerce_variants as variant
set
  price_minor = backup.new_price_minor,
  updated_at = now()
from private.catalog_price_adjustment_20260920 as backup
where variant.id = backup.variant_id
  and variant.price_minor = backup.old_price_minor;
