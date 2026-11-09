create or replace function private.can_manage_inventory_costs()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.commerce_admin_users admin
    where admin.user_id = (select auth.uid())
      and admin.active
      and admin.access_user_id = 't1'
  );
$$;
revoke all on function private.can_manage_inventory_costs() from public, anon;
grant execute on function private.can_manage_inventory_costs() to authenticated;

create table public.inventory_cost_profiles (
  id uuid primary key default gen_random_uuid(),
  category_code text not null unique references public.commerce_categories(code),
  name text not null check (length(trim(name)) between 1 and 120),
  method text not null check (method in ('fabricacion', 'reventa')),
  benchmark_material_minor bigint check (benchmark_material_minor is null or benchmark_material_minor >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.inventory_cost_lines (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.inventory_cost_profiles(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 120),
  kind text not null check (kind in ('material', 'option', 'labor', 'packaging', 'waste', 'purchase', 'freight')),
  mode text not null default 'per_product' check (mode in ('per_product', 'purchase_quantity')),
  amount_minor bigint check (amount_minor is null or amount_minor >= 0),
  currency text not null default 'UYU' check (currency in ('UYU', 'ARS', 'USD')),
  exchange_rate_to_uyu numeric(18,8),
  purchase_quantity numeric(18,4),
  consumption_quantity numeric(18,4),
  unit text check (unit is null or length(trim(unit)) between 1 and 30),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inventory_cost_line_rate_check check (
    amount_minor is null or currency = 'UYU' or exchange_rate_to_uyu > 0
  ),
  constraint inventory_cost_line_quantities_check check (
    (mode = 'per_product' and purchase_quantity is null and consumption_quantity is null)
    or (mode = 'purchase_quantity' and purchase_quantity > 0 and consumption_quantity > 0 and unit is not null)
  )
);
create index inventory_cost_lines_profile_idx on public.inventory_cost_lines(profile_id, sort_order);

alter table public.inventory_cost_profiles enable row level security;
alter table public.inventory_cost_lines enable row level security;
grant select, insert, update, delete on public.inventory_cost_profiles to authenticated;
grant select, insert, update, delete on public.inventory_cost_lines to authenticated;
create policy inventory_cost_profiles_richard on public.inventory_cost_profiles
  for all to authenticated using ((select private.can_manage_inventory_costs()))
  with check ((select private.can_manage_inventory_costs()));
create policy inventory_cost_lines_richard on public.inventory_cost_lines
  for all to authenticated using ((select private.can_manage_inventory_costs()))
  with check ((select private.can_manage_inventory_costs()));

insert into public.inventory_cost_profiles(category_code, name, method, benchmark_material_minor)
values ('mates', 'Mate imperial alpaca', 'fabricacion', 60500),
       ('botas', 'Botas', 'reventa', null);

insert into public.inventory_cost_lines(profile_id, name, kind, amount_minor, sort_order)
select profile.id, item.name, item.kind, item.amount_minor, item.sort_order
from public.inventory_cost_profiles profile
join (values
  ('mates', 'Mate base', 'material', 8000::bigint, 10),
  ('mates', 'Cuero', 'material', 18000::bigint, 20),
  ('mates', 'Fleje de alpaca base', 'material', 25000::bigint, 30),
  ('mates', 'Virola', 'material', 6500::bigint, 40),
  ('mates', 'Adhesivos y consumibles', 'material', 3000::bigint, 50),
  ('mates', 'Otro fleje', 'option', null::bigint, 60),
  ('mates', 'Cincelado', 'option', null::bigint, 70),
  ('mates', 'Mano de obra', 'labor', null::bigint, 80),
  ('mates', 'Packaging', 'packaging', null::bigint, 90),
  ('mates', 'Merma', 'waste', null::bigint, 100),
  ('botas', 'Compra por par', 'purchase', null::bigint, 10),
  ('botas', 'Flete de entrada por par', 'freight', null::bigint, 20)
) item(category_code, name, kind, amount_minor, sort_order)
  on item.category_code = profile.category_code;
