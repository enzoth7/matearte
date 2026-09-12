-- Add 'cuadrada' option for 'forma' attribute (materas)

insert into public.commerce_attribute_options (attribute_code, code, label_es, swatch_hex, sort_order)
values ('forma', 'cuadrada', 'Cuadrada', null, 20)
on conflict (attribute_code, code) do update set
  label_es = excluded.label_es,
  sort_order = excluded.sort_order;
