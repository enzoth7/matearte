alter table public.commerce_products
  add column if not exists name_en text,
  add column if not exists name_pt text,
  add column if not exists description_en text,
  add column if not exists description_pt text;

comment on column public.commerce_products.name_en is 'Nombre en inglés; vacío = se muestra el nombre en español.';
comment on column public.commerce_products.name_pt is 'Nombre en portugués; vacío = se muestra el nombre en español.';
comment on column public.commerce_products.description_en is 'Descripción en inglés; vacía = se muestra la descripción en español.';
comment on column public.commerce_products.description_pt is 'Descripción en portugués; vacía = se muestra la descripción en español.';

with p as (
  select id, category_code as cat, sale_mode, coalesce(attributes, '{}'::jsonb) as a
  from public.commerce_products
  where category not in ('sandbox', 'servicios')
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
), w as (
  select x.*,
    case cuero when 'crudo' then 'raw' when 'liso' then 'smooth' when 'croco' then 'croc' when 'estampado' then 'embossed' when 'pelos' then 'hair-on' end as cuero_en,
    case cuero when 'crudo' then 'cru' when 'liso' then 'liso' when 'croco' then 'croco' when 'estampado' then 'estampado' when 'pelos' then 'com pelo' end as cuero_pt,
    case virola
      when 'alpaca cincelada' then 'chiseled alpaca' when 'alpaca grande cincelada' then 'large chiseled alpaca'
      when 'alpaca grande lisa' then 'large smooth alpaca' when 'alpaca y bronce' then 'alpaca and bronze'
      when 'acero liso' then 'smooth steel' when 'acero' then 'steel' when 'acero cincelado' then 'chiseled steel'
      when 'acero y bronce liso' then 'smooth steel and bronze' when 'plata' then 'silver' when 'alpaca' then 'alpaca'
      when 'acero inoxidable' then 'stainless steel' when 'alpaca lisa' then 'smooth alpaca' else virola end as virola_en,
    case virola
      when 'alpaca cincelada' then 'alpaca cinzelada' when 'alpaca grande cincelada' then 'alpaca grande cinzelada'
      when 'alpaca grande lisa' then 'alpaca grande lisa' when 'alpaca y bronce' then 'alpaca e bronze'
      when 'acero liso' then 'aço liso' when 'acero' then 'aço' when 'acero cincelado' then 'aço cinzelado'
      when 'acero y bronce liso' then 'aço e bronze liso' when 'plata' then 'prata' when 'alpaca' then 'alpaca'
      when 'acero inoxidable' then 'aço inoxidável' when 'alpaca lisa' then 'alpaca lisa' else virola end as virola_pt,
    case fleje when 'abstracto' then 'abstract' when 'flores' then 'flower' when 'griego' then 'Greek' when 'liso' then 'plain'
      when 'pampa' then 'pampa' when 'laureles' then 'laurel' when 'manos' then 'hands' when 'rupestre' then 'rock art' else fleje end as fleje_en,
    case fleje when 'abstracto' then 'abstrata' when 'flores' then 'flores' when 'griego' then 'grega' when 'liso' then 'lisa'
      when 'pampa' then 'pampa' when 'laureles' then 'louros' when 'manos' then 'mãos' when 'rupestre' then 'rupestre' else fleje end as fleje_pt,
    case coalesce(material, 'cuero') when 'cuero' then 'leather' when 'cuero crudo' then 'raw leather' when 'croco' then 'croc leather'
      when 'gamuza' then 'suede' when 'charol' then 'patent leather' when 'estampado' then 'embossed leather' when 'acero inoxidable' then 'stainless steel' else material end as material_en,
    case coalesce(material, 'cuero') when 'cuero' then 'couro' when 'cuero crudo' then 'couro cru' when 'croco' then 'couro croco'
      when 'gamuza' then 'camurça' when 'charol' then 'verniz' when 'estampado' then 'couro estampado' when 'acero inoxidable' then 'aço inoxidável' else material end as material_pt,
    case cuerpo when 'alpaca' then 'alpaca' when 'acero inoxidable' then 'stainless steel' when 'acero' then 'steel' when 'bronce' then 'bronze' else cuerpo end as cuerpo_en,
    case cuerpo when 'alpaca' then 'alpaca' when 'acero inoxidable' then 'aço inoxidável' when 'acero' then 'aço' when 'bronce' then 'bronze' else cuerpo end as cuerpo_pt,
    case pico when 'alpaca' then 'alpaca' when 'bronce' then 'bronze' when 'acero' then 'steel' else pico end as pico_en,
    case pico when 'alpaca' then 'alpaca' when 'bronce' then 'bronze' when 'acero' then 'aço' else pico end as pico_pt,
    case genero when 'mujer' then 'women''s ' when 'hombre' then 'men''s ' else '' end as genero_en,
    case genero when 'mujer' then ' feminina' when 'hombre' then ' masculina' else '' end as genero_pt_f,
    case genero when 'mujer' then ' feminino' when 'hombre' then ' masculino' else '' end as genero_pt_m
  from x
), d as (
  select id,
    case
      when cat in ('mates', 'personalizados') then
        'Handmade ' || case when cat = 'personalizados' then 'personalized ' else '' end || coalesce(tipo || ' ', '') || 'mate'
        || case
             when mmate = 'calabaza' then ' in gourd' || case when cuero_en is not null then ' covered in ' || cuero_en || ' leather' else '' end
             when mmate = 'cerámica' then ' in ceramic' || case when cuero_en is not null then ' covered in ' || cuero_en || ' leather' else '' end
             when cuero_en is not null then ' covered in ' || cuero_en || ' leather'
             else ''
           end
        || case when virola is null or virola = 'sin virola' then '' when virola = 'imperial' then ', with imperial rim'
                when virola like 'imperial %' then ', with imperial rim in ' || substr(virola, 10) else ', with ' || virola_en || ' rim' end
        || case when fleje is not null and fleje <> '' then ' and ' || fleje_en || ' band' else '' end
        || case when pie = 'alpaca' then ', alpaca base' else '' end
        || '.' || case when posamate = 'con posamate' then ' Includes coaster.' else '' end
      when cat = 'bombillas' then
        'Handmade ' || case when tbomb = 'bombillón' then 'bombillón' else 'bombilla' end || coalesce(' in ' || cuerpo_en, '')
        || case when fpico like '%loro%' then ', with parrot-beak tip' || coalesce(' in ' || pico_en, '') else coalesce(', with ' || pico_en || ' tip', '') end
        || case deco when 'cincelada' then ' and chiseled finish' when 'con aros' then ' and rings' else '' end || '.'
      when cat = 'termos' then
        case when material like 'cuero%' then 'Thermos covered in ' || material_en else 'Stainless steel thermos' end || coalesce(', ' || cap || ' ml', '') || '.'
      when cat = 'materas' then 'Handmade ' || case forma when 'ovalada' then 'oval ' when 'cuadrada' then 'square ' else '' end || 'mate bag in ' || case when material = 'estampado' then 'embossed leather' else 'leather' end || '.'
      when cat = 'kits-materos' then 'Handmade leather mate kit.'
      when cat = 'botas' then 'Handmade ' || genero_en || 'boot in ' || material_en || '.'
      when cat = 'billeteras' then 'Handmade ' || genero_en || 'wallet in ' || material_en || '.'
      when cat = 'tarjeteros' then 'Handmade ' || genero_en || 'card holder in ' || material_en || '.'
      when cat = 'carteras' then 'Handmade bag in ' || material_en || '.'
      when cat = 'cintos' then 'Handmade belt in ' || material_en || '.'
      when cat = 'yerberos' then 'Handmade leather yerba holder.'
      when cat = 'bandolera' then 'Handmade crossbody bag in ' || material_en || '.'
      when cat = 'posa-mates' then 'Handmade mate coaster in ' || material_en || '.'
      when cat = 'zapatos' then 'Handmade ' || genero_en || 'shoe in ' || material_en || '.'
      when cat = 'zuecos' then 'Handmade ' || genero_en || 'clog in ' || material_en || '.'
    end || case when sale_mode = 'made_to_order' then ' Made to order.' else '' end as description_en,
    case
      when cat in ('mates', 'personalizados') then
        'Cuia ' || coalesce(tipo || ' ', '') || case when cat = 'personalizados' then 'personalizada ' else '' end || 'feita à mão'
        || case
             when mmate = 'calabaza' then ' em cabaça' || case when cuero_pt is not null then ' revestida em couro ' || cuero_pt else '' end
             when mmate = 'cerámica' then ' em cerâmica' || case when cuero_pt is not null then ' revestida em couro ' || cuero_pt else '' end
             when cuero_pt is not null then ' revestida em couro ' || cuero_pt
             else ''
           end
        || case when virola is null or virola = 'sin virola' then '' when virola = 'imperial' then ', com virola imperial'
                when virola like 'imperial %' then ', com virola imperial de ' || substr(virola, 10) else ', com virola de ' || virola_pt end
        || case when fleje is not null and fleje <> '' then ' e faixa ' || fleje_pt else '' end
        || case when pie = 'alpaca' then ', pé de alpaca' else '' end
        || '.' || case when posamate = 'con posamate' then ' Inclui apoio para cuia.' else '' end
      when cat = 'bombillas' then
        case when tbomb = 'bombillón' then 'Bombillón feito à mão' else 'Bomba feita à mão' end || coalesce(' em ' || cuerpo_pt, '')
        || case when fpico like '%loro%' then ', com bico de papagaio' || coalesce(' de ' || pico_pt, '') else coalesce(', com bico de ' || pico_pt, '') end
        || case deco when 'cincelada' then ' e acabamento cinzelado' when 'con aros' then ' e anéis' else '' end || '.'
      when cat = 'termos' then
        case when material like 'cuero%' then 'Garrafa térmica revestida em ' || material_pt else 'Garrafa térmica de aço inoxidável' end || coalesce(', ' || cap || ' ml', '') || '.'
      when cat = 'materas' then 'Mateira ' || case forma when 'ovalada' then 'oval ' when 'cuadrada' then 'quadrada ' else '' end || 'feita à mão em ' || case when material = 'estampado' then 'couro estampado' else 'couro' end || '.'
      when cat = 'kits-materos' then 'Kit de mate feito à mão em couro.'
      when cat = 'botas' then 'Bota' || genero_pt_f || ' feita à mão em ' || material_pt || '.'
      when cat = 'billeteras' then 'Carteira' || genero_pt_f || ' feita à mão em ' || material_pt || '.'
      when cat = 'tarjeteros' then 'Porta-cartões' || genero_pt_m || ' feito à mão em ' || material_pt || '.'
      when cat = 'carteras' then 'Bolsa feita à mão em ' || material_pt || '.'
      when cat = 'cintos' then 'Cinto feito à mão em ' || material_pt || '.'
      when cat = 'yerberos' then 'Erveira feita à mão em couro.'
      when cat = 'bandolera' then 'Bolsa transversal feita à mão em ' || material_pt || '.'
      when cat = 'posa-mates' then 'Apoio para cuia feito à mão em ' || material_pt || '.'
      when cat = 'zapatos' then 'Sapato' || genero_pt_m || ' feito à mão em ' || material_pt || '.'
      when cat = 'zuecos' then 'Tamanco' || genero_pt_m || ' feito à mão em ' || material_pt || '.'
    end || case when sale_mode = 'made_to_order' then ' Feito sob encomenda.' else '' end as description_pt
  from w
)
update public.commerce_products c
set description_en = coalesce(c.description_en, d.description_en),
    description_pt = coalesce(c.description_pt, d.description_pt)
from d
where c.id = d.id;
