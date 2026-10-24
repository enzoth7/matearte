-- Nombre y descripción de cada producto en inglés y portugués. La web los usa en /en y /pt y, si están
-- vacíos, muestra el texto en español. Las descripciones se arman con las mismas reglas por tipo y
-- materiales que la descripción en español; los nombres de los productos publicados se tradujeron uno por uno.

alter table public.commerce_products
  add column if not exists name_en text,
  add column if not exists name_pt text,
  add column if not exists description_en text,
  add column if not exists description_pt text;

comment on column public.commerce_products.name_en is 'Nombre en inglés; vacío = se muestra el nombre en español.';
comment on column public.commerce_products.name_pt is 'Nombre en portugués; vacío = se muestra el nombre en español.';
comment on column public.commerce_products.description_en is 'Descripción en inglés; vacía = se muestra la descripción en español.';
comment on column public.commerce_products.description_pt is 'Descripción en portugués; vacía = se muestra la descripción en español.';

-- Descripciones por tipo y materiales.
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
  -- Vocabulario de materiales y terminaciones.
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
    end || case when sale_mode = 'made_to_order' then ' Sob encomenda.' else '' end as description_pt
  from w
)
update public.commerce_products c
set description_en = coalesce(c.description_en, d.description_en),
    description_pt = coalesce(c.description_pt, d.description_pt)
from d
where c.id = d.id;

-- Nombres de los productos publicados (por slug; los que llevaban la calificación comercial ya van sin ella).
update public.commerce_products c
set name_en = coalesce(c.name_en, t.name_en),
    name_pt = coalesce(c.name_pt, t.name_pt)
from (values
  ('billetera-cuero-crudo-con-tiento', 'Raw Leather Wallet with Lacing', 'Carteira de Couro Cru com Tento'),
  ('billetera-de-dama', 'Women''s Wallet', 'Carteira Feminina'),
  ('billetera-de-hombre', 'Men''s Wallet', 'Carteira Masculina'),
  ('bombilla-cincelada', 'Chiseled Bombilla', 'Bomba Cinzelada'),
  ('bombillon-clasico', 'Classic Bombillón', 'Bombillón Clássico'),
  ('bombillon-con-aros-pico-alpaca', 'Bombillón with Rings and Alpaca Tip', 'Bombillón com Anéis e Bico de Alpaca'),
  ('bombillon-pico-alpaca', 'Bombillón with Alpaca Tip', 'Bombillón com Bico de Alpaca'),
  ('bombillon-pico-de-loro-alpaca', 'Alpaca Parrot-Beak Bombillón', 'Bombillón Bico de Papagaio de Alpaca'),
  ('bombillon-pico-de-loro-bronce', 'Bronze Parrot-Beak Bombillón', 'Bombillón Bico de Papagaio de Bronze'),
  ('bota-de-hombre-larga', 'Men''s Tall Boot', 'Bota Masculina Cano Longo'),
  ('bota-modelo-sophie', 'Sophie Boot', 'Bota Modelo Sophie'),
  ('bota-modelo-sophie-2', 'Sophie Boot', 'Bota Modelo Sophie'),
  ('bota-texana-corta', 'Short Texan Boot', 'Bota Texana Cano Curto'),
  ('bota-texana-larga', 'Tall Texan Boot', 'Bota Texana Cano Longo'),
  ('cartera-matera', 'Mate Handbag', 'Bolsa Mateira'),
  ('cinto-de-cuero-hebilla-dorada', 'Leather Belt with Gold Buckle', 'Cinto de Couro com Fivela Dourada'),
  ('cinto-de-cuero-hebilla-plateada', 'Leather Belt with Silver Buckle', 'Cinto de Couro com Fivela Prateada'),
  ('cinto-de-vestir', 'Dress Belt', 'Cinto Social'),
  ('kit-matero-cuadrado', 'Square Mate Kit', 'Kit de Mate Quadrado'),
  ('kit-matero-ovalado', 'Oval Mate Kit', 'Kit de Mate Oval'),
  ('kit-matero-ovalado-cuero-crudo', 'Oval Raw Leather Mate Kit', 'Kit de Mate Oval de Couro Cru'),
  ('mate-camionero-coleccion-estribo', 'Camionero Mate, Estribo Collection', 'Cuia Camionero Coleção Estribo'),
  ('mate-camionero-cuero-crudo-alpaca-cincelada', 'Camionero Mate, Raw Leather, Chiseled Alpaca', 'Cuia Camionero Couro Cru Alpaca Cinzelada'),
  ('mate-camionero-plata-900', 'Camionero Mate, 900 Silver', 'Cuia Camionero Prata 900'),
  ('mate-camionero-sin-patas-virola-de-acero', 'Footless Camionero Mate, Steel Rim', 'Cuia Camionero Sem Pés Virola de Aço'),
  ('mate-camionero-virola-acero-liso', 'Camionero Mate, Smooth Steel Rim', 'Cuia Camionero Virola de Aço Liso'),
  ('mate-camionero-virola-alpaca-cincelada', 'Camionero Mate, Chiseled Alpaca Rim', 'Cuia Camionero Virola de Alpaca Cinzelada'),
  ('mate-coquito-coleccion-estribo-alpaca-y-bronce', 'Coquito Mate, Estribo Collection, Alpaca and Bronze', 'Cuia Coquito Coleção Estribo Alpaca e Bronze'),
  ('mate-criollo-alpaca-grande-cincelada-con-posa-mate', 'Criollo Mate, Large Chiseled Alpaca, with Coaster', 'Cuia Criollo Alpaca Grande Cinzelada com Apoio'),
  ('mate-criollo-camionero-con-posa-mate-copa', 'Criollo Camionero Mate with Cup Coaster', 'Cuia Criollo Camionero com Apoio Taça'),
  ('mate-criollo-camionero-con-posa-mate-de-cuero-crudo-alpaca-cincelada', 'Criollo Camionero Mate, Chiseled Alpaca, with Raw Leather Coaster', 'Cuia Criollo Camionero Alpaca Cinzelada com Apoio de Couro Cru'),
  ('mate-criollo-camionero-sin-virola', 'Criollo Camionero Mate without Rim', 'Cuia Criollo Camionero sem Virola'),
  ('mate-criollo-coquito-con-posa-mate-cinta', 'Criollo Coquito Mate with Band Coaster', 'Cuia Criollo Coquito com Apoio Cinta'),
  ('mate-criollo-coquito-con-posa-mate-copa', 'Criollo Coquito Mate with Cup Coaster', 'Cuia Criollo Coquito com Apoio Taça'),
  ('mate-criollo-coquito-virola-acero-liso', 'Criollo Coquito Mate, Smooth Steel Rim', 'Cuia Criollo Coquito Virola de Aço Liso'),
  ('mate-criollo-imperial-fleje-abstracto-con-posa-mate-de-cuero-crudo', 'Criollo Imperial Mate, Abstract Band, with Raw Leather Coaster', 'Cuia Criollo Imperial Faixa Abstrata com Apoio de Couro Cru'),
  ('mate-criollo-imperial-fleje-flores-con-posa-mate-de-cuero-crudo', 'Criollo Imperial Mate, Flower Band, with Raw Leather Coaster', 'Cuia Criollo Imperial Faixa Flores com Apoio de Couro Cru'),
  ('mate-criollo-imperial-fleje-griego-con-posa-mate-de-cuero-crudo', 'Criollo Imperial Mate, Greek Band, with Raw Leather Coaster', 'Cuia Criollo Imperial Faixa Grega com Apoio de Couro Cru'),
  ('mate-criollo-imperial-fleje-liso-con-posa-mate-de-cuero-crudo', 'Criollo Imperial Mate, Plain Band, with Raw Leather Coaster', 'Cuia Criollo Imperial Faixa Lisa com Apoio de Couro Cru'),
  ('mate-criollo-imperial-fleje-pampa-con-posa-mate-de-cuero-crudo', 'Criollo Imperial Mate, Pampa Band, with Raw Leather Coaster', 'Cuia Criollo Imperial Faixa Pampa com Apoio de Couro Cru'),
  ('mate-criollo-imperial-fleje-pampa-virola-de-acero', 'Criollo Imperial Mate, Pampa Band, Steel Rim', 'Cuia Criollo Imperial Faixa Pampa Virola de Aço'),
  ('mate-criollo-premium-con-posa-mate', 'Criollo Mate, Raw Leather, Large Chiseled Alpaca, with Coaster', 'Cuia Criollo Couro Cru Alpaca Grande Cinzelada com Apoio'),
  ('mate-criollo-torpedo-alpaca-grande-cincelada-con-posa-mate', 'Criollo Torpedo Mate, Large Chiseled Alpaca, with Coaster', 'Cuia Criollo Torpedo Alpaca Grande Cinzelada com Apoio'),
  ('mate-criollo-vaqueta-personalizada-canelones', 'Personalized Cowhide Criollo Mate, Canelones', 'Cuia Criollo Vaqueta Personalizada Canelones'),
  ('mate-criollo-vaqueta-personalizada-colonia', 'Personalized Cowhide Criollo Mate, Colonia', 'Cuia Criollo Vaqueta Personalizada Colonia'),
  ('mate-criollo-vaqueta-personalizada-escudo-de-uruguay', 'Personalized Cowhide Criollo Mate, Uruguay Coat of Arms', 'Cuia Criollo Vaqueta Personalizada Brasão do Uruguai'),
  ('mate-criollo-vaqueta-personalizada-flores', 'Personalized Cowhide Criollo Mate, Flores', 'Cuia Criollo Vaqueta Personalizada Flores'),
  ('mate-criollo-vaqueta-personalizada-florida', 'Personalized Cowhide Criollo Mate, Florida', 'Cuia Criollo Vaqueta Personalizada Florida'),
  ('mate-criollo-vaqueta-personalizada-lavalleja', 'Personalized Cowhide Criollo Mate, Lavalleja', 'Cuia Criollo Vaqueta Personalizada Lavalleja'),
  ('mate-criollo-vaqueta-personalizada-maldonado', 'Personalized Cowhide Criollo Mate, Maldonado', 'Cuia Criollo Vaqueta Personalizada Maldonado'),
  ('mate-criollo-vaqueta-personalizada-montevideo', 'Personalized Cowhide Criollo Mate, Montevideo', 'Cuia Criollo Vaqueta Personalizada Montevidéu'),
  ('mate-criollo-vaqueta-personalizada-paysandu', 'Personalized Cowhide Criollo Mate, Paysandú', 'Cuia Criollo Vaqueta Personalizada Paysandú'),
  ('mate-criollo-vaqueta-personalizada-paysandu-2', 'Personalized Cowhide Criollo Mate, Paysandú', 'Cuia Criollo Vaqueta Personalizada Paysandú'),
  ('mate-criollo-vaqueta-personalizada-rio-negro', 'Personalized Cowhide Criollo Mate, Río Negro', 'Cuia Criollo Vaqueta Personalizada Río Negro'),
  ('mate-criollo-vaqueta-personalizada-rivera', 'Personalized Cowhide Criollo Mate, Rivera', 'Cuia Criollo Vaqueta Personalizada Rivera'),
  ('mate-criollo-vaqueta-personalizada-rocha', 'Personalized Cowhide Criollo Mate, Rocha', 'Cuia Criollo Vaqueta Personalizada Rocha'),
  ('mate-criollo-vaqueta-personalizada-sol-uruguayo', 'Personalized Cowhide Criollo Mate, Uruguayan Sun', 'Cuia Criollo Vaqueta Personalizada Sol Uruguaio'),
  ('mate-criollo-vaqueta-personalizada-soriano', 'Personalized Cowhide Criollo Mate, Soriano', 'Cuia Criollo Vaqueta Personalizada Soriano'),
  ('mate-criollo-vaqueta-personalizada-treinta-y-tres', 'Personalized Cowhide Criollo Mate, Treinta y Tres', 'Cuia Criollo Vaqueta Personalizada Treinta y Tres'),
  ('mate-criollo-vaqueta-personalizada-uruguay-2', 'Personalized Cowhide Criollo Mate, Uruguay', 'Cuia Criollo Vaqueta Personalizada Uruguai'),
  ('mate-criollo-vaqueta-personalizada-uruguay-fauna', 'Personalized Cowhide Criollo Mate, Uruguay Wildlife', 'Cuia Criollo Vaqueta Personalizada Fauna do Uruguai'),
  ('mate-criollo-virola-alpaca-lisa', 'Criollo Mate, Smooth Alpaca Rim', 'Cuia Criollo Virola de Alpaca Lisa'),
  ('mate-criollo-virola-alpaca-y-bronce-vaqueta-personalizada-uruguay', 'Personalized Cowhide Criollo Mate, Uruguay, Alpaca and Bronze Rim', 'Cuia Criollo Vaqueta Personalizada Uruguai Virola de Alpaca e Bronze'),
  ('mate-cuero-crudo-virola-de-plata-900', 'Raw Leather Mate, 900 Silver Rim', 'Cuia de Couro Cru Virola de Prata 900'),
  ('mate-imperial-coleccion-estribo', 'Imperial Mate, Estribo Collection', 'Cuia Imperial Coleção Estribo'),
  ('mate-imperial-croco-fleje-pampa', 'Imperial Mate, Croc Leather, Pampa Band', 'Cuia Imperial Croco Faixa Pampa'),
  ('mate-imperial-cuero-crudo-sin-patas-con-posa-mate-de-cuero-crudo', 'Footless Imperial Mate, Raw Leather, with Raw Leather Coaster', 'Cuia Imperial Couro Cru Sem Pés com Apoio de Couro Cru'),
  ('mate-imperial-cuero-crudo-sin-patas-fleje-griego', 'Footless Imperial Mate, Raw Leather, Greek Band', 'Cuia Imperial Couro Cru Sem Pés Faixa Grega'),
  ('mate-imperial-fleje-abstracto', 'Imperial Mate, Abstract Band', 'Cuia Imperial Faixa Abstrata'),
  ('mate-imperial-fleje-flores', 'Imperial Mate, Flower Band', 'Cuia Imperial Faixa Flores'),
  ('mate-imperial-fleje-griego', 'Imperial Mate, Greek Band', 'Cuia Imperial Faixa Grega'),
  ('mate-imperial-fleje-laureles', 'Imperial Mate, Laurel Band', 'Cuia Imperial Faixa Louros'),
  ('mate-imperial-fleje-liso', 'Imperial Mate, Plain Band', 'Cuia Imperial Faixa Lisa'),
  ('mate-imperial-fleje-liso-pelos', 'Imperial Mate, Plain Band, Hair-on Leather', 'Cuia Imperial Faixa Lisa Couro com Pelo'),
  ('mate-imperial-fleje-manos', 'Imperial Mate, Hands Band', 'Cuia Imperial Faixa Mãos'),
  ('mate-imperial-fleje-pampa', 'Imperial Mate, Pampa Band', 'Cuia Imperial Faixa Pampa'),
  ('mate-imperial-forrado-en-cuero-crudo-sin-patas-con-posa-mate-de-cuero-crudo-cinta-pampa', 'Footless Imperial Mate Covered in Raw Leather, Pampa Ribbon, with Raw Leather Coaster', 'Cuia Imperial Revestida em Couro Cru Sem Pés Fita Pampa com Apoio de Couro Cru'),
  ('mate-imperial-pie-de-alpaca-fleje-flores', 'Imperial Mate, Alpaca Base, Flower Band', 'Cuia Imperial Pé de Alpaca Faixa Flores'),
  ('mate-imperial-pie-de-alpaca-fleje-griego', 'Imperial Mate, Alpaca Base, Greek Band', 'Cuia Imperial Pé de Alpaca Faixa Grega'),
  ('mate-imperial-pie-de-alpaca-fleje-pampa', 'Imperial Mate, Alpaca Base, Pampa Band', 'Cuia Imperial Pé de Alpaca Faixa Pampa'),
  ('mate-imperial-premium', 'Imperial Mate, Smooth Leather', 'Cuia Imperial Couro Liso'),
  ('mate-imperial-premium-auf', 'Imperial Mate, AUF', 'Cuia Imperial AUF'),
  ('mate-torpedo-acero-liso', 'Torpedo Mate, Smooth Steel', 'Cuia Torpedo Aço Liso'),
  ('mate-torpedo-alpaca-cincelada-pelos', 'Torpedo Mate, Chiseled Alpaca, Hair-on Leather', 'Cuia Torpedo Alpaca Cinzelada Couro com Pelo'),
  ('mate-torpedo-alpaca-cincelado-premium', 'Torpedo Mate, Chiseled Alpaca', 'Cuia Torpedo Alpaca Cinzelada'),
  ('mate-torpedo-alpaca-grande-cincelada', 'Torpedo Mate, Large Chiseled Alpaca', 'Cuia Torpedo Alpaca Grande Cinzelada'),
  ('mate-torpedo-alpaca-premium', 'Torpedo Mate, Alpaca', 'Cuia Torpedo Alpaca'),
  ('mate-torpedo-cuerdo-crudo-alpaca-lisa', 'Torpedo Mate, Raw Leather, Smooth Alpaca', 'Cuia Torpedo Couro Cru Alpaca Lisa'),
  ('mate-torpedo-cuero-crudo-alpaca-grande-cincelada', 'Torpedo Mate, Raw Leather, Large Chiseled Alpaca', 'Cuia Torpedo Couro Cru Alpaca Grande Cinzelada'),
  ('mate-torpedo-cuero-estampado', 'Torpedo Mate, Embossed Leather', 'Cuia Torpedo Couro Estampado'),
  ('mate-torpedo-cuero-estampado-alpaca-cincelada', 'Torpedo Mate, Embossed Leather, Chiseled Alpaca', 'Cuia Torpedo Couro Estampado Alpaca Cinzelada'),
  ('mate-torpedo-cuero-estampado-alpaca-grande-cincelada', 'Torpedo Mate, Embossed Leather, Large Chiseled Alpaca', 'Cuia Torpedo Couro Estampado Alpaca Grande Cinzelada'),
  ('mate-torpedo-cuero-estampado-alpaca-grande-lisa', 'Torpedo Mate, Embossed Leather, Large Smooth Alpaca', 'Cuia Torpedo Couro Estampado Alpaca Grande Lisa'),
  ('mate-torpedo-cuero-estampado-pie-de-alpaca', 'Torpedo Mate, Embossed Leather, Alpaca Base', 'Cuia Torpedo Couro Estampado Pé de Alpaca'),
  ('mate-torpedo-cuero-estampado-virola-alpaca-y-bronce', 'Torpedo Mate, Embossed Leather, Alpaca and Bronze Rim', 'Cuia Torpedo Couro Estampado Virola de Alpaca e Bronze'),
  ('mate-torpedo-cuero-liso-alpaca-cincelada', 'Torpedo Mate, Smooth Leather, Chiseled Alpaca', 'Cuia Torpedo Couro Liso Alpaca Cinzelada'),
  ('mate-torpedo-cuero-liso-alpaca-grande-lisa', 'Torpedo Mate, Smooth Leather, Large Smooth Alpaca', 'Cuia Torpedo Couro Liso Alpaca Grande Lisa'),
  ('mate-torpedo-cuero-liso-virola-alpaca-y-bronce', 'Torpedo Mate, Smooth Leather, Alpaca and Bronze Rim', 'Cuia Torpedo Couro Liso Virola de Alpaca e Bronze'),
  ('mate-torpedo-pelos-premium', 'Torpedo Mate, Hair-on Leather', 'Cuia Torpedo Couro com Pelo'),
  ('mate-torpedo-personalizado-auf', 'Personalized Torpedo Mate, AUF', 'Cuia Torpedo Personalizada AUF'),
  ('mate-torpedo-personalizado-auf-2', 'Personalized Torpedo Mate, AUF', 'Cuia Torpedo Personalizada AUF'),
  ('mate-torpedo-plata-900', 'Torpedo Mate, 900 Silver', 'Cuia Torpedo Prata 900'),
  ('mate-torpedo-premium-pie-de-alpaca', 'Torpedo Mate, Alpaca Base', 'Cuia Torpedo Pé de Alpaca'),
  ('mate-torpedo-virola-alpaca-y-bronce-croco', 'Torpedo Mate, Croc Leather, Alpaca and Bronze Rim', 'Cuia Torpedo Croco Virola de Alpaca e Bronze'),
  ('mate-torpedo-virola-de-alpaca-croco', 'Torpedo Mate, Croc Leather, Alpaca Rim', 'Cuia Torpedo Croco Virola de Alpaca'),
  ('matera-cuadrada', 'Square Mate Bag', 'Mateira Quadrada'),
  ('matera-cuadrada-auf', 'Square Mate Bag, AUF', 'Mateira Quadrada AUF'),
  ('matera-cuadrada-de-futbol', 'Square Football Mate Bag', 'Mateira Quadrada de Futebol'),
  ('matera-cuero-crudo-aza-con-argolla', 'Raw Leather Mate Bag with Ring Handle', 'Mateira de Couro Cru com Alça de Argola'),
  ('matera-cuero-crudo-aza-trenzada', 'Raw Leather Mate Bag with Braided Handle', 'Mateira de Couro Cru com Alça Trançada'),
  ('matera-estampada', 'Embossed Mate Bag', 'Mateira Estampada'),
  ('matera-ovalada', 'Oval Mate Bag', 'Mateira Oval'),
  ('matera-ovalada-auf', 'Oval Mate Bag, AUF', 'Mateira Oval AUF'),
  ('tarjetero-de-dama', 'Women''s Card Holder', 'Porta-Cartões Feminino'),
  ('termo-termolar', 'Termolar Thermos', 'Garrafa Térmica Termolar'),
  ('termo-stanley-2', 'Stanley Thermos', 'Garrafa Térmica Stanley'),
  ('termo-stanley-con-manija', 'Stanley Thermos with Handle', 'Garrafa Térmica Stanley com Alça'),
  ('termo-termolar-forrado-en-cuero-con-tiento', 'Termolar Thermos Covered in Leather with Lacing', 'Garrafa Térmica Termolar Revestida em Couro com Tento'),
  ('yerbera-de-cuero-estampa-uruguay', 'Leather Yerba Holder with Uruguay Print', 'Erveira de Couro Estampa Uruguai'),
  ('yerbero-de-cuero', 'Leather Yerba Holder', 'Erveira de Couro')
) as t(slug, name_en, name_pt)
where c.editorial_slug = t.slug;
