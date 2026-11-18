-- Descuento general de la tienda (precio tachado en la web).
--
-- Un solo interruptor en commerce_settings. Mientras esté vigente, todos los caminos de cobro de la web
-- (Mercado Pago, PayPal, transferencia en Uruguay y Argentina, mayorista y pedido internacional) cobran el
-- precio rebajado. Reglas:
--   * Se redondea al peso entero.
--   * No se acumula con la transferencia (10%) ni con el mayorista: se cobra el precio más bajo.
--   * No se acumula con un código: si el pedido trae un código, el código manda y el descuento general
--     queda apagado para esa transacción (app.storewide_sale_off). La web decide cuál conviene más
--     al cliente y solo envía el código cuando este gana.
--   * Nace apagado. Los pedidos de Gestión (ventas locales, consignaciones) no cambian.

alter table public.commerce_settings
  add column storewide_sale_enabled boolean not null default false,
  add column storewide_sale_percent numeric(5,2) not null default 20
    check (storewide_sale_percent > 0 and storewide_sale_percent < 100),
  add column storewide_sale_valid_from date,
  add column storewide_sale_valid_until date,
  add constraint storewide_sale_dates_ordered check (
    storewide_sale_valid_from is null or storewide_sale_valid_until is null
    or storewide_sale_valid_until >= storewide_sale_valid_from
  );

-- Porcentaje vigente hoy en Montevideo; 0 si está apagado, fuera de fecha o suspendido en esta transacción.
create or replace function public.storewide_sale_percent()
returns numeric
language sql
stable
set search_path = ''
as $$
  select case
    when coalesce(nullif(current_setting('app.storewide_sale_off', true), ''), '0') = '1' then 0
    else coalesce((
      select s.storewide_sale_percent
      from public.commerce_settings s
      where s.singleton
        and s.storewide_sale_enabled
        and (s.storewide_sale_valid_from is null
          or s.storewide_sale_valid_from <= (now() at time zone 'America/Montevideo')::date)
        and (s.storewide_sale_valid_until is null
          or s.storewide_sale_valid_until >= (now() at time zone 'America/Montevideo')::date)
    ), 0)
  end;
$$;

-- Precio con el descuento general, en centésimos, redondeado al peso entero.
create or replace function public.storewide_sale_price(p_price_minor bigint)
returns bigint
language sql
stable
set search_path = ''
as $$
  select case
    when p_price_minor is null then null
    when public.storewide_sale_percent() <= 0 then p_price_minor
    else least(
      p_price_minor,
      greatest(0, (round(p_price_minor::numeric * (1 - public.storewide_sale_percent() / 100) / 100) * 100)::bigint)
    )
  end;
$$;

-- Precio de una línea con otro beneficio multiplicativo (transferencia): rige el más bajo.
create or replace function public.web_unit_price(p_price_minor bigint, p_factor numeric)
returns bigint
language sql
stable
set search_path = ''
as $$
  select least(round(p_price_minor::numeric * p_factor)::bigint, public.storewide_sale_price(p_price_minor));
$$;

grant execute on function public.storewide_sale_percent() to anon, authenticated, service_role;
grant execute on function public.storewide_sale_price(bigint) to anon, authenticated, service_role;
grant execute on function public.web_unit_price(bigint, numeric) to anon, authenticated, service_role;

-- Reemplaza fragmentos exactos en la definición vigente de una función y la vuelve a crear.
-- Falla si algún fragmento no aparece la cantidad esperada de veces, así una definición distinta
-- nunca queda parcheada a medias.
create function pg_temp.patch_fn(p_signature text, p_from text[], p_to text[], p_counts integer[])
returns void
language plpgsql
as $patch$
declare
  v_def text := replace(pg_get_functiondef(p_signature::regprocedure), E'\r', '');
  v_found integer;
begin
  for i in 1 .. array_length(p_from, 1) loop
    v_found := (length(v_def) - length(replace(v_def, p_from[i], ''))) / length(p_from[i]);
    if v_found <> p_counts[i] then
      raise exception 'patch %: % apariciones de [%], se esperaban %', p_signature, v_found, p_from[i], p_counts[i];
    end if;
    v_def := replace(v_def, p_from[i], p_to[i]);
  end loop;
  execute v_def;
end
$patch$;

-- Transferencia en Uruguay: el menor entre el 10% de la transferencia y el descuento general.
select pg_temp.patch_fn(
  'public.create_uruguay_retail_bank_transfer_order(uuid,uuid,uuid,jsonb,jsonb,uuid,uuid,text,text,text,bigint,text)',
  array[
    $q$  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text || ':' || p_idempotency_key::text, 0));$q$,
    $q$select coalesce(sum(round((case when i.item_type='catalog' then v.price_minor$q$,
    $q$    else (p_design_prices->>i.design_id::text)::bigint end)::numeric *$q$,
    $q$round((p_design_prices->>i.design_id::text)::numeric *$q$,
    $q$round(v.price_minor::numeric *$q$,
    $q$round((p_design_prices->>d.id::text)::numeric *$q$,
    $q$'priceSource','published_discount_10',$q$
  ],
  array[
    $q$  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text || ':' || p_idempotency_key::text, 0));
  if v_code is not null then perform set_config('app.storewide_sale_off', '1', true); end if;$q$,
    $q$select coalesce(sum(public.web_unit_price((case when i.item_type='catalog' then v.price_minor$q$,
    $q$    else (p_design_prices->>i.design_id::text)::bigint end),$q$,
    $q$public.web_unit_price((p_design_prices->>i.design_id::text)::bigint,$q$,
    $q$public.web_unit_price(v.price_minor,$q$,
    $q$public.web_unit_price((p_design_prices->>d.id::text)::bigint,$q$,
    $q$'priceSource','published_discount_10','storewideSalePercent',public.storewide_sale_percent(),$q$
  ],
  array[1, 1, 1, 1, 3, 2, 1]
);

-- Transferencia en Argentina: el descuento se aplica al precio en UYU antes de convertir a ARS.
select pg_temp.patch_fn(
  'public.create_argentina_retail_order(uuid,uuid,jsonb,jsonb,uuid)',
  array[
    $q$round((case when v_use_base then coalesce(v.base_price_minor,v.price_minor) else v.price_minor end)::numeric / 5000$q$,
    $q$v_uyu + (case when v_use_base then coalesce(base_price_minor,price_minor) else price_minor end)*v_item.quantity$q$,
    $q$round((p_design_prices->>v_item.design_id::text)::numeric / 5000$q$,
    $q$v_uyu := v_uyu + (p_design_prices->>v_item.design_id::text)::bigint*v_item.quantity$q$,
    $q$'arsRounding',50,$q$
  ],
  array[
    $q$round(public.storewide_sale_price(case when v_use_base then coalesce(v.base_price_minor,v.price_minor) else v.price_minor end)::numeric / 5000$q$,
    $q$v_uyu + public.storewide_sale_price(case when v_use_base then coalesce(base_price_minor,price_minor) else price_minor end)*v_item.quantity$q$,
    $q$round(public.storewide_sale_price((p_design_prices->>v_item.design_id::text)::bigint)::numeric / 5000$q$,
    $q$v_uyu := v_uyu + public.storewide_sale_price((p_design_prices->>v_item.design_id::text)::bigint)*v_item.quantity$q$,
    $q$'arsRounding',50,'storewideSalePercent',public.storewide_sale_percent(),$q$
  ],
  array[1, 1, 1, 1, 1]
);

select pg_temp.patch_fn(
  'public.create_argentina_retail_order(uuid,uuid,jsonb,jsonb,uuid,text)',
  array[$q$  v_result := public.create_argentina_retail_order($q$],
  array[$q$  if v_code is not null then perform set_config('app.storewide_sale_off', '1', true); end if;
  v_result := public.create_argentina_retail_order($q$],
  array[1]
);

-- PayPal internacional.
select pg_temp.patch_fn(
  'public.create_paypal_international_order(uuid,uuid,jsonb,jsonb,jsonb,uuid,bigint,bigint,integer)',
  array[
    $q$v_catalog_subtotal := v_catalog_subtotal + v_variant.price_minor * v_variant.quantity;$q$,
    $q$v_design_subtotal := v_design_subtotal + v_design_price;$q$,
    $q$         variant.price_minor, variant.price_minor * item.quantity,$q$,
    $q$(p_design_prices ->> design.id::text)::bigint,$q$
  ],
  array[
    $q$v_catalog_subtotal := v_catalog_subtotal + public.storewide_sale_price(v_variant.price_minor) * v_variant.quantity;$q$,
    $q$v_design_subtotal := v_design_subtotal + public.storewide_sale_price(v_design_price);$q$,
    $q$         public.storewide_sale_price(variant.price_minor), public.storewide_sale_price(variant.price_minor) * item.quantity,$q$,
    $q$public.storewide_sale_price((p_design_prices ->> design.id::text)::bigint),$q$
  ],
  array[1, 1, 1, 2]
);

select pg_temp.patch_fn(
  'public.create_paypal_international_order(uuid,uuid,jsonb,jsonb,jsonb,uuid,bigint,integer,text,numeric)',
  array[$q$  v_base := public.create_paypal_international_order($q$],
  array[$q$  if nullif(btrim(coalesce(p_discount_code, '')), '') is not null then perform set_config('app.storewide_sale_off', '1', true); end if;
  v_base := public.create_paypal_international_order($q$],
  array[1]
);

-- Mayorista por PayPal: el descuento mayorista ya no se suma al general, se cobra el más bajo.
select pg_temp.patch_fn(
  'private.apply_wholesale_discount_to_paypal_order()',
  array[
    $q$      (variant.price_minor - private.wholesale_mate_unit_price($q$,
    $q$      )) * item.quantity$q$
  ],
  array[
    $q$      (public.storewide_sale_price(variant.price_minor) - least(public.storewide_sale_price(variant.price_minor), private.wholesale_mate_unit_price($q$,
    $q$      ))) * item.quantity$q$
  ],
  array[1, 1]
);

select pg_temp.patch_fn(
  'private.apply_wholesale_discount_to_paypal_order_item()',
  array[
    $q$  new.unit_price_minor := private.wholesale_mate_unit_price(
    new.unit_price_minor,$q$,
    $q$    v_settings.wholesale_mate_discount_percent
  );
  new.total_minor := new.unit_price_minor * new.quantity;$q$
  ],
  array[
    $q$  new.unit_price_minor := least(new.unit_price_minor, private.wholesale_mate_unit_price(
    (select v.price_minor from public.commerce_variants v where v.id = new.source_variant_id),$q$,
    $q$    v_settings.wholesale_mate_discount_percent
  ));
  new.total_minor := new.unit_price_minor * new.quantity;$q$
  ],
  array[1, 1]
);

-- Mayorista por transferencia bancaria: el más bajo entre el mayorista y el general.
select pg_temp.patch_fn(
  'public.create_wholesale_bank_transfer_order(uuid,uuid,uuid,jsonb,jsonb,uuid,uuid,text,text,text,bigint)',
  array[
    $q$greatest(0, round(v_variant.base_price_minor::numeric * (1 - v_settings.wholesale_mate_discount_percent / 100)))::bigint$q$,
    $q$else v_variant.price_minor$q$,
    $q$greatest(0, round(variant.base_price_minor::numeric * (1 - v_settings.wholesale_mate_discount_percent / 100)))::bigint$q$,
    $q$else variant.price_minor$q$,
    $q$(p_design_prices ->> design.id::text)::bigint,$q$,
    $q$v_design_subtotal := v_design_subtotal + v_design_price;$q$
  ],
  array[
    $q$least(public.storewide_sale_price(v_variant.price_minor), greatest(0, round(v_variant.base_price_minor::numeric * (1 - v_settings.wholesale_mate_discount_percent / 100)))::bigint)$q$,
    $q$else public.storewide_sale_price(v_variant.price_minor)$q$,
    $q$least(public.storewide_sale_price(variant.price_minor), greatest(0, round(variant.base_price_minor::numeric * (1 - v_settings.wholesale_mate_discount_percent / 100)))::bigint)$q$,
    $q$else public.storewide_sale_price(variant.price_minor)$q$,
    $q$public.storewide_sale_price((p_design_prices ->> design.id::text)::bigint),$q$,
    $q$v_design_subtotal := v_design_subtotal + public.storewide_sale_price(v_design_price);$q$
  ],
  array[1, 1, 2, 2, 2, 1]
);

-- Pedido internacional por WhatsApp (cotización).
select pg_temp.patch_fn(
  'public.create_international_order_request(uuid,uuid,jsonb,jsonb,jsonb,uuid)',
  array[
    $q$v_catalog_subtotal := v_catalog_subtotal + v_variant.price_minor * v_variant.quantity;$q$,
    $q$v_design_subtotal := v_design_subtotal + v_design_price;$q$,
    $q$         variant.price_minor, variant.price_minor * item.quantity,$q$,
    $q$(p_design_prices ->> design.id::text)::bigint,$q$
  ],
  array[
    $q$v_catalog_subtotal := v_catalog_subtotal + public.storewide_sale_price(v_variant.price_minor) * v_variant.quantity;$q$,
    $q$v_design_subtotal := v_design_subtotal + public.storewide_sale_price(v_design_price);$q$,
    $q$         public.storewide_sale_price(variant.price_minor), public.storewide_sale_price(variant.price_minor) * item.quantity,$q$,
    $q$public.storewide_sale_price((p_design_prices ->> design.id::text)::bigint),$q$
  ],
  array[1, 1, 1, 2]
);
