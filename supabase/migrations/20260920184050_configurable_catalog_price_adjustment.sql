-- Make the catalog-wide price adjustment configurable and reversible.
-- `base_price_minor` is the source price entered by the administrator;
-- `price_minor` remains the final storefront/checkout price.

alter table public.commerce_settings
  add column if not exists catalog_price_adjustment_enabled boolean not null default true,
  add column if not exists catalog_price_adjustment_percent numeric(7, 2) not null default 13.64;

alter table public.commerce_settings
  drop constraint if exists commerce_settings_catalog_price_adjustment_percent_check;

alter table public.commerce_settings
  add constraint commerce_settings_catalog_price_adjustment_percent_check
  check (catalog_price_adjustment_percent between 0 and 100);

-- The former separately disclosed Mercado Pago fee is no longer part of the
-- active checkout model. Keep the legacy columns for historical migrations and
-- orders, but force the feature off.
update public.commerce_settings
set payment_fee_enabled = false,
    payment_fee_legal_approval = false
where singleton = true;

comment on column public.commerce_settings.payment_fee_enabled
  is 'Deprecated. A separate payment fee is no longer charged.';
comment on column public.commerce_settings.payment_fee_legal_approval
  is 'Deprecated. A separate payment fee is no longer charged.';
comment on column public.commerce_settings.catalog_price_adjustment_enabled
  is 'Applies the catalog-wide adjustment to base prices when enabled.';
comment on column public.commerce_settings.catalog_price_adjustment_percent
  is 'Percentage applied to every catalog variant base price.';

alter table public.commerce_variants
  add column if not exists base_price_minor bigint;

-- Recover the original prices from the audited one-time adjustment whenever
-- possible. Variants created outside that batch use their current price.
update public.commerce_variants as variant
set base_price_minor = coalesce(backup.old_price_minor, variant.price_minor)
from (
  select v.id,
         adjustment.old_price_minor
  from public.commerce_variants v
  left join private.catalog_price_adjustment_20260920 adjustment
    on adjustment.variant_id = v.id
) as backup
where backup.id = variant.id
  and variant.base_price_minor is null;

alter table public.commerce_variants
  alter column base_price_minor set not null;

alter table public.commerce_variants
  drop constraint if exists commerce_variants_base_price_minor_check;

alter table public.commerce_variants
  add constraint commerce_variants_base_price_minor_check
  check (base_price_minor >= 0);

comment on column public.commerce_variants.base_price_minor
  is 'Administrator-entered source price before the configurable catalog adjustment.';

create or replace function private.catalog_price_with_adjustment(
  p_base_price_minor bigint,
  p_enabled boolean,
  p_percent numeric
) returns bigint
language sql
immutable
set search_path = ''
as $$
  select case
    when p_enabled then round((p_base_price_minor::numeric * (1 + p_percent / 100)) / 100) * 100
    else p_base_price_minor
  end::bigint;
$$;

create or replace function private.set_catalog_variant_final_price()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_enabled boolean;
  v_percent numeric;
begin
  if tg_op = 'INSERT' then
    new.base_price_minor := coalesce(new.base_price_minor, new.price_minor);
  elsif new.base_price_minor is not distinct from old.base_price_minor
        and new.price_minor is distinct from old.price_minor then
    -- Compatibility for older admin clients that only write `price_minor`.
    new.base_price_minor := new.price_minor;
  end if;

  select catalog_price_adjustment_enabled, catalog_price_adjustment_percent
  into v_enabled, v_percent
  from public.commerce_settings
  where singleton = true;

  new.price_minor := private.catalog_price_with_adjustment(
    new.base_price_minor,
    coalesce(v_enabled, false),
    coalesce(v_percent, 0)
  );
  return new;
end;
$$;

drop trigger if exists commerce_variants_catalog_price_adjustment on public.commerce_variants;
create trigger commerce_variants_catalog_price_adjustment
  before insert or update of base_price_minor, price_minor
  on public.commerce_variants
  for each row execute function private.set_catalog_variant_final_price();

create or replace function private.reprice_catalog_after_setting_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.catalog_price_adjustment_enabled is distinct from old.catalog_price_adjustment_enabled
     or new.catalog_price_adjustment_percent is distinct from old.catalog_price_adjustment_percent then
    -- Touch the source field so the variant trigger recalculates the final price.
    update public.commerce_variants
    set base_price_minor = base_price_minor;
  end if;
  return new;
end;
$$;

drop trigger if exists commerce_settings_reprice_catalog on public.commerce_settings;
create trigger commerce_settings_reprice_catalog
  after update of catalog_price_adjustment_enabled, catalog_price_adjustment_percent
  on public.commerce_settings
  for each row execute function private.reprice_catalog_after_setting_change();

-- Recalculate once so every variant, including unpublished ones and variants
-- created after the previous one-time batch, follows the configured setting.
update public.commerce_variants
set base_price_minor = base_price_minor;
