# Fase 2: relevo previo (solo lectura), 2026-10-22

Estado real de la base `agdkljuulwjwjasftcce` antes de unificar productos, pedidos y contactos. Nada se modificó para hacer este relevo.

## 1. Hallazgo de seguridad (urgente)
Las tablas `products`, `order_lines`, `customers` y `settings` tienen la política RLS `Enable all for anon` (rol `public`, condición `true`, todas las operaciones). Cualquiera con la clave pública de Supabase, que viaja en el JavaScript del dashboard viejo, puede leer, modificar y borrar productos, pedidos mayoristas, clientes mayoristas y el tipo de cambio.
- El único consumidor legítimo es `dashboard`, que usa `createClient(url, anonKey)` sin sesión (`dashboard/src/lib/supabaseClient.ts`).
- `gestion` entra con sesión de usuario; `localventas` y `commerce-admin` también.
- Cerrar esas políticas rompe el dashboard viejo salvo que se migre a sesión, o que se apague.
- **PENDIENTE (decidido 2026-10-22):** el cierre se hace junto con la migración de productos (paso 1). Al cerrarlo: borrar las 4 políticas `Enable all for anon`, dejar acceso solo a administradores (`private.is_commerce_admin` / `is_pricing_admin`) y decidir si el dashboard viejo pasa a sesión o se apaga. Hasta entonces las tablas siguen abiertas.

## 2. Pedidos: lo que impide meter todo en `orders`
| Tema | `orders` hoy | Qué hay que cambiar |
|---|---|---|
| Usuario | `user_id` NOT NULL, FK a `auth.users` (RESTRICT) | Hacerlo opcional; los pedidos a mano no tienen cuenta |
| Estados | `orders_status_check` (10 valores web); las líneas mayoristas usan `Pendiente / En producción / Completado` por línea | El estado de producción ya existe por ítem (`order_items.production_status`: pending, in_production, completed); mapear líneas mayoristas y ventas locales a eso, y agregar a `orders` un estado para pedidos internos |
| Envío | `shipping_method` NOT NULL con check (pickup, national_shipping, international_*) | Usar `pickup` o relajar el check para ventas internas |
| Totales | `orders_total_matches_components` y `order_items_check` (total = unitario por cantidad) | Las líneas mayoristas guardan ARS y UYU con tipo de cambio por línea; hay que decidir moneda de registro (`currency = 'UYU'` es un check) |
| Precio en ARS | no existe | Guardar `unit_price_arg` y `exchange_rate` en `order_items` o en `immutable_snapshot` |
| RLS | lectura propia o admin (`is_commerce_admin`) | Las ventas locales las leen `is_pricing_admin` o `is_commerce_admin`; unificar el criterio |
| Código | `reference_code` por trigger `assign_commerce_reference` (W/M) | Un trigger por canal (W, M, L, R, F), reutilizando las secuencias `private.matearte_*_reference_seq` |

Volumen a migrar: 8 pedidos web, 20 ventas locales (25 ítems), 95 pedidos mayoristas (225 líneas).

## 3. Contactos
- `customers` (45): PK por `full_name`, sin teléfono ni email, política abierta a `anon`; `order_lines.customer` tiene FK a `customers.full_name` con `ON UPDATE CASCADE`.
- `local_sales_customers` (5.697): todos con teléfono, 31 con email, `source_user_id` único.
- `customer_profiles` (44): ligados a `auth.users`, con políticas propias (lectura y edición del propio usuario) y trigger `private.handle_new_customer`.
- `newsletter_subscribers` (10).
- Cruces medidos: 0 mayoristas con teléfono, 78 coincidencias por nombre entre mayoristas y agenda, 3 por teléfono y 1 por email entre web y agenda.
- Ya existen `all_contacts` y `marketing_contact_directory` (unen cuentas, newsletter y agenda); las usan las edge functions de marketing.

## 4. Funciones de base que dependen de las tablas viejas (a reescribir o adaptar)
- Productos: `check_wholesale_line_availability`, `link_catalog_variant_to_legacy`, `next_legacy_product_id`, `refresh_legacy_product_cover`, `sync_catalog_product_name_to_legacy`, `sync_catalog_variant_to_legacy`.
- Ventas locales: `check_local_sale_item_availability`, `create_channel_sale_with_items`, `create_local_sale`, `create_local_sale_with_items`, `gestion_create_local_sale_with_items`, `prevent_channel_reference_change`.
- Contactos: `handle_new_customer`, `queue_upcoming_birthday_emails`, `gestion_customer_profile_details(_full)`, `gestion_update_customer_all`, `gestion_update_web_lead`, `gestion_web_leads`, `gestion_delete_unlinked_contact`, `gestion_delete_unpurchased_web_lead`, `sync_wholesale_customer_name`.

## 5. Quién usa qué (consultas `.from` / `.rpc`)
- **paginaweb**: `orders` (16), `newsletter_subscribers` (13), `cart_items` (12), `designs` (8), `customer_profiles` (7), `commerce_settings` (7), `carts` (7) y RPCs de pago y descuentos. No usa `products`, `order_lines`, `local_sales` ni `customers`.
- **visualizador**: `designs` (7), `customer_profiles` (2) y RPCs de precios y catálogo del personalizador. No usa productos ni pedidos.
- **gestion**: `commerce_products` (9), `orders` (7), `wholesale_product_images`, `products`, `order_lines`, `local_sales_customers` (6 cada uno), `settings`, `purchases`, `fixed_expenses` (5), además de varias RPC `gestion_*`.
- **dashboard** (clave anónima): `products` (9), `order_lines` (8), `customers` (7), `settings` (6).
- **localventas**: `commerce_products`, `local_sales_customers`, `local_sales`, RPC `create_channel_sale_with_items`, `update_local_catalog_item`.
- **commerce-admin**: `orders` (9), `commerce_products` (9), `commerce_variants`, `commerce_product_images`, descuentos y tarifas.
- **Edge functions**: `commerce_admin_users`, `newsletter_subscribers`, `marketing_*`, `lifecycle_email_outbox`, `commerce_email_outbox`, `orders`.

## 6. Riesgos por paso
1. **Productos:** bajo. 206 de 206 filas ya enlazadas; falta reemplazar `products` por una vista y mover las 29 fotos de `wholesale_product_images`.
2. **Pedidos:** alto. Toca checks y RLS de `orders`, que usa la web en producción; conviene hacerlo con pruebas e2e de `paginaweb` antes y después.
3. **Contactos:** medio-alto. Hay que decidir fusiones por nombre con Enzo y no perder cumpleaños, teléfonos adicionales ni orígenes.
4. **Configuración y accesos:** bajo, pero `settings` está abierta a `anon` hoy.

## Estado del paso 1 (productos), 2026-10-22
Hecho en el código de gestión (sin commitear, sin desplegar):
- El mayorista lee el catálogo único (`commerce_products` + variantes con `available_wholesale`); `wholesaleFromCatalog` en `src/wholesaleSource.ts`. El id de cada producto mayorista pasa a ser el de la variante.
- La ficha mayorista propia (`WholesaleProductEditor`), la subida y edición de fotos mayoristas y `nextWholesaleProductId` se eliminaron: nombre, atributos, precio ARS, canales y fotos se editan solo en Catálogo.
- Guardar la cotización ARS ya no recalcula una columna `price_uyu` guardada; el equivalente en UYU se calcula al leer.
- El SKU nuevo es numérico y opcional (propone el siguiente); la base ya rechaza SKU no numéricos.

Respaldos en la base: `private.bak_products_20261022` (206), `private.bak_wholesale_product_images_20261022` (29), `private.bak_order_lines_20261022` (225), `private.bak_customers_20261022` (45). Las 29 fotos mayoristas ya estaban también en `commerce_product_images`.

Pendiente, y depende de desplegar gestión primero (la versión publicada todavía lee `products`):
1. Reemplazar `products` por vista de compatibilidad y quitar los triggers espejo.
2. Cerrar el acceso público de `products`, `order_lines`, `customers` y `settings` (ver sección 1) y decidir qué pasa con el dashboard viejo.
3. Eliminar `wholesale_product_images` cuando nadie la lea.

## Paso 1 completado en la base, 2026-10-22
- `public.products` ya no es una tabla: es una vista de compatibilidad (solo lectura, `security_invoker`, solo `authenticated`) construida desde `commerce_variants` y `commerce_products`. 206 filas, igual al respaldo salvo `id 16` (Imperial Plata 900 Marrón), cuyo precio ARS era un valor calculado y hoy figura 0 porque no tiene precio mayorista cargado.
- Triggers espejo eliminados (`sync_catalog_variant_to_legacy`, `link_catalog_variant_to_legacy`, `sync_catalog_cover_to_legacy`, `sync_catalog_product_name_to_legacy`) y sus funciones. Quedan `sync_variant_name_to_history` y `sync_product_name_to_history`, que mantienen alineados los nombres de `order_lines`, `local_sale_items` y `order_items` cuando se renombra un producto o variante.
- `check_wholesale_line_availability` valida contra el catálogo y acepta variante "Genérico" si el modelo tiene algún color con mayorista.
- Se quitó la política de subida de fotos mayoristas en `storage.objects` (`wholesale_product_images_storage_insert`).
- Acceso público cerrado: se borraron las políticas `Enable all for anon` de `customers`, `order_lines` y `settings`; ahora solo administradores (`is_pricing_admin` o `is_commerce_admin`). Probado: anon ve 0 filas; un administrador ve 45 clientes y 225 líneas. El dashboard viejo (clave anónima) ya no puede leer ni escribir esas tablas.
- Pendiente: eliminar `wholesale_product_images` (sin lectores) y la columna `commerce_variants.legacy_product_id` cuando se apague el dashboard viejo.

## Paso 2b aplicado, 2026-10-22
- Desplegados antes gestión y commerce-admin con las listas de pedidos web filtradas por canal (commit `27f828e`).
- Aplicado `docs/fase2-paso2b.sql`. `orders` tiene 123 pedidos: 8 Web, 95 Mayorista, 19 Local y 1 WhatsApp. Ventas, ítems y líneas quedaron idénticos a las tablas originales (verificación dentro de la misma transacción).
- `local_sales`, `local_sale_items` y `order_lines` son vistas con escritura (disparadores INSTEAD OF). Las tablas originales quedan en `private.legacy_*_20261022`.
- Probado después de aplicar: la API resuelve ventas con ítems anidados entre vistas; sin sesión no se lee nada; un administrador lee 20 ventas, 25 ítems, 225 líneas y 95 pedidos mayoristas, y puede crear un pedido mayorista y una venta local sin generar correos (prueba deshecha).
- Vuelta atrás disponible en `docs/fase2-paso2b-vuelta-atras.sql` (no ensayada: el ensayo quedó bloqueado por permisos).
- Pendiente: probar en pantalla Mayoristas, ventas locales, localventas y la lista de pedidos web.

## Paso 3 aplicado (contactos), 2026-10-22
- Enzo corrió `docs/fase2-paso3-ensayo.sql` (resultado OK) y después `docs/fase2-paso3.sql` en el editor de Supabase.
- `public.contacts` tiene 5.732 contactos: 5.697 de la agenda y 45 mayoristas, de los que 10 quedaron fusionados con su ficha de agenda (Benjamin B, Francisco Gauchat, Gastón Mercado, Juampi Roman, Mariano Dalby, Martin Kern, Miriam Bochatay, Nico Perez, Robert Giménez, Tobías Ciros). Abigail, Anahí, Bautista, Masi y Yamil quedaron separados por coincidir solo en el nombre de pila.
- `customers` y `local_sales_customers` son vistas con escritura; las tablas originales están en `private.legacy_customers_20261022` y `private.legacy_local_sales_customers_20261022`.
- `orders.contact_id` enlaza 110 pedidos (los 95 mayoristas y las ventas locales con cliente); los nuevos se enlazan solos.
- Verificado después de aplicar: sin sesión no se lee ninguna de las vistas ni `contacts`; un administrador lee 5.697 fichas de agenda, 45 mayoristas y 225 líneas; la vista de marketing sigue en 5.764 filas.
- Cuentas web (`customer_profiles`) y newsletter quedan en sus tablas, enlazadas por usuario o email.
- Pendiente: escribir la vuelta atrás del paso 3, probar en pantalla Clientes y el registro de ventas.

## Paso 4 aplicado (seguridad, administradores y tipo de cambio), 2026-10-22
- Enzo corrió `docs/fase2-paso4.sql` en el editor de Supabase (ensayo previo OK: `docs/fase2-paso4-ensayo.sql`).
- Seguridad: `commerce_exchange_rates` y `commerce_international_shipping_rates` ya no se pueden modificar con cualquier cuenta de cliente (antes la regla era `auth.role() = 'authenticated'`); ahora solo `private.is_commerce_admin()`. La lectura pública sigue (la usa la tienda). Comprobado: un cliente con sesión no cambia el dólar, no agrega monedas y no modifica ni borra envíos.
- Administradores: una sola tabla `commerce_admin_users` con `can_manage_pricing` (1 usuario). `private.is_pricing_admin()` lee esa columna; `admin_users` es una vista para localventas. Tabla original en `private.legacy_admin_users_20261022`.
- Tipo de cambio: ARS (0,027) vive en `commerce_exchange_rates` junto a USD y BRL; `settings` es una vista editable (gestión la sigue usando igual). Tabla original en `private.legacy_settings_20261022`.
- `shipping_rates` (envío nacional) y `commerce_international_shipping_rates` (internacional por peso) cumplen funciones distintas: se mantienen las dos.
