# Migración funcional de Commerce Admin a Gestión

Fecha: 13 de octubre de 2026 (Uruguay).

## Resultado

Las funciones del panel Commerce Admin están integradas en las rutas existentes de Gestión. No se crea otro panel dentro de Administración. La URL retirada `/administracion/comercio` redirige a Ventas y pedidos. No se modificó ni retiró Commerce Admin, la tienda pública o sus contratos.

Los dos paneles consultan y actualizan las mismas tablas y los mismos archivos de Supabase. Esto evita una copia que se desactualice o dos escrituras por compra. Gestión actualiza su estado compartido después de cada operación, cada minuto y al pulsar Actualizar. No almacena registros comerciales en localStorage ni rellena errores con datos ficticios.

## Correspondencia funcional

| Commerce Admin | Gestión | Funciones disponibles |
| --- | --- | --- |
| Catálogo | Productos → Catálogo / Publicación | Crear ficha; nombre, descripción, categoría, atributos, modalidad y peso; publicar/ocultar; eliminación con confirmación y restricciones del origen |
| Variantes | Ficha del producto; acceso Editar desde Precios | Crear, editar SKU, opciones y precio base, activar/desactivar, eliminar; el precio publicado respeta el ajuste de la base |
| Imágenes | Ficha del producto | Subir varias imágenes, validar tipo/tamaño, ver galería, asociar color, mover a otra ficha, eliminar; ajustar zoom y posición de portada sin sustituir el original |
| Lista de precios | Productos → Precios por canal | Búsqueda, categoría, ordenar por SKU/precio, imprimir y acceso al editor |
| Categorías y atributos | Productos → Categorías y atributos | Crear/editar familias, atributos, opciones, colores y reglas por categoría; estado activo, obligatoriedad y filtros |
| Pedidos | Comercial → Ventas y pedidos; Entregas; historial del cliente | Todos los artículos, SKU/opciones/peso, importe histórico, descuentos, dirección, modalidad, teléfono y contacto |
| Seguimiento | Detalle del pedido en Ventas o Entregas | Transportista conocido o personalizado, código, marcar enviado, editar y volver a preparación; correo del flujo existente |
| Comprobantes | Detalle del pedido | Abrir imagen/PDF con acceso firmado, renovar enlace, aprobar transferencia o rechazar con motivo y confirmación usando el servicio existente |
| Revisión de diseño | Detalle del pedido | Aprobar; rechazo y devolución mediante el endpoint original, con motivo; no implementa un proveedor de pagos nuevo |
| Personalizados | Producción → Personalizaciones y archivos | Ficha por pedido, virola y fleje, vistas previas, originales privados, descarga con enlace firmado, contacto y control manual de estado como en el origen |
| Descuentos | Marketing → Descuentos y promociones | Crear/editar, generar código, porcentaje o monto fijo, fechas, habilitar/deshabilitar |
| Cotizaciones | Finanzas → Monedas y cotizaciones | Editar USD/BRL con validación; no inventa cotización si falta una fila |
| Tarifario internacional | Entregas → Tarifas y simulador | Editar por peso/zona, guardar, descartar, copiar tabla y simular; no restablece tarifas inventadas si la base falla |
| Ajuste de precios / mayoristas | Productos → Precios → Ajustes y mayoristas | Ajuste sobre precio base; cantidad mínima, descuento y activación mayorista |
| Configuración | Administración → Canales y medios de pago | Comercio, Mercado Pago, PayPal y datos bancarios del checkout mayorista |
| Contactos de pedidos | Clientes → Base | Editar nombre, correo y teléfono de los pedidos asociados; historial compartido, guardado atómico y conservación de versiones anteriores. Mail y celular figuran en columnas separadas, junto con nacimiento, ciudad y país cuando constan en las fuentes. |

La edición de contactos amplía lo disponible en el panel anterior: no cambia credenciales ni la dirección de una compra. Se agrupan por cuenta, correo normalizado o pedido. Los perfiles registrados sin compras no forman parte de la lista de Commerce Admin; la política de `customer_profiles` sigue intacta.

Gestión consulta las fechas de nacimiento de perfiles web solo cuando existe un pedido de esa cuenta, mediante `gestion_customer_profile_details`, y las de clientes del local vinculados por usuario o correo exacto mediante la política de lectura existente. No crea clientes del local ni rellena fechas ausentes.

## Datos y seguridad

- Importes de pedidos/variantes en centésimos; tarifas internacionales en pesos. Los precios conservan decimales. El total histórico nunca se recalcula con precios actuales.
- Se mantienen separados pago, producción y entrega. El control manual de pago de Personalizados conserva la operación administrativa del origen; no representa una transacción nueva del proveedor.
- Supabase Auth y membresía activa de `commerce_admin_users` protegen toda la aplicación. El cliente usa únicamente la clave pública y RLS.
- Archivos privados conservan sus buckets; las descargas usan enlaces de 15 minutos. Las imágenes públicas conservan sus rutas y metadatos de portada.
- La migración `supabase/migrations/20261014020459_gestion_customer_contact.sql` añade historial de contactos con RLS y una función SECURITY INVOKER. Solo administradores vigentes pueden ejecutarla; la actualización de todos los pedidos y su historial es atómica. No borra registros anteriores.
- La migración `supabase/migrations/20261014022235_gestion_customer_profile_read.sql` añade una lectura SECURITY DEFINER acotada a fecha de nacimiento, ciudad y país de perfiles asociados a pedidos. Requiere membresía administrativa activa. No concede lectura general sobre `customer_profiles`.
- La matriz de las Florencias todavía requiere vincular identidades y políticas de servidor cuando se incorporen esas cuentas. No se otorgaron privilegios de administrador como atajo ni se habilitó suplantación local.

## Servicios de pedidos en desarrollo

Para comprobantes y rechazo/reembolso se reutilizan los endpoints autenticados de `paginaweb`, cuyo servidor local debe estar disponible en `http://localhost:3000`. Vite reenvía solo `/commerce-api/api/admin/orders/` a ese servidor; mantiene el token del usuario y usa el origen localhost ya autorizado. No desactiva controles ni envía claves privilegiadas al navegador. Verificado: una llamada sin sesión devuelve 401.

Antes de un despliegue de Gestión se debe definir su dominio y habilitar explícitamente ese origen en el servicio de tienda o un proxy de producción equivalente. No se desplegó nada en esta entrega. El proxy de Vite es solo de desarrollo.

## Verificación

Pruebas unitarias de adaptación, estados, contactos, importes, tarifas, descuentos, selección de transportistas y personalizaciones. Pruebas de navegador con API interceptada: edición de producto/precio, múltiples fotos y portada, contacto compartido, seguimiento, cotizaciones, descuentos, tarifas, revisión bancaria, cuenta de pago, archivos privados, guardado rechazado, navegación de las 42 rutas y móvil.

Se probó además la nueva función de contacto con una sesión administrativa en una transacción real seguida de ROLLBACK: ningún contacto de producción quedó modificado y no quedó historial de prueba. Se verificó que anon no puede ejecutarla y que no omite RLS. Las pruebas de interfaz no envían correos ni pagos/reembolsos reales. La lectura real del catálogo se comprobó en el navegador con la sesión existente.

El asesor de seguridad señala la nueva función de perfiles porque es [SECURITY DEFINER ejecutable por cuentas autenticadas](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable). Es intencional para leer solo cuatro columnas de perfiles con pedidos; dentro de la función se comprueba la membresía administrativa activa, y `anon` no puede ejecutarla. Una llamada sin sesión no devuelve filas. Persisten los avisos previos del personalizador, [tablas privadas sin políticas](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) y [protección de contraseñas filtradas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

## Convivencia de diez días

Commerce Admin permanece operativo. El plazo de observación no se considera cumplido por pasar pruebas automatizadas. Al comenzar el uso operativo de Gestión, comparar por ID los pedidos nuevos, artículos, cantidades, descuentos, cargos, total, pagos, revisión y entrega; registrar discrepancias y hora. Comparar también cambios de productos, fotos, precios, descuentos, tarifas y cotizaciones en ambos paneles.

La retirada del panel viejo exige conciliación satisfactoria y decisión expresa del usuario. No hay eliminación automática al décimo día.

## Otros dashboards

Registro manual del local, inventario, compras, egresos, horas y administrador del visualizador pertenecen a otras migraciones que el usuario elegirá después. Siguen sin datos inventados; no se atribuyen estas funciones a Commerce Admin.
