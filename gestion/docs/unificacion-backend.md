# Unificación de clientes, productos y producción

Estado: diagnóstico de la base activa, 19 de octubre de 2026. No es una orden de fusión de personas ni de artículos.

## Qué hay realmente

| Entidad | Fuentes actuales | Registros en la base activa | Destino canónico |
| --- | --- | ---: | --- |
| Clientes | `local_sales_customers`, `customers`, `customer_profiles` | 5.691 + 43 + 38 | Una ficha de cliente con ID UUID y vínculo opcional a Auth; minorista/mayorista como clasificación, no como tabla. |
| Productos | `commerce_products`, `commerce_variants`, `products` | 97 fichas + 122 variantes de color + 46 artículos mayoristas | `commerce_products` como ficha y `commerce_variants` exclusivamente para color/SKU. `products` queda sólo como compatibilidad durante la última semana del dashboard. |
| Producción | `order_items.production_status`, `local_sale_items.production_status`, `order_lines.status` | 7 + 17 + 223 líneas | Una tabla de trabajos de producción referenciada por las líneas de venta; una única escritura de estado. |

`orders`, `local_sales` y `order_lines` no son tres catálogos de productos ni tres tablas de clientes: guardan transacciones y precios/cantidades históricos. Las líneas de pedido se conservan aunque se unifique producción. `commerce_product_images` y `wholesale_product_images` guardan medios, no fichas de producto. `rural_raffle_entries`, `newsletter_subscribers` y `gestion_customer_contact_history` son inscripciones/historiales, no fichas de cliente; tampoco se deben aplanar dentro de la ficha.

## Riesgos verificados

- Hay 22 nombres mayoristas que coinciden con alguno de la agenda, pero 317 nombres de la agenda están repetidos. No se puede deduplicar personas por nombre. Ningún registro de `local_sales_customers` está vinculado hoy mediante `linked_customer_id` ni `source_user_id`.
- Las 46 fichas mayoristas sólo coinciden por nombre con 2 fichas del catálogo web; un nombre igual tampoco autoriza fusionar productos. La migración de catálogo ya preparada crea vínculos uno a uno, sin fusiones.
- `order_lines.customer` es una clave de texto hacia `customers.full_name`; `local_sales.customer_id` es UUID hacia `local_sales_customers`; `orders.user_id` apunta a Auth. Un corte directo de tablas rompería estas relaciones. Cinco ventas locales no tienen cliente asociado y deben seguir siendo ventas válidas.
- El dashboard y Gestión todavía escriben `customers`, `products` y `order_lines`; web/personalizador escriben `customer_profiles`; el local escribe `local_sales_customers`. Las tres tablas legacy tienen una política `ALL` con `true` para `public` y privilegios directos de lectura, escritura, borrado y `TRUNCATE` para `anon`. Es un riesgo de seguridad **urgente**; el dashboard debe pasar a un acceso autenticado antes de revocar esos permisos, y la tabla nueva nunca debe heredarlos.
- Las migraciones locales `20261019120000_unified_catalog_channels_and_mate_details.sql`, `20261019143000_color_only_catalog_variants.sql`, `20261019200000_add_personalized_production_access.sql` y `20261019210000_local_sale_personalizations.sql` no tienen entradas con esos nombres en el historial remoto. Además, faltan en la base activa columnas que requieren la primera y la última. Hay que reconciliar esquema e historial antes de ejecutar una migración posterior.

## Contrato de datos objetivo

1. **Cliente:** ID UUID estable, `auth_user_id` opcional y único, datos personales comunes, clasificación minorista/mayorista y canales. Las identidades legacy se importan como filas distintas salvo vínculo explícito verificado. Las ventas local, web y mayorista apuntan al mismo ID canónico; la venta puede no tener cliente.
2. **Producto:** ID de `commerce_products` para una ficha con categoría, nombre, material, virola, cuero, publicación por canal y fotos. `commerce_variants` sólo distingue colores y sus SKU/precios. Cada `products.id` legacy se vincula a una variante mediante una clave única durante la convivencia. No se fusionan artículos vendidos por coincidencia de texto.
3. **Producción:** ID del trabajo, referencia obligatoria a exactamente una línea de venta, estado normalizado, fechas y responsable. Cantidad, precio y descripción de la venta permanecen en el comprobante; cambiar producción no reescribe ni recalcula importes. Personalizados usan el mismo trabajo con sus especificaciones adjuntas.

## Orden de corte y comprobaciones

1. Aplicar y validar las migraciones pendientes en orden. Conciliar productos legacy contra catálogo por ID, imágenes y canal. No fusionar los artículos que el usuario no haya indicado.
2. Crear la ficha canónica de cliente y claves foráneas nuevas sin borrar las anteriores. Importar las tres fuentes con mapeo de origen explícito. Verificar conteos, unicidad de vínculos y que las 223 líneas mayoristas, 14 ventas locales y 7 pedidos web sigan accesibles.
3. Cambiar los escritores y lectores de Gestión, web, localventas, personalizador y dashboard al ID de cliente y al catálogo canónicos. Mantener una capa de compatibilidad temporal para el dashboard viejo; comprobar que cada operación nueva escribe una sola vez en el origen canónico.
4. Crear los trabajos de producción desde las líneas existentes; normalizar `Completado`, `En producción`, `Pendiente` y sus equivalentes ingleses. Cambiar todas las pantallas y acciones de producción a esa tabla. Verificar los 247 trabajos iniciales contra las 247 líneas de venta actuales y los estados por canal.
5. Tras comparar ventas, cantidades, nombres, precios históricos, estados y permisos en todos los canales, dejar las tablas legacy en sólo lectura. Retirar políticas anónimas, luego las tablas duplicadas y la compatibilidad cuando el dashboard termine su última semana. No realizar este paso por calendario únicamente.

**Criterio de terminado:** una sola fuente editable de cliente, catálogo y estado de producción; todas las ventas históricas conservadas; cero referencias huérfanas; conteos conciliados; RLS comprobada con perfiles anónimo, cliente y administrador. El número de tablas físicas seguirá incluyendo variantes, fotos, ventas y líneas porque representan relaciones distintas, no duplicados de estas tres entidades.
