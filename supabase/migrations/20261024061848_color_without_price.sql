-- El color sigue siendo parte del armado, pero no tiene tarifa.
update public.pricing_rule_definitions set active=false where rule_key like 'assembly:color:%';

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
    if code='color' then continue; end if;
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
