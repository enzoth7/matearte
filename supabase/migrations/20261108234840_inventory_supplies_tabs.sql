alter table public.inventory_cost_lines
  add column group_name text not null default 'Otros'
    check (length(trim(group_name)) between 1 and 60);

alter table public.inventory_cost_lines
  drop constraint inventory_cost_lines_kind_check;
alter table public.inventory_cost_lines
  add constraint inventory_cost_lines_kind_check
  check (kind in ('material', 'supply', 'option', 'labor', 'packaging', 'waste', 'purchase', 'freight'));

update public.inventory_cost_lines
set group_name = case name
  when 'Mate base' then 'Cuerpo'
  when 'Cuero' then 'Cuero'
  when 'Fleje de alpaca base' then 'Fleje'
  when 'Virola' then 'Virola'
  when 'Adhesivos y consumibles' then 'Consumibles'
  else 'Otros' end
where profile_id = (select id from public.inventory_cost_profiles where category_code = 'mates');

insert into public.inventory_cost_lines
  (profile_id, name, group_name, kind, amount_minor, sort_order)
select profile.id, item.name, item.group_name, 'supply', null, item.sort_order
from public.inventory_cost_profiles profile
join (values
  ('Calabaza', 'Cuerpo', 110),
  ('Cuerpo de madera', 'Cuerpo', 120),
  ('Cuerpo de cerámica', 'Cuerpo', 130),
  ('Cuerpo de acero inoxidable', 'Cuerpo', 140),
  ('Cuero crudo', 'Cuero', 210),
  ('Cuero vaqueta', 'Cuero', 220),
  ('Cuero estampado', 'Cuero', 230),
  ('Cuero croco', 'Cuero', 240),
  ('Cuero con pelos', 'Cuero', 250),
  ('Fleje de acero', 'Fleje', 310),
  ('Fleje de alpaca y bronce', 'Fleje', 320),
  ('Fleje de plata', 'Fleje', 330),
  ('Virola de acero', 'Virola', 410),
  ('Virola de alpaca', 'Virola', 420),
  ('Virola de alpaca y bronce', 'Virola', 430),
  ('Virola de plata', 'Virola', 440),
  ('Pie de alpaca', 'Pie y posamate', 510),
  ('Posamate de cuero crudo', 'Pie y posamate', 520)
) item(name, group_name, sort_order) on true
where profile.category_code = 'mates';
