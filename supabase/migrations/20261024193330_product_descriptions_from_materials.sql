-- Descripción corta para los productos publicados que no tenían texto en Gestión.
-- Se arma con el tipo de producto y sus materiales ("Mate torpedo hecho a mano forrado en cuero liso,
-- con virola de alpaca cincelada."). Queda guardada en commerce_products.description, así que se
-- edita desde la ficha del producto en Gestión. Los productos que ya tenían texto no se tocan.

with p as (
  select id, name, category_code as cat, sale_mode, coalesce(attributes, '{}'::jsonb) as a
  from public.commerce_products
  where published and category <> 'sandbox' and coalesce(trim(description), '') = ''
), l as (
  select p.id, e.k,
    trim(regexp_replace(lower(coalesce(o.label_es, replace(e.v, '-', ' '))), '\s*premium\M', '', 'gi')) as label
  from p
  cross join lateral jsonb_each_text(p.a) as e(k, v)
  left join public.commerce_attribute_options o on o.attribute_code = e.k and o.code = e.v
  where e.v not in ('', 'todos') and e.v !~ '^\['
), x as (
  select p.id, p.cat, p.sale_mode,
    max(label) filter (where k = 'tipo-mate') as tipo,
    max(label) filter (where k = 'material-mate') as mmate,
    max(label) filter (where k = 'tipo-cuero') as cuero,
    max(label) filter (where k = 'tipo-virola') as virola,
    max(label) filter (where k = 'diseno-fleje') as fleje,
    max(label) filter (where k = 'posamate') as posamate,
    max(label) filter (where k = 'pie') as pie,
    max(label) filter (where k = 'material') as material,
    max(label) filter (where k = 'tipo-bombilla') as tbomb,
    max(label) filter (where k = 'material-cuerpo') as cuerpo,
    max(label) filter (where k = 'material-pico') as pico,
    max(label) filter (where k = 'forma-pico') as fpico,
    max(label) filter (where k = 'decoracion') as deco,
    max(label) filter (where k = 'forma') as forma,
    max(label) filter (where k = 'capacidad-ml') as cap,
    max(label) filter (where k = 'genero') as genero
  from p left join l on l.id = p.id
  group by p.id, p.cat, p.sale_mode
), d as (
  select id,
    case
      when cat in ('mates', 'personalizados') then
        'Mate ' || coalesce(tipo || ' ', '') || case when cat = 'personalizados' then 'personalizado ' else '' end || 'hecho a mano'
        || case
             when mmate = 'calabaza' then ' en calabaza' || case when cuero is not null and cuero <> 'sin cuero' then ' forrada en cuero ' || case cuero when 'pelos' then 'con pelo' else cuero end else '' end
             when mmate = 'cerámica' then ' en cerámica' || case when cuero is not null and cuero <> 'sin cuero' then ' forrada en cuero ' || cuero else '' end
             when cuero is not null and cuero <> 'sin cuero' then ' forrado en cuero ' || case cuero when 'pelos' then 'con pelo' else cuero end
             else ''
           end
        || case
             when virola is null or virola = 'sin virola' then ''
             when virola = 'imperial' then ', con virola imperial'
             else ', con virola de ' || virola
           end
        || case when fleje is not null and fleje <> '' then ' y fleje ' || fleje else '' end
        || case when pie = 'alpaca' then ', pie de alpaca' else '' end
        || '.'
        || case when posamate = 'con posamate' then ' Incluye posamate.' else '' end
      when cat = 'bombillas' then
        case when tbomb = 'bombillón' then 'Bombillón hecho a mano' else 'Bombilla hecha a mano' end
        || coalesce(' en ' || cuerpo, '')
        || case
             when fpico like '%loro%' then ', con pico de loro' || coalesce(' de ' || pico, '')
             else coalesce(', con pico de ' || pico, '')
           end
        || case deco when 'cincelada' then ' y terminación cincelada' when 'con aros' then ' y aros' else '' end
        || '.'
      when cat = 'termos' then
        case when material like 'cuero%' then 'Termo forrado en ' || material else 'Termo de ' || coalesce(material, 'acero inoxidable') end
        || coalesce(' de ' || cap || ' ml', '') || '.'
      when cat = 'materas' then
        'Matera ' || coalesce(forma || ' ', '') || 'hecha a mano en cuero' || case when material = 'estampado' then ' estampado' else '' end || '.'
      when cat = 'kits-materos' then 'Kit matero hecho a mano en cuero.'
      when cat = 'botas' then 'Bota' || coalesce(' de ' || genero, '') || ' hecha a mano en ' || coalesce(material, 'cuero') || '.'
      when cat = 'billeteras' then 'Billetera' || coalesce(' de ' || genero, '') || ' hecha a mano en ' || coalesce(material, 'cuero') || '.'
      when cat = 'tarjeteros' then 'Tarjetero' || coalesce(' de ' || genero, '') || ' hecho a mano en ' || coalesce(material, 'cuero') || '.'
      when cat = 'carteras' then 'Cartera hecha a mano en ' || coalesce(material, 'cuero') || '.'
      when cat = 'cintos' then 'Cinto hecho a mano en ' || coalesce(material, 'cuero') || '.'
      when cat = 'yerberos' then 'Yerbero hecho a mano en cuero.'
    end
    || case when sale_mode = 'made_to_order' then ' Se hace por encargo.' else '' end as description
  from x
)
update public.commerce_products c
set description = d.description
from d
where c.id = d.id and d.description is not null;
