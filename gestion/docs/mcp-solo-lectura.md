# Gestión desde ChatGPT

El servidor MCP de Gestión está en `supabase/functions/gestion-mcp/`. Su URL es:

`https://agdkljuulwjwjasftcce.supabase.co/functions/v1/gestion-mcp`

Ofrece herramientas para identificar la cuenta, enumerar fuentes y consultar registros comerciales, clientes, productos, producción, entregas, finanzas y Marketing. Las listas tienen paginación y límites. Los importes cuyo nombre termina en `_minor` están en centésimos. Las páginas de Gestión que todavía no tienen una fuente conectada tampoco tienen datos reales para consultar en el MCP.

## Escritura de gastos para Richard

El servidor anuncia `listar_opciones_gastos` y `registrar_gastos` con una lista estable de herramientas para que ChatGPT pueda descubrirlas. Solo la cuenta de Gestión de Richard puede ejecutarlas: cada llamada comprueba su ID antes de acceder a Finanzas. La segunda herramienta crea entre 1 y 25 gastos por llamada en `purchases`, que alimenta Compras y Finanzas. Usa su token OAuth y las políticas RLS existentes; no se amplían permisos de base de datos para otras cuentas. `quien_soy` informa `puede_registrar_gastos` según la cuenta conectada. El MCP no crea ingresos, ventas, pedidos, categorías ni gastos fijos.

Richard puede adjuntar un estado de cuenta a su chat para que ChatGPT extraiga los débitos que sean gastos. El MCP registra los movimientos revisados, pero no recibe ni guarda el PDF. ChatGPT debe mostrar fechas, conceptos, importes, monedas y categorías, y obtener confirmación expresa antes de llamar a `registrar_gastos`. Los créditos y transferencias entre cuentas no se registran como gastos.

Cada movimiento lleva una `clave_movimiento` estable que se reutiliza al reintentar. El servidor deriva de ella un ID único para la cuenta de Richard: repetir la misma llamada no duplica el gasto. También detiene el lote si detecta fecha, descripción, importe y moneda iguales a otro gasto, salvo que Richard confirme expresamente que son transacciones distintas. Si falla un lote a mitad de camino, el resultado indica cuáles se guardaron; el mismo lote puede reintentarse con las mismas claves.

Después de publicar una versión nueva del MCP, hay que ejecutar la exploración de herramientas del complemento en ChatGPT y abrir un chat nuevo. Reconectar OAuth por sí solo no garantiza que ChatGPT incorpore las herramientas nuevas. La pantalla de consentimiento de Gestión informa el alcance de escritura.

## Alta de productos y separación de credenciales

`registrar_producto` está reservado a Richard. Crea la ficha y las variantes opcionales en una sola transacción. La ficha queda sin publicar y las variantes quedan inactivas para Local, Web y Mayorista. El alta requiere confirmación y reutiliza la misma `clave_alta` ante reintentos. Las opciones del catálogo se consultan con `listar_opciones_alta_producto`. Los servicios se cargan en Gestión porque sus variantes se activan para Local al crearlas.

El conector utiliza su sesión OAuth y conserva las políticas de fila del usuario. La API de datos solo acepta esa sesión si la llamada a una ruta permitida trae una firma interna del servidor MCP, ligada al usuario, la sesión, el método, la ruta y el momento. El token OAuth por sí solo queda bloqueado en la API de datos y en el acceso autenticado a archivos. Las funciones administrativas y las rutas web que verifican sesiones también separan OAuth de las sesiones directas. Marketing solo admite las lecturas que hace el MCP con su firma.

El 6 de noviembre de 2026 se aplicó en producción `20261106143342_gestion_mcp_catalog_and_bridge.sql`. Dejó preparada la clave de Vault y la operación interna de alta. La función MCP activa todavía no ofrece el alta.

Para completar la activación en producción:

1. Verificar que el Supabase Auth administrado incluya [la corrección que reserva los endpoints de cuenta a las sesiones directas](https://github.com/supabase/auth/pull/2898). El proyecto todavía informaba `v2.197.0` al aplicar la preparación. Las políticas de datos no controlan los endpoints del propio Auth.
2. Confirmar las rutas web y la pantalla de consentimiento desplegadas desde GitHub. Publicar las cuatro funciones de apoyo y luego `gestion-mcp`. Comprobar las consultas del MCP y las sesiones del panel.
3. Aplicar `20261106143343_gestion_mcp_enforce_oauth_boundary.sql`. Comprobar que la API directa rechace las credenciales OAuth, que el panel siga operando y que las consultas y los gastos continúen en el MCP. Actualizar herramientas del complemento de Richard y verificar la disponibilidad del alta en un chat nuevo.

La prueba reproducible se ejecuta con `psql -v ON_ERROR_STOP=1 -f supabase/tests/gestion_mcp_oauth.sql` en una base PostgreSQL vacía y aislada. Usa datos de prueba y simula el contexto de PostgREST.

Las consultas de catálogo y variantes devuelven `imagen_principal_url`, `image_url` e `images` con la foto pública actual de Gestión, seleccionada por variante y color; `imagenes_catalogo` devuelve `image_url`. Cuando se busca un único producto o variante, la herramienta también adjunta los píxeles de esa foto al resultado. ChatGPT debe usar solo esa imagen al mostrar un producto y no sustituirla por fotos de terceros obtenidas mediante búsqueda web. Este refuerzo se publicó en la versión 5 de `gestion-mcp` el 24/10/2026.

Límite observado: ChatGPT siguió buscando imágenes en la web y mostró fotos de tiendas ajenas aun después de recibir la imagen oficial del MCP. El servidor no controla la búsqueda web de ChatGPT. La ficha pública del SKU 105 responde correctamente, figura en el sitemap y anuncia la foto correcta en `og:image`; el archivo de Supabase Storage responde con `X-Robots-Tag: none`, lo que puede impedir su aparición en buscadores de imágenes. Servir las fotos desde el dominio propio sería una mejora de indexación separada; no garantiza que ChatGPT deje de elegir otras fotos en sus búsquedas.

**Estado (24/10/2026):** la función está publicada en Supabase. Responde `401` sin sesión y anuncia correctamente sus metadatos OAuth. La pantalla de consentimiento está publicada en `https://matearte-gestion.vercel.app/oauth/consent`. Supabase dirige la autorización a `https://www.matearteuruguay.com/oauth/consent`; esa ruta redirige a Gestión conservando `authorization_id`. Se registró un cliente OAuth público y se creó el complemento en la cuenta Free de Enzo Gaston. Una publicación posterior de Gestión había omitido la pantalla de consentimiento; se reincorporó a producción. Supabase Auth también requería incluir el origen de Gestión en **Redirect URLs** para aceptar el consentimiento. Tras ese ajuste, el usuario confirmó que la conexión funciona en ChatGPT Free. Falta configurar y probar la cuenta de ChatGPT de Richard.

## Acceso y alcance

### Actualización del 28/10/2026: ventas de Richard y consultas adicionales

La llamada de Richard a `ventas_locales` sí pasó la autenticación. Los registros del servidor mostraron una consulta con `offset=50`, `limit=50` y respuesta HTTP 416: había 31 ventas de canales internos entre el 1 y el 28 de octubre. El conector convertía cualquier error de consulta en un mensaje de permisos. No era necesario ampliar los permisos de Richard.

- Todas las herramientas usan ahora páginas desde **1**. El valor antiguo `0` se acepta como alias de la primera página. Seguir `siguiente_pagina` para continuar. Una página fuera de rango devuelve una lista vacía, el total y `fuera_de_rango`, sin inventar un error de permisos.
- `resumir_ventas_locales` recorre todas las páginas para el período solicitado y distingue **Local**, Feria, WhatsApp, Instagram y Facebook. El canal por defecto es Local; `todos` incluye los cinco. Separa monedas y devuelve cantidad de ventas, importe vendido, cobro inicial, cobros posteriores, saldo pendiente y excedentes cobrados.
- El resumen mide las **ventas realizadas dentro del período**, con sus cobros registrados hasta la fecha final inclusive. No es un informe de flujo de caja: no incluye cobros de ventas anteriores al período. Los importes usan los registros actuales, no una reconstrucción histórica de sus modificaciones. Las señas se cuentan una sola vez, siguiendo `commerceAdapter.ts`.
- El resumen admite hasta 366 días y hasta 10.000 registros por conjunto (ventas, artículos y cobros). Si no puede leer el conjunto completo, falla explícitamente y pide reducir el período; nunca presenta una suma parcial como total.
- Nuevas fuentes: `pedidos` (todos los canales, despacho y entrega), `produccion` (artículos con pedido, cliente y entrega relacionados) y `reportes_publicidad` (campañas, períodos, depósitos y saldos).
- `consultar_registros` admite filtros exactos de canal, estado, pedido, referencia, categoría o SKU según la fuente. `listar_fuentes` informa cuáles están disponibles y qué columna se usa para las fechas. Las fechas de entrada siguen siendo ISO `AAAA-MM-DD`; las fechas con hora se interpretan por día de Uruguay.
- `descuentos` incluye `category_codes` e `include_design_items`, para distinguir categorías del catálogo y Mates Personalizados. No se expone la tabla interna de reservas/usos de cupones, que no concede lectura a las sesiones de usuario.
- `articulos_web` excluye ahora las líneas de canales internos mediante el pedido relacionado. No sumar `pedidos` con `pedidos_web` ni `produccion` con otras fuentes de artículos: representan registros superpuestos.

Se mantiene el perfil propietario y la sesión individual de Supabase en todas las consultas. No se cambian roles, grants ni políticas RLS. Los errores de permisos reales se distinguen de errores de sesión, configuración o consulta.

**Publicación verificada:** `gestion-mcp` versión 6 (servidor 1.1.0) activa en Supabase. Los archivos desplegados coinciden con el código local. El endpoint devuelve 401 sin sesión y los metadatos OAuth devuelven 200. Pasaron nueve pruebas de regresión y la comprobación de tipos. El cálculo se comparó con lecturas bajo el rol autenticado de Richard: del 01/10/2026 al 28/10/2026, Local tiene 27 ventas por 6.877.300 centésimos UYU; Instagram y WhatsApp tienen dos ventas cada uno. Esta publicación actualiza únicamente la función MCP, sin publicar Gestión ni la tienda en Vercel.

Pruebas recomendadas después de actualizar la conexión en ChatGPT: `quien_soy` debe identificar a Richard; consultar ventas locales con `pagina: 1` y con una página fuera de rango; pedir un resumen de Local y otro de todos los canales; consultar un pedido por referencia, producción por estado y las categorías de un cupón. La llamada observada confirma que la cuenta de Richard ya está conectada; la actualización de herramientas debe verificarse en un chat nuevo.

- Cada petición exige un token de Supabase Auth. El servidor comprueba que corresponda a una cuenta activa de Gestión con perfil propietario (`t1`) y consulta con las políticas RLS de esa misma cuenta.
- Las consultas no exponen SQL arbitrario ni claves de servicio. Las herramientas de escritura están reservadas a Richard y crean gastos o fichas de productos en borrador. Marketing admite únicamente las lecturas indicadas arriba.
- El bloqueo del acceso directo a los datos entra en vigencia al aplicar la segunda migración, después de desplegar el puente y sus controles. Antes de esa migración, la sesión OAuth conserva el alcance anterior fuera del MCP.
- Un `401` anónimo debe incluir `WWW-Authenticate` con la URL de metadatos OAuth. La ruta `/oauth-protected-resource` debe responder con la URL de Supabase Auth. El servidor no devuelve datos sin iniciar sesión.

## Conexión con una cuenta compatible

1. El **Site URL** de Supabase dirige la autorización a la tienda. `paginaweb/src/app/oauth/consent/route.ts` redirige a la pantalla de Gestión, conservando `authorization_id`; mantener esta ruta pública y fuera del middleware de idioma. En Supabase Auth → URL Configuration, incluir el origen exacto `https://matearte-gestion.vercel.app` en **Redirect URLs**: Auth valida el encabezado `Origin` de la pantalla de consentimiento contra esa lista. No cambiar el Site URL de Auth para este MCP.
2. En la **cuenta Free de prueba elegida por el usuario**, abrir **Complementos → Añadir → Añadir servidor MCP personalizado**, indicar la URL anterior y elegir OAuth. Abrir **Ajustes avanzados de OAuth** y copiar la **URL de devolución de llamada** que muestre esa cuenta. No utilizar una URL copiada desde otro perfil de Chrome o cuenta de ChatGPT.
3. Registrar en Supabase un cliente OAuth específico para esa cuenta de ChatGPT con la URL de devolución de llamada exacta. Para la prueba Free de Enzo Gaston ya se registró un cliente público con ID `2f985e64-d473-4e8a-9c0a-ce9c767c4af0` y URL de retorno `https://chatgpt.com/connector/oauth/uZ05yJTPcXGG`. El formulario observado permite elegir **Cliente OAuth definido por el usuario** e introducir el ID; este cliente público no tiene secreto. Así no hace falta habilitar el registro dinámico para cualquier aplicación. Mantener `offline_access` entre los ámbitos si el cliente lo solicita para renovar la sesión.
4. Introducir el ID del cliente OAuth en ChatGPT y completar la conexión con una cuenta propietaria de Gestión. Revisar los permisos y aceptar el consentimiento.
5. Probar `quien_soy`, `listar_fuentes`, una consulta de catálogo y una consulta de pedidos. Comprobar que una cuenta sin perfil propietario reciba `403`. Después de explorar las herramientas nuevas, comprobar que `quien_soy` informe escritura para Richard, que `registrar_gastos` rechace otra cuenta y que Richard pueda consultar las categorías.
6. Repetir los pasos 2 a 5 en la **cuenta de Richard**, con su propia URL de devolución de llamada y un cliente OAuth separado.

**Disponibilidad observada:** el 24/10/2026 se creó el complemento en la cuenta ChatGPT Free de Enzo Gaston y el usuario confirmó que consulta Gestión correctamente. El 28/10/2026 se observó una consulta autenticada con la cuenta de Richard. La escritura de gastos debe verificarse en su conexión después de actualizar las herramientas.

## Mantenimiento

- Al cambiar las fuentes, mantener alineada la lista de herramientas con las rutas autorizadas en Supabase. Mantener la escritura acotada a gastos y altas de productos de Richard, sin SQL libre ni campos de pagos internos como `raw_payload`.
- Comprobar tipos con `npx deno check --lock supabase/functions/gestion-mcp/deno.lock supabase/functions/gestion-mcp/index.ts` y probar consultas y escritura con `npx deno test --lock supabase/functions/gestion-mcp/deno.lock supabase/functions/gestion-mcp/queries_test.ts supabase/functions/gestion-mcp/financeWrites_test.ts`. Compilar Gestión si cambia su interfaz.
- La función usa `verify_jwt = false` para que el descubrimiento OAuth anónimo llegue al middleware; `withSupabase({ auth: "user" })` verifica el token antes de cualquier consulta.
- Si cambia la lista o los esquemas de herramientas, actualizar la conexión en ChatGPT y repetir las pruebas de lectura y autorización.

Fuentes: [MCP y OAuth de Supabase](https://supabase.com/docs/guides/ai-tools/byo-mcp), [conexiones MCP en ChatGPT](https://help.openai.com/en/articles/12584461-connecting-custom-mcp-servers-in-chatgpt).
