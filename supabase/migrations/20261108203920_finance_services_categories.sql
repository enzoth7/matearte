insert into public.expense_categories (name, kind)
select item.name, 'compra'
from (values ('Servicios públicos'), ('Telefonía e internet'),
  ('Producción tercerizada'), ('Honorarios profesionales'), ('Mantenimiento')) item(name)
where not exists (select 1 from public.expense_categories existing where existing.name = item.name);

update public.expense_categories set kind = 'ambas'
where name = 'Software y suscripciones';

update public.purchases set category = 'Servicios públicos'
where category = 'Servicios' and (
  description ilike '%UTE%' or description ilike '%OSE%');

update public.purchases set category = 'Telefonía e internet'
where category = 'Servicios' and (
  description ilike '%ANTEL%' or description like 'Teléfono - cuenta Flor%');

update public.purchases set category = 'Producción tercerizada'
where category = 'Servicios' and (
  description = 'Forrado de Mates' or description like 'Trabajos externos de marroquinería%'
  or description like 'Cincelado de virolas%' or description like 'Armado de mates%'
  or description like 'Armado de 30 mates%' or description like 'Robert - armado de mates%');

update public.purchases set category = 'Honorarios profesionales'
where category = 'Servicios' and description like 'Honorarios de escribano%';

update public.purchases set category = 'Software y suscripciones'
where category = 'Servicios' and description = 'Pago de servicios Uruware';

update public.purchases set category = 'Mantenimiento'
where category = 'Servicios' and description in ('Reparación de impresora', 'Limpieza de galpón');
