# Historial de migraciones de Matearte

## Referencias de campaña de WhatsApp

`20261120033454_web_referencias.sql` se aplicó al proyecto de MateArte el 20 de noviembre de 2026. Guarda el código de la consulta, los parámetros de campaña y la fecha. El servidor web inserta, el rol `crm_app` lee y la tabla tiene seguridad por fila. Se verificaron los permisos y se revirtió la transacción de prueba.

## Oportunidades comerciales

`20261120030916_commercial_opportunities.sql` se aplicó al proyecto de MateArte el 20 de noviembre de 2026. La tabla alimenta Comercial / Consultas y oportunidades y la fuente `oportunidades_comerciales` del MCP. La lectura usa el permiso de esa página. Richard puede reservar un destinatario y registrar el resultado del envío desde su propia casilla. Las bajas de Marketing bloquean la reserva.

Se importaron 106 empresas desde el CSV privado. Las pruebas de reserva, reintento, envío confirmado, cancelación y baja se ejecutaron con registros de prueba en una transacción revertida.

`20261120031700_commercial_opportunity_status.sql` agrega el estado «No hubo respuesta» y permite editar el estado desde la vista de oportunidades. Conserva la referencia de los correos enviados y bloquea un segundo envío a través del MCP aunque cambie el estado manual. Se verificaron los cambios de estado y los reintentos con una transacción revertida.

`20261120032236_commercial_opportunity_email_drafts.sql` agrega la apertura personalizada de los correos comerciales. Se cargaron 106 textos y se verificó su lectura desde Consultas y oportunidades con el permiso de esa página.

## CRM de WhatsApp

`20261119180000_crm_whatsapp_schema.sql` se aplicó al proyecto remoto `agdkljuulwjwjasftcce` el 19 de noviembre de 2026, por pedido de Enzo. Crea el esquema `crm` con las tablas del asistente de WhatsApp (`crm-whatsapp-ia`), la cola `crm.comandos` y `crm.estado_asistente`. No toca ninguna tabla de Gestión.

Seguridad: el rol `crm_app` (sin acceso hasta que Enzo le pone contraseña) es el dueño de las tablas y solo tiene permiso sobre `crm`; lo usa el servidor del asistente. `anon` y `authenticated` no ven el esquema. Gestión lee con `public.crm_panel()` y pide acciones con `public.crm_encolar()`, que exigen permiso de página `/crm/...` mediante `private.gestion_has_page_access`. Se verificó: 11 tablas de `crm_app` con RLS, sin uso del esquema para `anon` ni `authenticated`, `crm_panel` sin ejecución para `anon` y un usuario sin permiso sin acceso.

`20261119190000_crm_panel_bigint.sql` corrige un desborde de entero en `crm_panel` (el filtro de 30 días). Se verificó con la sesión de t1: 1 cliente, 21 mensajes y el estado del asistente. Ese mismo día, la contraseña de `crm_app` se activó con su huella SCRAM, generada en la PC del CRM: la contraseña no salió de esa PC.

`20261119200000_crm_cierre_y_notas.sql` suma a la cola las acciones `cerrar` (Ha dicho que sí con importe, No sigue con motivo) y `nota`, que piden permiso de `/crm/clientes`, y hace que `crm_panel` devuelva las notas de cada cliente.

`20261119210000_crm_guardar_campo.sql` suma `guardar_campo` ({ruta, valor}): Gestión edita la configuración del asistente campo por campo. La base solo acepta una lista cerrada de rutas; las del negocio piden `/crm/ajustes` y las demás `/crm/agente`. El servidor del asistente vuelve a validar cada valor.

`20261119220000_crm_conexiones.sql` suma el pedido `conexiones` (volver a comprobar, números permitidos del modo prueba y desvincular el móvil) y la ruta `plantilla` (mensaje aprobado) en `guardar_campo`; los dos piden `/crm/ajustes`. Las claves siguen sin pasar por Gestión: solo se publica si están guardadas y sus últimos 4 caracteres.

## Mensajes de la barra negra

`20261118171637_site_top_bar_messages.sql` se aplicó al proyecto remoto el 18 de noviembre de 2026, por pedido de Enzo. Crea `site_top_bar_messages` (texto en español, inglés y portugués, acción, orden y visibilidad) con lectura pública de los mensajes visibles y escritura solo para administradores de comercio. Carga los tres mensajes iniciales: suscripción, transferencia y medios de pago. Se editan en Gestión, Marketing, Avisos.

## Descuento general de la tienda

`20261118161927_storewide_sale_price.sql` se aplicó al proyecto remoto `agdkljuulwjwjasftcce` el 18 de noviembre de 2026, por pedido de Enzo, y quedó **apagado**: `commerce_settings.storewide_sale_enabled` es `false`. Agrega el porcentaje y las fechas en `commerce_settings` y tres funciones (`storewide_sale_percent`, `storewide_sale_price`, `web_unit_price`). Cambia el precio que cobran Uruguay por transferencia, Argentina, PayPal, mayorista por transferencia y pedido internacional; Mercado Pago cobra los precios que arma el servidor web. Los pedidos de Gestión no cambian.

Reglas: el precio rebajado se redondea al peso entero y no se acumula con la transferencia (10%), el mayorista ni los códigos; se cobra el precio más bajo. Si el pedido trae un código, la base apaga el descuento general para esa transacción (`app.storewide_sale_off`); la web decide cuál conviene más al cliente y solo envía el código cuando descuenta más.

La migración parchea las definiciones vigentes de las funciones de cobro con reemplazos exactos y falla si alguna definición cambió. Antes de aplicarla se probó cada camino dentro de una transacción revertida: pedido internacional, PayPal con y sin código, PayPal mayorista, transferencia en Uruguay con 20% y con 5%, mayorista por transferencia y Argentina. Para activarlo, usar Marketing, Descuentos, Descuento general en la web.

## Alta de productos por MCP

El 6 de noviembre de 2026 se aplicaron `20261106143342_gestion_mcp_catalog_and_bridge.sql` y `20261106144604_gestion_mcp_enforce_oauth_boundary.sql` en producción. La versión 16 de `gestion-mcp` habilitó el alta en borrador para Richard. Se verificó que la clave de firma esté reservada al servidor y que la API de datos exija la firma para llamadas OAuth. La actualización de herramientas en ChatGPT y el estado de Supabase Auth se detallan en [MCP de Gestión](../gestion/docs/mcp-solo-lectura.md).

## Analítica de recorridos

`20261105201523_analytics_journeys.sql` se aplicó al proyecto remoto `agdkljuulwjwjasftcce` el 5 de noviembre de 2026, por pedido de Enzo. Se verificaron las seis tablas nuevas con RLS, la falta de acceso directo para `anon` y `authenticated`, la ejecución del informe reservada a `service_role` y una consulta vacía válida. Se publicaron las tres funciones de Analítica y se comprobó que la vista local carga el informe y GA4. Los trabajos diarios de limpieza y archivo de Vercel quedaron activos. El archivo inicial tiene 62 registros completos y 118 pendientes dentro de los 90 días; los pendientes corresponden a fechas que la API de Vercel ya no ofrece.

## Cobros iniciales y saldos de ventas internas

`20261105193722_preserve_local_sale_initial_collection.sql` conserva el importe y el medio del cobro inicial en las ventas internas. El RPC de edición rechaza cambios de fecha, importe o medio originales; permite corregir artículos y mantiene cada cobro posterior en `local_sale_receipts` con su propia fecha. `20261105194056_prevent_fully_paid_sale_balance_drift.sql` impide que la edición de una venta originalmente pagada en su totalidad genere un saldo nuevo por cambiar el valor de los artículos. Ambas migraciones están aplicadas al proyecto remoto. Se verificaron con transacciones revertidas: modificación de artículos con seña sin tocar el cobro inicial, rechazo de un cambio de seña, registro de un cobro posterior con fecha separada y rechazo de un nuevo saldo en una venta ya pagada.

La pantalla local de edición muestra fecha, importe y medio originales como datos fijos. La ficha de la venta muestra los importes de artículos que discrepan del cobro inicial sin convertir esa diferencia histórica automáticamente en deuda. La revisión remota encontró `#L020`: artículo por $41.000, cobro inicial por $4.100, sin otro cobro. Enzo confirmó que el artículo costó $4.100 y `20261105194842_correct_l020_article_amount.sql` corrigió solo su precio unitario y total. Se verificó que la compra conserva su fecha original del 09/10/2026, el cobro inicial sigue en $4.100, no hay cobros posteriores y el cambio aparece en Logs. No se encontraron cobros posteriores anteriores a la compra, cobros duplicados idénticos ni ventas cobradas por encima del valor de artículos.

## Fecha original de venta

`20261105191703_preserve_original_sale_date.sql` se aplicó al proyecto remoto el 5 de noviembre de 2026. Una vez que `orders.sold_on` tiene fecha, el trigger conserva ese valor ante cualquier modificación posterior, incluida una edición desde una versión anterior de Gestión o el registro de un cobro. Los pedidos sin fecha todavía pueden recibir su primera fecha de venta. La pantalla de edición local muestra la fecha original como dato fijo y envía el valor ya guardado.

Enzo confirmó que la fecha original de R006 fue el 18/10/2026 y la de R004 el 27/10/2026. `20261105192521_correct_r006_original_sale_date.sql` restauró solo R006 a 18/10/2026 y recalculó las fechas de compra de su cliente. R004 ya estaba en 27/10/2026. Las fechas de los cobros registrados permanecieron en 03/11/2026 y 05/11/2026, respectivamente. Logs conserva la corrección de R006 como evento de Sistema, con antes 05/11 y después 18/10. El trigger protector quedó activo.

## Logs de Gestión: base activa, publicación de aplicaciones pendiente

`20261105182846_gestion_private_audit_logs.sql` se aplicó al proyecto remoto `agdkljuulwjwjasftcce` el 5 de noviembre de 2026 a las 15:28:46, hora de Uruguay, con autorización explícita. El archivo local se alineó con la versión registrada por Supabase. Se verificaron los 80 triggers de cambios sobre 40 tablas, el trigger de nuevas sesiones, las restricciones de escritura y las consultas de ambos lectores. Las cuentas de Flor Costa, Flor Pizzorno y Marketing no pueden consultar el listado ni el detalle.

Queda pendiente publicar las funciones `gestion-users` y `marketing-workspace`, las rutas administrativas de `paginaweb` y el frontend de Gestión. Las funciones nuevas transmiten el responsable verificado para las escrituras de servicio; hasta su publicación, las escrituras de servicio sin ese contexto aparecen como Sistema. La vista local ya puede consultar la base activa. GitHub y Vercel requieren la autorización explícita de publicación.

La revisión de seguridad señaló que las tres tablas privadas no tienen políticas de acceso directo y que las tres consultas usan SECURITY DEFINER. Es intencional: se revocó el acceso directo y cada consulta verifica la lista privada de lectores activos. Las pruebas con el rol authenticated confirmaron el rechazo del listado y detalle para las tres cuentas no autorizadas.

El historial comienza al aplicar la migración. No se reconstruyen cambios anteriores; la corrección posterior de la fecha de R006 sí quedó registrada. Los únicos lectores iniciales son las cuentas verificadas de Enzo y Richard, siempre que sigan activas. Los registros de auditoría no se pueden modificar ni borrar mediante la aplicación.

Prueba reproducible en una base PostgreSQL vacía y aislada: cargar `tests/fixtures/gestion_audit_schema.sql`, luego la migración y finalmente `tests/gestion_audit_logs.sql`, con `psql -v ON_ERROR_STOP=1`. La fixture contiene solo la estructura de las tablas auditadas; no es un respaldo ni una reconstrucción completa de producción. Las pruebas de datos terminan con `ROLLBACK`.

El 3 de noviembre de 2026 se alinearon los nombres y números de versión de los archivos locales con las 226 migraciones registradas en el proyecto Supabase `agdkljuulwjwjasftcce`. Supabase compara los números de versión para decidir qué SQL falta aplicar.

Las 15 migraciones de datos iniciales del 18 de agosto se representan con marcadores. El SQL original contiene nombres de clientes y pedidos reales y no se publica en GitHub. Por eso, reconstruir una base local desde cero no reproduce esos registros históricos.

Algunos archivos SQL antiguos fueron adaptados después de su primera ejecución, por ejemplo al retirar el control de stock. La alineación verificada aquí es de **versión y nombre**, no una afirmación de que cada archivo sea idéntico al texto guardado en el historial remoto. Cualquier cambio nuevo de esquema o datos debe tener una migración nueva; no se deben reejecutar las versiones históricas sobre producción.
