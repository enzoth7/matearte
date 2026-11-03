-- Keep commission-adjusted catalog prices commercially clean. Prefer the next
-- $50 multiple, except when the adjusted amount is less than $10 above the
-- previous multiple; in that case, round down to it.
create or replace function private.catalog_price_with_adjustment(
  p_base_price_minor bigint,
  p_enabled boolean,
  p_percent numeric
) returns bigint
language sql
immutable
set search_path = ''
as $$
  with adjusted as (
    select p_base_price_minor::numeric * (1 + p_percent / 100) as amount
  ), commercial_bounds as (
    select amount,
           floor(amount / 5000) * 5000 as lower_amount
    from adjusted
  )
  select case
    when not p_enabled then p_base_price_minor
    when amount - lower_amount < 1000 then lower_amount
    else lower_amount + 5000
  end::bigint
  from commercial_bounds;
$$;

comment on function private.catalog_price_with_adjustment(bigint, boolean, numeric)
  is 'Applies the catalog adjustment and rounds to $50 multiples, rounding down only within $10 of the lower multiple.';

-- Recalculate every existing variant. The variant trigger preserves the base
-- price and writes the newly rounded storefront price.
update public.commerce_variants
set base_price_minor = base_price_minor;
