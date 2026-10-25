# MateArte Gestión

## Consultas desde ChatGPT

Gestión incluye un servidor MCP de consultas con autenticación de propietario y fuentes comerciales paginadas. La implementación y los pasos de conexión están en [MCP de solo lectura](docs/mcp-solo-lectura.md). El usuario confirmó que el complemento funciona en la cuenta Free de prueba. Falta configurar y probar la cuenta de ChatGPT de Richard.

Gestión integra Commerce Admin y LocalVentas en las pantallas existentes. No hay un panel paralelo ni datos ficticios en la aplicación. Las 42 subáreas conservan su navegación y diseño; las fuentes aún no conectadas muestran ausencia de datos.

**Estado operativo (25/10/2026):** Gestión es el único panel administrativo en uso. Las antiguas aplicaciones `dashboard/`, `localventas/` y `commerce-admin/` se retiraron del repositorio; sus proyectos de Vercel estaban pausados y desconectados de Git. Las notas de convivencia y migración más abajo documentan el proceso anterior, no el modo de operación actual.

## Ejecutar

Desde `gestion/`:

```sh
npm install
npm run dev -- --port 5181 --strictPort
npm run build
npm test
npm run test:e2e
```

Abrir http://127.0.0.1:5181/comercial/pedidos. Gestión usa las variables públicas `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` del `.env.local` de la raíz, igual que Commerce Admin. También admite `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY`. Nunca configurar una clave `service_role` en el navegador.

Se ingresa con una cuenta vigente del comercio. Toda la aplicación exige Supabase Auth y membresía activa en `commerce_admin_users`. La sesión de Gestión es independiente de la del panel anterior. Cambiar usuario cierra esta sesión y solicita nuevas credenciales.

## Datos que ya alimentan las pantallas

- Comercial: pedidos web y mayoristas, más todas las ventas históricas de LocalVentas y sus artículos. Registrar venta local escribe mediante la misma función atómica que usa LocalVentas; Richard también puede registrar ventas de Instagram, Facebook o WhatsApp en las mismas tablas, conservando el canal específico.
- Clientes: contactos de pedidos y clientes registrados en LocalVentas, agrupados por cuenta o correo cuando hay coincidencia; ficha con historial compartido, fechas de compra, ubicación y notas del local. Permite crear y editar clientes locales. La columna Canal muestra los canales de sus pedidos. No es todavía la base completa de perfiles web registrados sin compras.
- Productos: catálogo, variantes, SKU, fotografías reales, precio web, categorías y publicación.
- Producción: los mismos pedidos y estados guardados por artículo; agrupa las unidades por modelo, variante, virola y cuero cuando esos atributos existen.
- Entregas: modalidades, transportista, seguimiento y tarifas nacionales/internacionales. El simulador usa el tarifario real.
- Finanzas: transacciones aprobadas, cobros del local, cuentas por cobrar y cotizaciones. El Inicio usa las ventas reales y las cantidades de todos los artículos.
- Administración: canales y medios de pago habilitados en Commerce Admin.

Se consulta el mismo origen cada minuto, con actualización manual. Una venta creada desde Gestión se guarda una sola vez en las tablas que también lee LocalVentas. Se añadió una tabla de auditoría de contactos y una función atómica con RLS; los registros de comercio conservan su origen. Los registros comerciales permanecen en memoria; no se almacenan en el navegador. Al cargar Gestión se eliminan exclusivamente las antiguas claves de datos ficticios y saldo inicial del prototipo. El organigrama suministrado por el usuario se conserva.

Los pedidos creados desde el 14/10/2026 reciben una referencia persistente: `#L001` para Local, `#W001` para Web, `#M001` para Mayorista y `#R001` para Instagram, Facebook y WhatsApp (una secuencia compartida por las redes). Los pedidos anteriores conservan su número visible; `order_number`, `sale_number` y los UUID siguen intactos para no romper las aplicaciones existentes. La referencia nueva aparece en Gestión y en su exportación. LocalVentas y el tablero de producción también la mostrarán cuando se publiquen sus cambios; la web pública y Commerce Admin todavía presentan el número interno.

## Límites actuales

Las operaciones de Commerce Admin ya se ejecutan desde Gestión: catálogo/variantes/precios, galería y encuadre de portada, publicación, categorías y atributos, revisión de comprobantes y diseños, seguimiento, descuentos, tarifas, cotizaciones, ajuste mayorista y configuración de pagos. Clientes permite corregir el contacto con historial de versiones. Ver el [detalle de paridad](docs/migracion-commerce-admin.md).

Las ventas del local reutilizan los precios base del catálogo común, los métodos de pago y `create_local_sale_with_items`. Una seña distingue valor vendido de importe cobrado. Los registros históricos se leen completos, aunque una venta antigua tenga una diferencia entre total y suma de sus artículos; Gestión la muestra sin corregir ni crear un saldo artificial. Ver el [detalle de LocalVentas](docs/migracion-localventas.md).

La migración `20261014035344_local_customer_location_social_channels.sql` añadió ciudad y país a los clientes del local. Completó Paysandú, Uruguay para los nueve clientes con ventas locales recientes y ubicación vacía, sin cambiar los pedidos. Para ventas de redes creó `create_channel_sale_with_items`; la función original de LocalVentas sigue vigente.

Para revisión de comprobantes y rechazo/reembolso en desarrollo, ejecutar también `paginaweb` en localhost:3000: Gestión reutiliza sus servicios autenticados mediante el proxy local `/commerce-api/api/admin/orders/`. En producción, la web admite las llamadas autenticadas desde el origen de Gestión.

Inventario, compras, egresos, horas, personalizador, consultas y automatizaciones no tienen fuente conectada todavía. No se muestra stock cero, gastos cero, rentabilidad ni saldo bancario como si fueran datos confirmados. Las proyecciones no rellenan el historial faltante: requieren al menos seis meses con registros en el último año; los pedidos cancelados, fallidos, reembolsados o pendientes de pago no cuentan como ventas.

El acceso real actual corresponde a las cuentas administradoras existentes del comercio. La matriz de visibilidad de las Florencias se conserva como configuración local, pero todavía no está vinculada a identidades ni políticas de servidor. No habilitar cuentas de empleadas hasta completar esa vinculación; no hay selector local que permita suplantarlas con datos reales.

La base guarda referencias por canal para los pedidos nuevos, sin renumerar el historial; las políticas originales se conservan. Se ajustó la lectura de LocalVentas y del tablero de producción para que las ventas de Instagram, Facebook y WhatsApp no aparezcan como ventas presenciales; no se desplegaron esas aplicaciones. La prueba de convivencia de diez días todavía no comenzó. Ver [inventario de migración](docs/migracion-commerce-admin.md).

## Verificación y estructura

Las pruebas unitarias comprueban adaptación multiartículo, importes en centésimos, clientes compartidos, estados, limpieza del prototipo, navegación y cálculos. Las pruebas de navegador interceptan la API con datos exclusivos de pruebas: no usan credenciales reales ni escriben en producción. Recorren las 42 rutas, acceso, errores, tablas, fichas, desplazamiento horizontal y móvil. Las capturas y diagnósticos se guardan en `artifacts/` y `test-results/`.

- `src/commerceSource.ts`: cliente autenticado y consultas de origen.
- `src/commerceAdapter.ts`: equivalencia entre Commerce Admin, LocalVentas y las entidades de Gestión.
- `src/useCommerce.tsx`: acceso global, carga paginada, actualización y cierre de sesión.
- `src/data.ts`: tipos compartidos y estado inicial vacío.
- `src/pages.tsx`, `src/modules.tsx`, `src/people.tsx`: pantallas existentes.
- `src/CommerceShipping.tsx`: contenido de la ruta existente Entregas → Tarifas.
- `src/commerce/`: editores y acciones trasladados, adaptados al diseño y las rutas actuales.
- `src/testing/`: datos aislados para pruebas; no se importan en la aplicación.

## Publicación

Los cambios se publican subiéndolos a la rama `main` de GitHub: Vercel construye este proyecto desde el repositorio (Root Directory `gestion`). No se publica con `vercel deploy` desde una carpeta local. El build se omite cuando el último commit no toca `gestion/` ni `shared/`.
