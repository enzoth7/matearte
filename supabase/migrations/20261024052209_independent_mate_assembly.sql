-- Independent mate assemblies use existing versioned prices and local-sales views.
create or replace function public.get_mate_assembly_fields() returns jsonb language sql immutable security invoker set search_path='' as $fields$ select '[{"code":"tipo-mate","label":"Modelo","options":[{"value":"imperial","label":"Imperial","ruleKey":"family:imperial","initialPrice":2600},{"value":"camionero","label":"Camionero","ruleKey":"family:camionero","initialPrice":1800},{"value":"criollo","label":"Criollo","ruleKey":"family:criollo","initialPrice":0},{"value":"torpedo","label":"Torpedo","ruleKey":"family:torpedo","initialPrice":1800}]},{"code":"forma-criollo","label":"Forma del criollo","options":[{"value":"imperial","label":"Imperial","ruleKey":"tree:criollo:imperial-criollo-posa-mate","initialPrice":2100},{"value":"torpedo","label":"Torpedo","ruleKey":"tree:criollo:torpedo-criollo-posa-mate","initialPrice":1300},{"value":"camionero","label":"Camionero","ruleKey":"tree:criollo:camionero-criollo-posa-mate","initialPrice":1300}]},{"code":"interior","label":"Interior","options":[{"value":"calabaza","label":"Calabaza","ruleKey":"assembly:interior:calabaza","initialPrice":0},{"value":"ceramica","label":"Cerámica","ruleKey":"assembly:interior:ceramica","initialPrice":0},{"value":"madera","label":"Madera","ruleKey":"assembly:interior:madera","initialPrice":0},{"value":"acero-inoxidable","label":"Acero inoxidable","ruleKey":"assembly:interior:acero-inoxidable","initialPrice":0}]},{"code":"tipo-cuero","label":"Cuero o textura","options":[{"value":"sin-cuero","label":"Sin Cuero","ruleKey":"assembly:tipo-cuero:sin-cuero","initialPrice":0},{"value":"liso","label":"Liso","ruleKey":"assembly:tipo-cuero:liso","initialPrice":0},{"value":"crudo","label":"Crudo","ruleKey":"leather:raw","initialPrice":600},{"value":"estampado","label":"Estampado","ruleKey":"leather:stamped","initialPrice":200},{"value":"croco","label":"Croco","ruleKey":"assembly:tipo-cuero:croco","initialPrice":600},{"value":"pelos","label":"Pelos","ruleKey":"leather:print-pelos","initialPrice":600},{"value":"vaqueta","label":"Vaqueta","ruleKey":"leather:vaqueta","initialPrice":400}]},{"code":"color","label":"Color","options":[{"value":"marron","label":"Marrón","ruleKey":"assembly:color:marron","initialPrice":0},{"value":"negro","label":"Negro","ruleKey":"assembly:color:negro","initialPrice":0},{"value":"natural","label":"Natural","ruleKey":"assembly:color:natural","initialPrice":0},{"value":"cuero-crudo","label":"Cuero crudo","ruleKey":"assembly:color:cuero-crudo","initialPrice":0},{"value":"rojo","label":"Rojo","ruleKey":"assembly:color:rojo","initialPrice":0},{"value":"blanco","label":"Blanco","ruleKey":"assembly:color:blanco","initialPrice":0},{"value":"rosado","label":"Rosado","ruleKey":"assembly:color:rosado","initialPrice":0},{"value":"gris","label":"Gris","ruleKey":"assembly:color:gris","initialPrice":0},{"value":"dorado","label":"Dorado","ruleKey":"assembly:color:dorado","initialPrice":0},{"value":"celeste","label":"Celeste","ruleKey":"assembly:color:celeste","initialPrice":0},{"value":"azul","label":"Azul","ruleKey":"assembly:color:azul","initialPrice":0},{"value":"beige","label":"Beige","ruleKey":"assembly:color:beige","initialPrice":0},{"value":"metalico","label":"Metálico","ruleKey":"assembly:color:metalico","initialPrice":0},{"value":"marron-claro","label":"Marrón claro","ruleKey":"assembly:color:marron-claro","initialPrice":0},{"value":"chocolate","label":"Chocolate","ruleKey":"assembly:color:chocolate","initialPrice":0},{"value":"mostaza","label":"Mostaza","ruleKey":"assembly:color:mostaza","initialPrice":0},{"value":"plateado","label":"Plateado","ruleKey":"assembly:color:plateado","initialPrice":0},{"value":"negro-dorado","label":"Negro/Dorado","ruleKey":"assembly:color:negro-dorado","initialPrice":0},{"value":"marron-dorado","label":"Marrón/Dorado","ruleKey":"assembly:color:marron-dorado","initialPrice":0},{"value":"blanco-plateado","label":"Blanco/Plateado","ruleKey":"assembly:color:blanco-plateado","initialPrice":0},{"value":"blanco-dorado","label":"Blanco/Dorado","ruleKey":"assembly:color:blanco-dorado","initialPrice":0},{"value":"marron-blanco","label":"Marrón/Blanco","ruleKey":"assembly:color:marron-blanco","initialPrice":0},{"value":"negro-marron","label":"Negro/Marrón","ruleKey":"assembly:color:negro-marron","initialPrice":0},{"value":"beige-dorado","label":"Beige/Dorado","ruleKey":"assembly:color:beige-dorado","initialPrice":0},{"value":"negro-blanco","label":"Negro/Blanco","ruleKey":"assembly:color:negro-blanco","initialPrice":0},{"value":"dorado-natural","label":"Dorado/Natural","ruleKey":"assembly:color:dorado-natural","initialPrice":0},{"value":"marron-rojo","label":"Marrón/Rojo","ruleKey":"assembly:color:marron-rojo","initialPrice":0},{"value":"mostaza-chocolate","label":"Mostaza/Chocolate","ruleKey":"assembly:color:mostaza-chocolate","initialPrice":0},{"value":"marron-beige","label":"Marrón/Beige","ruleKey":"assembly:color:marron-beige","initialPrice":0},{"value":"animal-print","label":"Animal print","ruleKey":"assembly:color:animal-print","initialPrice":0}]},{"code":"tipo-virola","label":"Virola","options":[{"value":"acero","label":"Acero","ruleKey":"assembly:tipo-virola:acero","initialPrice":0},{"value":"acero-cincelado","label":"Acero Cincelado","ruleKey":"assembly:tipo-virola:acero-cincelado","initialPrice":100},{"value":"acero-liso","label":"Acero Liso","ruleKey":"assembly:tipo-virola:acero-liso","initialPrice":0},{"value":"acero-y-bronce-liso","label":"Acero y Bronce Liso","ruleKey":"assembly:tipo-virola:acero-y-bronce-liso","initialPrice":200},{"value":"alpaca","label":"Alpaca","ruleKey":"assembly:tipo-virola:alpaca","initialPrice":0},{"value":"alpaca-cincelada","label":"Alpaca Cincelada","ruleKey":"assembly:tipo-virola:alpaca-cincelada","initialPrice":0},{"value":"alpaca-comun","label":"Alpaca Común","ruleKey":"assembly:tipo-virola:alpaca-comun","initialPrice":0},{"value":"alpaca-grande-cincelada","label":"Alpaca Grande Cincelada","ruleKey":"metal:alpaca-grande","initialPrice":300},{"value":"alpaca-grande-cincelada-premium","label":"Alpaca Grande Cincelada Premium","ruleKey":"assembly:tipo-virola:alpaca-grande-cincelada-premium","initialPrice":2300},{"value":"alpaca-grande-lisa","label":"Alpaca Grande Lisa","ruleKey":"metal:alpaca-grande","initialPrice":300},{"value":"alpaca-y-bronce","label":"Alpaca y Bronce","ruleKey":"metal:alpaca-bronce","initialPrice":300},{"value":"imperial","label":"Imperial","ruleKey":"assembly:tipo-virola:imperial","initialPrice":0},{"value":"acero-inoxidable","label":"Imperial Acero Inoxidable","ruleKey":"assembly:tipo-virola:acero-inoxidable","initialPrice":0},{"value":"imperial-premium","label":"Imperial Premium","ruleKey":"tree:imperial:cincelado-premium","initialPrice":3000},{"value":"plata","label":"Plata","ruleKey":"metal:plata-900","initialPrice":17500},{"value":"sin-virola","label":"Sin Virola","ruleKey":"assembly:tipo-virola:sin-virola","initialPrice":0},{"value":"alpaca-grande-lacre","label":"Alpaca grande al lacre","ruleKey":"metal:criollo:torpedo-criollo-posa-mate:alpaca-grande-lacre","initialPrice":2500}]},{"code":"diseno-fleje","label":"Diseño del fleje","options":[{"value":"pampa","label":"Pampa","ruleKey":"assembly:diseno-fleje:pampa","initialPrice":0},{"value":"griego","label":"Griego","ruleKey":"assembly:diseno-fleje:griego","initialPrice":0},{"value":"rupestre","label":"Rupestre","ruleKey":"assembly:diseno-fleje:rupestre","initialPrice":0},{"value":"flores","label":"Flores","ruleKey":"assembly:diseno-fleje:flores","initialPrice":0},{"value":"abstracto","label":"Abstracto","ruleKey":"assembly:diseno-fleje:abstracto","initialPrice":0},{"value":"liso","label":"Liso","ruleKey":"assembly:diseno-fleje:liso","initialPrice":0},{"value":"premium","label":"Premium","ruleKey":"assembly:diseno-fleje:premium","initialPrice":0},{"value":"manos","label":"Manos","ruleKey":"assembly:diseno-fleje:manos","initialPrice":0},{"value":"laureles","label":"Laureles","ruleKey":"assembly:diseno-fleje:laureles","initialPrice":0},{"value":"sin-fleje","label":"Sin fleje","ruleKey":"assembly:diseno-fleje:sin-fleje","initialPrice":0}]},{"code":"posamate","label":"Posamate","options":[{"value":"sin-posamate","label":"Sin","ruleKey":"assembly:posamate:sin-posamate","initialPrice":0},{"value":"con-posamate","label":"Con","ruleKey":"assembly:posamate:con-posamate","initialPrice":300}]},{"code":"pie","label":"Pie","options":[{"value":"comun","label":"Común","ruleKey":"assembly:pie:comun","initialPrice":0},{"value":"sin-pie","label":"Sin Pie","ruleKey":"assembly:pie:sin-pie","initialPrice":0},{"value":"alpaca","label":"Alpaca","ruleKey":"assembly:pie:alpaca","initialPrice":700}]},{"code":"tamano","label":"Tamaño","options":[{"value":"chico","label":"Chico","ruleKey":"assembly:tamano:chico","initialPrice":0},{"value":"mediano","label":"Mediano","ruleKey":"assembly:tamano:mediano","initialPrice":0},{"value":"grande","label":"Grande","ruleKey":"assembly:tamano:grande","initialPrice":0}]}]'::jsonb; $fields$;
revoke all on function public.get_mate_assembly_fields() from public,anon;
grant execute on function public.get_mate_assembly_fields() to authenticated;
insert into public.pricing_rule_definitions(rule_key,rule_type,label,value_kind,required,active,sort_order) values
('assembly:interior:calabaza','texture','Interior: Calabaza','uyu',true,true,60000),
('assembly:interior:ceramica','texture','Interior: Cerámica','uyu',true,true,60001),
('assembly:interior:madera','texture','Interior: Madera','uyu',true,true,60002),
('assembly:interior:acero-inoxidable','texture','Interior: Acero inoxidable','uyu',true,true,60003),
('assembly:tipo-cuero:sin-cuero','texture','Cuero o textura: Sin Cuero','uyu',true,true,60004),
('assembly:tipo-cuero:liso','texture','Cuero o textura: Liso','uyu',true,true,60005),
('assembly:tipo-cuero:croco','texture','Cuero o textura: Croco','uyu',true,true,60006),
('assembly:color:marron','texture','Color: Marrón','uyu',true,true,60007),
('assembly:color:negro','texture','Color: Negro','uyu',true,true,60008),
('assembly:color:natural','texture','Color: Natural','uyu',true,true,60009),
('assembly:color:cuero-crudo','texture','Color: Cuero crudo','uyu',true,true,60010),
('assembly:color:rojo','texture','Color: Rojo','uyu',true,true,60011),
('assembly:color:blanco','texture','Color: Blanco','uyu',true,true,60012),
('assembly:color:rosado','texture','Color: Rosado','uyu',true,true,60013),
('assembly:color:gris','texture','Color: Gris','uyu',true,true,60014),
('assembly:color:dorado','texture','Color: Dorado','uyu',true,true,60015),
('assembly:color:celeste','texture','Color: Celeste','uyu',true,true,60016),
('assembly:color:azul','texture','Color: Azul','uyu',true,true,60017),
('assembly:color:beige','texture','Color: Beige','uyu',true,true,60018),
('assembly:color:metalico','texture','Color: Metálico','uyu',true,true,60019),
('assembly:color:marron-claro','texture','Color: Marrón claro','uyu',true,true,60020),
('assembly:color:chocolate','texture','Color: Chocolate','uyu',true,true,60021),
('assembly:color:mostaza','texture','Color: Mostaza','uyu',true,true,60022),
('assembly:color:plateado','texture','Color: Plateado','uyu',true,true,60023),
('assembly:color:negro-dorado','texture','Color: Negro/Dorado','uyu',true,true,60024),
('assembly:color:marron-dorado','texture','Color: Marrón/Dorado','uyu',true,true,60025),
('assembly:color:blanco-plateado','texture','Color: Blanco/Plateado','uyu',true,true,60026),
('assembly:color:blanco-dorado','texture','Color: Blanco/Dorado','uyu',true,true,60027),
('assembly:color:marron-blanco','texture','Color: Marrón/Blanco','uyu',true,true,60028),
('assembly:color:negro-marron','texture','Color: Negro/Marrón','uyu',true,true,60029),
('assembly:color:beige-dorado','texture','Color: Beige/Dorado','uyu',true,true,60030),
('assembly:color:negro-blanco','texture','Color: Negro/Blanco','uyu',true,true,60031),
('assembly:color:dorado-natural','texture','Color: Dorado/Natural','uyu',true,true,60032),
('assembly:color:marron-rojo','texture','Color: Marrón/Rojo','uyu',true,true,60033),
('assembly:color:mostaza-chocolate','texture','Color: Mostaza/Chocolate','uyu',true,true,60034),
('assembly:color:marron-beige','texture','Color: Marrón/Beige','uyu',true,true,60035),
('assembly:color:animal-print','texture','Color: Animal print','uyu',true,true,60036),
('assembly:tipo-virola:acero','texture','Virola: Acero','uyu',true,true,60037),
('assembly:tipo-virola:acero-cincelado','texture','Virola: Acero Cincelado','uyu',true,true,60038),
('assembly:tipo-virola:acero-liso','texture','Virola: Acero Liso','uyu',true,true,60039),
('assembly:tipo-virola:acero-y-bronce-liso','texture','Virola: Acero y Bronce Liso','uyu',true,true,60040),
('assembly:tipo-virola:alpaca','texture','Virola: Alpaca','uyu',true,true,60041),
('assembly:tipo-virola:alpaca-cincelada','texture','Virola: Alpaca Cincelada','uyu',true,true,60042),
('assembly:tipo-virola:alpaca-comun','texture','Virola: Alpaca Común','uyu',true,true,60043),
('assembly:tipo-virola:alpaca-grande-cincelada-premium','texture','Virola: Alpaca Grande Cincelada Premium','uyu',true,true,60044),
('assembly:tipo-virola:imperial','texture','Virola: Imperial','uyu',true,true,60045),
('assembly:tipo-virola:acero-inoxidable','texture','Virola: Imperial Acero Inoxidable','uyu',true,true,60046),
('assembly:tipo-virola:sin-virola','texture','Virola: Sin Virola','uyu',true,true,60047),
('assembly:diseno-fleje:pampa','texture','Diseño del fleje: Pampa','uyu',true,true,60048),
('assembly:diseno-fleje:griego','texture','Diseño del fleje: Griego','uyu',true,true,60049),
('assembly:diseno-fleje:rupestre','texture','Diseño del fleje: Rupestre','uyu',true,true,60050),
('assembly:diseno-fleje:flores','texture','Diseño del fleje: Flores','uyu',true,true,60051),
('assembly:diseno-fleje:abstracto','texture','Diseño del fleje: Abstracto','uyu',true,true,60052),
('assembly:diseno-fleje:liso','texture','Diseño del fleje: Liso','uyu',true,true,60053),
('assembly:diseno-fleje:premium','texture','Diseño del fleje: Premium','uyu',true,true,60054),
('assembly:diseno-fleje:manos','texture','Diseño del fleje: Manos','uyu',true,true,60055),
('assembly:diseno-fleje:laureles','texture','Diseño del fleje: Laureles','uyu',true,true,60056),
('assembly:diseno-fleje:sin-fleje','texture','Diseño del fleje: Sin fleje','uyu',true,true,60057),
('assembly:posamate:sin-posamate','texture','Posamate: Sin','uyu',true,true,60058),
('assembly:posamate:con-posamate','texture','Posamate: Con','uyu',true,true,60059),
('assembly:pie:comun','texture','Pie: Común','uyu',true,true,60060),
('assembly:pie:sin-pie','texture','Pie: Sin Pie','uyu',true,true,60061),
('assembly:pie:alpaca','texture','Pie: Alpaca','uyu',true,true,60062),
('assembly:tamano:chico','texture','Tamaño: Chico','uyu',true,true,60063),
('assembly:tamano:mediano','texture','Tamaño: Mediano','uyu',true,true,60064),
('assembly:tamano:grande','texture','Tamaño: Grande','uyu',true,true,60065)
on conflict(rule_key) do nothing;
do $seed$ declare old_id uuid; new_id uuid; next_number integer; begin
perform pg_advisory_xact_lock(hashtext('matearte-pricing-publish'));
select id into old_id from public.pricing_catalog_versions where status='published' for update;
if old_id is null then raise exception 'No hay una versión publicada'; end if;
select max(version)+1 into next_number from public.pricing_catalog_versions;
update public.pricing_catalog_versions set status='archived',updated_at=clock_timestamp() where id=old_id;
insert into public.pricing_catalog_versions(version,status,note,published_at) values(next_number,'published','Armador de mates por piezas: adicionales iniciales',clock_timestamp()) returning id into new_id;
insert into public.pricing_catalog_values(version_id,rule_key,value) select new_id,rule_key,value from public.pricing_catalog_values where version_id=old_id;
insert into public.pricing_catalog_values(version_id,rule_key,value)
select version.id,seed.rule_key,seed.value from public.pricing_catalog_versions version cross join (values
('assembly:interior:calabaza'::text,0::numeric),
('assembly:interior:ceramica'::text,0::numeric),
('assembly:interior:madera'::text,0::numeric),
('assembly:interior:acero-inoxidable'::text,0::numeric),
('assembly:tipo-cuero:sin-cuero'::text,0::numeric),
('assembly:tipo-cuero:liso'::text,0::numeric),
('assembly:tipo-cuero:croco'::text,600::numeric),
('assembly:color:marron'::text,0::numeric),
('assembly:color:negro'::text,0::numeric),
('assembly:color:natural'::text,0::numeric),
('assembly:color:cuero-crudo'::text,0::numeric),
('assembly:color:rojo'::text,0::numeric),
('assembly:color:blanco'::text,0::numeric),
('assembly:color:rosado'::text,0::numeric),
('assembly:color:gris'::text,0::numeric),
('assembly:color:dorado'::text,0::numeric),
('assembly:color:celeste'::text,0::numeric),
('assembly:color:azul'::text,0::numeric),
('assembly:color:beige'::text,0::numeric),
('assembly:color:metalico'::text,0::numeric),
('assembly:color:marron-claro'::text,0::numeric),
('assembly:color:chocolate'::text,0::numeric),
('assembly:color:mostaza'::text,0::numeric),
('assembly:color:plateado'::text,0::numeric),
('assembly:color:negro-dorado'::text,0::numeric),
('assembly:color:marron-dorado'::text,0::numeric),
('assembly:color:blanco-plateado'::text,0::numeric),
('assembly:color:blanco-dorado'::text,0::numeric),
('assembly:color:marron-blanco'::text,0::numeric),
('assembly:color:negro-marron'::text,0::numeric),
('assembly:color:beige-dorado'::text,0::numeric),
('assembly:color:negro-blanco'::text,0::numeric),
('assembly:color:dorado-natural'::text,0::numeric),
('assembly:color:marron-rojo'::text,0::numeric),
('assembly:color:mostaza-chocolate'::text,0::numeric),
('assembly:color:marron-beige'::text,0::numeric),
('assembly:color:animal-print'::text,0::numeric),
('assembly:tipo-virola:acero'::text,0::numeric),
('assembly:tipo-virola:acero-cincelado'::text,100::numeric),
('assembly:tipo-virola:acero-liso'::text,0::numeric),
('assembly:tipo-virola:acero-y-bronce-liso'::text,200::numeric),
('assembly:tipo-virola:alpaca'::text,0::numeric),
('assembly:tipo-virola:alpaca-cincelada'::text,0::numeric),
('assembly:tipo-virola:alpaca-comun'::text,0::numeric),
('assembly:tipo-virola:alpaca-grande-cincelada-premium'::text,2300::numeric),
('assembly:tipo-virola:imperial'::text,0::numeric),
('assembly:tipo-virola:acero-inoxidable'::text,0::numeric),
('assembly:tipo-virola:sin-virola'::text,0::numeric),
('assembly:diseno-fleje:pampa'::text,0::numeric),
('assembly:diseno-fleje:griego'::text,0::numeric),
('assembly:diseno-fleje:rupestre'::text,0::numeric),
('assembly:diseno-fleje:flores'::text,0::numeric),
('assembly:diseno-fleje:abstracto'::text,0::numeric),
('assembly:diseno-fleje:liso'::text,0::numeric),
('assembly:diseno-fleje:premium'::text,0::numeric),
('assembly:diseno-fleje:manos'::text,0::numeric),
('assembly:diseno-fleje:laureles'::text,0::numeric),
('assembly:diseno-fleje:sin-fleje'::text,0::numeric),
('assembly:posamate:sin-posamate'::text,0::numeric),
('assembly:posamate:con-posamate'::text,300::numeric),
('assembly:pie:comun'::text,0::numeric),
('assembly:pie:sin-pie'::text,0::numeric),
('assembly:pie:alpaca'::text,700::numeric),
('assembly:tamano:chico'::text,0::numeric),
('assembly:tamano:mediano'::text,0::numeric),
('assembly:tamano:grande'::text,0::numeric)
) seed(rule_key,value) where version.id=new_id or version.status='draft' on conflict do nothing;
update public.pricing_catalog_versions set updated_at=clock_timestamp() where status='draft';
end $seed$;
create or replace function public.gestion_quote_mate_assembly(p_assembly jsonb, p_design jsonb default '{}'::jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $quote$
declare
  catalog jsonb; fields jsonb := public.get_mate_assembly_fields(); field jsonb; choice jsonb;
  code text; value text; rule text; rules text[] := array[]::text[];
  labels jsonb := '{}'::jsonb; base_items jsonb := '[]'::jsonb; extras_items jsonb := '[]'::jsonb;
  base_minor bigint := 0; extras_minor bigint := 0; amount bigint; quantity integer;
  surface text; technique text; body jsonb; text_content text; image_count integer;
  has_fleje boolean; has_rim boolean; summary text := ''; name text;
begin
  perform private.require_internal_staff();
  if jsonb_typeof(p_assembly) is distinct from 'object' or jsonb_typeof(p_design) is distinct from 'object' then
    raise exception 'El armado no es válido' using errcode='22023';
  end if;
  catalog := public.get_published_pricing_catalog();
  if catalog is null then raise exception 'No hay tarifas publicadas' using errcode='22023'; end if;
  for field in select v from jsonb_array_elements(fields) v loop
    code := field->>'code'; value := p_assembly->>code;
    if code='forma-criollo' and p_assembly->>'tipo-mate'<>'criollo' then continue; end if;
    if code='diseno-fleje' and p_assembly->>'tipo-mate' not in ('imperial','criollo') then continue; end if;
    select v into choice from jsonb_array_elements(field->'options') as choices(v) where v->>'value'=value;
    if choice is null then raise exception 'Elegí una opción válida para %',field->>'label' using errcode='22023'; end if;
    labels := labels || jsonb_build_object(code,choice->>'label');
    if code <> 'tipo-mate' then summary := summary || case when summary='' then '' else ' · ' end || (field->>'label') || ': ' || (choice->>'label'); end if;
    rule := choice->>'ruleKey';
    if code='tipo-cuero' and value='crudo' and p_assembly->>'posamate'='con-posamate' then rule:='leather:raw-posa-mate'; end if;
    if code='posamate' and value='con-posamate' and (p_assembly->>'tipo-cuero'='crudo' or p_assembly->>'tipo-mate'='criollo') then continue; end if;
    if code='tipo-virola' and value='alpaca-grande-lacre' then
      rule := 'metal:criollo:' || case when (p_assembly->>'tipo-mate'='criollo' and p_assembly->>'forma-criollo'='imperial') or p_assembly->>'tipo-mate'='imperial' then 'imperial' else 'torpedo' end || '-criollo-posa-mate:alpaca-grande-lacre';
    end if;
    if rule=any(rules) then continue; end if;
    rules:=array_append(rules,rule);
    if jsonb_typeof(catalog->'rules'->rule) is distinct from 'number' then raise exception 'Falta publicar la tarifa %',rule using errcode='22023'; end if;
    amount:=round((catalog->'rules'->>rule)::numeric*100)::bigint;
    if amount<0 then raise exception 'Tarifa no válida' using errcode='22023'; end if;
    base_minor:=base_minor+amount;
    base_items:=base_items || jsonb_build_array(jsonb_build_object('ruleKey',rule,'label',(field->>'label')||': '||(choice->>'label'),'totalMinor',amount));
  end loop;
  has_fleje:=p_assembly->>'tipo-mate' in ('imperial','criollo') and p_assembly->>'diseno-fleje'<>'sin-fleje';
  has_rim:=p_assembly->>'tipo-virola'<>'sin-virola';
  for surface in select unnest(array['rim','fleje']) loop
    technique:=coalesce(p_design->'configuration'->>case when surface='rim' then 'engravingTypeId' else 'flejeEngravingTypeId' end,'none');
    if technique='none' then continue; end if;
    if technique not in ('laser','bronze-applique','alpaca-applique') or (surface='fleje' and technique='laser') or (surface='rim' and not has_rim) or (surface='fleje' and not has_fleje) then
      raise exception 'La técnica no corresponde a este armado' using errcode='22023';
    end if;
    text_content:=''; image_count:=0;
    if surface='rim' then
      body:=coalesce(p_design->'configuration'->'rim','{}'::jsonb);
      if body->>'textMode'='text' then
        if jsonb_typeof(body->'texts') is distinct from 'array' then raise exception 'Texto de virola inválido' using errcode='22023'; end if;
        select coalesce(string_agg(v->>'text',''),'') into text_content from jsonb_array_elements(body->'texts') v;
      end if;
      if body->>'imageMode'='image' then
        if jsonb_typeof(body->'icons') is distinct from 'array' then raise exception 'Imagen de virola inválida' using errcode='22023'; end if;
        image_count:=jsonb_array_length(body->'icons');
      end if;
    else
      for body in select v from jsonb_each(coalesce(p_design->'flejeConfiguration'->'sides','{}'::jsonb)) as sides(k,v) where k in ('front','back') loop
        if body->>'textMode'='text' then text_content:=text_content||coalesce(body->>'text',''); end if;
        if body->>'imageMode'='image' then
          if jsonb_typeof(body->'icons') is distinct from 'array' then raise exception 'Imagen del fleje inválida' using errcode='22023'; end if;
          image_count:=image_count+jsonb_array_length(body->'icons');
        end if;
      end loop;
    end if;
    quantity:=char_length(regexp_replace(text_content,'[^[:alnum:]]','','g'));
    if quantity>80 or image_count>4 then raise exception 'El diseño supera los límites de texto o imágenes' using errcode='22023'; end if;
    if technique='laser' then quantity:=case when quantity>0 or image_count>0 then 1 else 0 end; image_count:=0; end if;
    if quantity=0 and image_count=0 then raise exception 'Completá el diseño o elegí Sin personalizar' using errcode='22023'; end if;
    for value in select unnest(array['text','image']) loop
      if value='image' then quantity:=image_count; end if;
      if quantity=0 then continue; end if;
      rule:='customization:'||technique||':'||surface||'_'||value;
      if jsonb_typeof(catalog->'rules'->rule) is distinct from 'number' then raise exception 'Falta publicar la tarifa %',rule using errcode='22023'; end if;
      amount:=round((catalog->'rules'->>rule)::numeric*100)::bigint;
      extras_minor:=extras_minor+quantity::bigint*amount;
      extras_items:=extras_items||jsonb_build_array(jsonb_build_object('ruleKey',rule,'quantity',quantity,'unitPriceMinor',amount,'totalMinor',quantity::bigint*amount));
    end loop;
  end loop;
  name:='Mate '||(labels->>'tipo-mate')||' personalizado';
  return jsonb_build_object('name',name,'summary',summary,'labels',labels,'baseMinor',base_minor,'extrasMinor',extras_minor,'totalMinor',base_minor+extras_minor,'baseItems',base_items,'extrasItems',extras_items,'versionId',catalog->>'versionId','version',catalog->'version');
end $quote$;
revoke all on function public.gestion_quote_mate_assembly(jsonb,jsonb) from public,anon;
grant execute on function public.gestion_quote_mate_assembly(jsonb,jsonb) to authenticated;


CREATE OR REPLACE FUNCTION public.gestion_create_local_sale_with_items(p_customer_id uuid, p_sold_on date, p_payment_method text, p_items jsonb, p_deposit_minor bigint, p_channel text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_sale_id uuid;
  v_sale_number bigint;
  v_reference_code text;
  v_created_at timestamptz;
  v_customer_name text := 'Cliente sin registrar';
  v_item jsonb;
  v_variant_id uuid;
  v_quantity integer;
  v_unit_price_minor bigint;
  v_customization jsonb;
  v_notes text;
  v_quote jsonb;
  v_custom boolean;
  v_sku text;
  v_product_name text;
  v_variant_name text;
  v_items_total_minor bigint := 0;
  v_charged_total_minor bigint;
begin
  if not ((select private.is_pricing_admin()) or (select private.is_commerce_admin())) then
    raise exception 'Acceso no autorizado' using errcode = '42501';
  end if;
  if p_channel not in ('Local', 'Feria', 'WhatsApp', 'Facebook', 'Instagram') or p_channel is null then
    raise exception 'El canal no es válido' using errcode = '22023';
  end if;
  if p_sold_on is null or p_sold_on > current_date then
    raise exception 'La fecha de venta no es válida' using errcode = '22023';
  end if;
  if p_payment_method not in ('Efectivo', 'Débito', 'Crédito', 'Transferencia', 'Seña') then
    raise exception 'La forma de pago no es válida' using errcode = '22023';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array'
    or jsonb_array_length(p_items) not between 1 and 100 then
    raise exception 'La venta debe incluir entre 1 y 100 productos' using errcode = '22023';
  end if;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    if jsonb_typeof(v_item) <> 'object' then
      raise exception 'Los productos de la venta no son válidos' using errcode = '22023';
    end if;
    v_variant_id := nullif(v_item ->> 'variant_id', '')::uuid;
    v_quantity := (v_item ->> 'quantity')::integer;
    v_unit_price_minor := (v_item ->> 'unit_price_minor')::bigint;
    v_customization := nullif(v_item -> 'customization', 'null'::jsonb);
    v_notes := nullif(btrim(coalesce(v_item ->> 'production_notes', '')), '');
    if v_notes is not null and char_length(v_notes) > 1000 then
      raise exception 'Las notas de producción son demasiado largas' using errcode = '22023';
    end if;
    v_custom := coalesce(v_item->>'item_kind','catalog')='custom_mate';
    if coalesce(v_item->>'item_kind','catalog') not in ('catalog','custom_mate') then raise exception 'Tipo de línea inválido' using errcode='22023'; end if;
    if v_custom then
      if v_variant_id is not null or v_customization is null then raise exception 'El armado debe guardarse sin SKU' using errcode='22023'; end if;
      v_quote:=public.gestion_quote_mate_assembly(v_customization->'assembly'->'selections',v_customization);
      if v_quote->>'versionId' is distinct from v_customization->'localPricing'->>'versionId' or v_unit_price_minor is distinct from (v_quote->>'totalMinor')::bigint then raise exception 'Las tarifas cambiaron. Actualizá los precios del armado antes de guardar.' using errcode='22023'; end if;
    end if;
    if not v_custom and v_variant_id is null then
      raise exception 'Falta el producto de una línea' using errcode = '22023';
    end if;
    if v_quantity is null or v_quantity not between 1 and 1000 then
      raise exception 'La cantidad no es válida' using errcode = '22023';
    end if;
    if v_unit_price_minor is null or v_unit_price_minor not between 0 and 1000000000 then
      raise exception 'El precio no es válido' using errcode = '22023';
    end if;
    if v_customization is not null and jsonb_typeof(v_customization) <> 'object' then
      raise exception 'La personalización no es válida' using errcode = '22023';
    end if;
    if not v_custom then
    perform 1
      from public.commerce_variants variant
      join public.commerce_products product on product.id = variant.product_id
      where variant.id = v_variant_id and variant.active;
    if not found then
      raise exception 'Uno de los productos seleccionados no está disponible' using errcode = '22023';
    end if;
    end if;
    if v_notes is not null and not exists (
      select 1 from public.commerce_variants variant
      join public.commerce_products product on product.id = variant.product_id
      where variant.id = v_variant_id and coalesce(product.category_code, product.category) = 'servicios'
    ) then
      raise exception 'Las notas de producción solo aplican a servicios' using errcode = '22023';
    end if;
    v_items_total_minor := v_items_total_minor + (v_quantity::bigint * v_unit_price_minor);
  end loop;

  if p_payment_method = 'Seña' then
    if p_deposit_minor is null or p_deposit_minor not between 0 and 1000000000 then
      raise exception 'El monto de la seña no es válido' using errcode = '22023';
    end if;
    v_charged_total_minor := p_deposit_minor;
  else
    v_charged_total_minor := v_items_total_minor;
  end if;

  if p_customer_id is not null then
    select customer.full_name into v_customer_name
      from public.local_sales_customers customer
      where customer.id = p_customer_id;
    if not found then
      raise exception 'El cliente seleccionado no existe' using errcode = '22023';
    end if;
  end if;

  insert into public.local_sales
    (customer_id, customer_name, sold_on, payment_method, total_minor, channel)
  values
    (p_customer_id, v_customer_name, p_sold_on, p_payment_method, v_charged_total_minor, p_channel)
  returning id, sale_number, reference_code, created_at
    into v_sale_id, v_sale_number, v_reference_code, v_created_at;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_variant_id := (v_item ->> 'variant_id')::uuid;
    v_quantity := (v_item ->> 'quantity')::integer;
    v_unit_price_minor := (v_item ->> 'unit_price_minor')::bigint;
    v_customization := nullif(v_item -> 'customization', 'null'::jsonb);
    v_notes := nullif(btrim(coalesce(v_item ->> 'production_notes', '')), '');
    if v_item->>'item_kind'='custom_mate' then
      v_quote:=public.gestion_quote_mate_assembly(v_customization->'assembly'->'selections',v_customization);
      v_sku:=null; v_product_name:=v_quote->>'name'; v_variant_name:=v_quote->>'summary';
      v_customization:=v_customization || jsonb_build_object('itemKind','custom_mate','assembly',v_customization->'assembly'||jsonb_build_object('labels',v_quote->'labels'),
        'localPricing',jsonb_build_object('source','published-personalizer','versionId',v_quote->>'versionId','version',v_quote->'version','baseUnitPriceMinor',v_quote->'baseMinor','extrasUnitPriceMinor',v_quote->'extrasMinor','assemblyItems',v_quote->'baseItems','items',v_quote->'extrasItems'));
    else
    select variant.sku, product.name, variant.name
      into v_sku, v_product_name, v_variant_name
      from public.commerce_variants variant
      join public.commerce_products product on product.id = variant.product_id
      where variant.id = v_variant_id and variant.active;
    end if;
    insert into public.local_sale_items
      (sale_id, variant_id, sku, product_name, variant_name, quantity, unit_price_minor, customization, production_notes)
    values
      (v_sale_id, v_variant_id, v_sku, v_product_name, v_variant_name,
       v_quantity, v_unit_price_minor, v_customization, v_notes);
  end loop;

  if p_customer_id is not null then
    update public.local_sales_customers
    set first_purchase_date = case
          when first_purchase_date is null or p_sold_on < first_purchase_date then p_sold_on
          else first_purchase_date end,
        last_purchase_date = case
          when last_purchase_date is null or p_sold_on > last_purchase_date then p_sold_on
          else last_purchase_date end
    where id = p_customer_id;
  end if;

  return jsonb_build_object(
    'id', v_sale_id,
    'sale_number', v_sale_number,
    'reference_code', v_reference_code,
    'created_at', v_created_at,
    'items_total_minor', v_items_total_minor,
    'charged_total_minor', v_charged_total_minor
  );
end;
$function$

;

CREATE OR REPLACE FUNCTION private.local_sale_items_write()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_channel text; v_custom boolean; v_quote jsonb;
begin
  perform private.require_internal_staff();
  if tg_op = 'DELETE' then raise exception 'Los ítems de una venta no se eliminan desde aquí' using errcode = '42501'; end if;
  if tg_op = 'UPDATE' then
    update public.order_items set production_status = new.production_status,
      immutable_snapshot = case when new.customization is distinct from old.customization
        then immutable_snapshot || jsonb_build_object('customization', new.customization) else immutable_snapshot end
    where id = old.id;
    return new;
  end if;
  select channel into v_channel from public.orders where id = new.sale_id;
  if v_channel is null or v_channel not in ('Local', 'Feria', 'WhatsApp', 'Facebook', 'Instagram') then
    raise exception 'La venta no existe' using errcode = '22023';
  end if;
  v_custom:=coalesce(new.customization->>'itemKind','')='custom_mate';
  if v_custom then
    if new.variant_id is not null or nullif(new.sku,'') is not null then raise exception 'El armado no lleva SKU' using errcode='22023'; end if;
    v_quote:=public.gestion_quote_mate_assembly(new.customization->'assembly'->'selections',new.customization);
    if new.unit_price_minor is distinct from (v_quote->>'totalMinor')::bigint or new.customization->'localPricing'->>'versionId' is distinct from v_quote->>'versionId' then raise exception 'Precio del armado desactualizado' using errcode='22023'; end if;
    new.product_name:=v_quote->>'name'; new.variant_name:=v_quote->>'summary'; new.sku:=null;
  end if;
  if not v_custom and not exists (select 1 from public.commerce_variants variant where variant.id = new.variant_id and variant.active and variant.available_local) then
    raise exception 'La variante ya no está disponible en Local' using errcode = '22023';
  end if;
  if v_channel <> 'Local' and exists (select 1 from public.commerce_variants variant join public.commerce_products product on product.id = variant.product_id
      where variant.id = new.variant_id and coalesce(product.category_code, product.category) = 'servicios') then
    raise exception 'Los servicios solo se registran en Local' using errcode = '22023';
  end if;
  new.id := coalesce(new.id, gen_random_uuid());
  new.production_status := coalesce(new.production_status, 'pending');
  new.created_at := coalesce(new.created_at, now());
  new.line_total_minor := new.unit_price_minor * new.quantity;
  insert into public.order_items (id, order_id, item_type, source_variant_id, sku, title, quantity, unit_price_minor, total_minor,
    immutable_snapshot, requires_review, created_at, production_status)
  values (new.id, new.sale_id, case when v_custom then 'design' else 'catalog' end, new.variant_id, new.sku, new.product_name || ' — ' || new.variant_name, new.quantity,
    new.unit_price_minor, new.line_total_minor,
    jsonb_build_object('source', 'local', 'productName', new.product_name, 'variantName', new.variant_name)
      || case when v_custom then new.customization else '{}'::jsonb end
      || case when new.customization is not null then jsonb_build_object('customization', new.customization) else '{}'::jsonb end
      || case when new.production_notes is not null then jsonb_build_object('productionNotes', new.production_notes) else '{}'::jsonb end,
    false, new.created_at, new.production_status);
  return new;
end $function$

;
notify pgrst, 'reload schema';
