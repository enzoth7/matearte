# MateArte

Monorepo de la plataforma digital de MateArte. Las cuatro aplicaciones comparten un proyecto de Supabase y se despliegan como proyectos independientes de Vercel.

| Aplicación | Carpeta | URL productiva |
| --- | --- | --- |
| Sitio, catálogo y checkout | `paginaweb` | <https://www.matearteuruguay.com> |
| Personalizador | `visualizador` | <https://matearte-visualizador.vercel.app> |
| Administración comercial | `commerce-admin` | <https://matearte-commerce-admin.vercel.app> |
| Operaciones y producción | `dashboard` | <https://matearte-dashboard.vercel.app> |

## Arquitectura actual

- `paginaweb`: sitio público multilingüe, catálogo, cuentas de clientes, carrito, checkout nacional con Mercado Pago, pedidos internacionales por WhatsApp y consulta de pedidos.
- `visualizador`: creación de mates personalizados, biblioteca “Mis diseños”, precios publicados, carga de imágenes, generación de vistas finales y traspaso autenticado al carrito.
- `commerce-admin`: catálogo comercial, variantes, precios, imágenes, envíos, pedidos, pagos y revisión de personalizados con descarga de vistas y originales.
- `dashboard`: gestión operativa de clientes, pedidos internos, producción, histórico, productos y cotización. En producción lee y escribe datos compartidos en Supabase.

No confundir los paneles:

- `matearte-dashboard.vercel.app` administra operaciones y producción.
- `matearte-visualizador.vercel.app/dashboard` administra el catálogo de precios del personalizador.
- `matearte-commerce-admin.vercel.app` administra el comercio de la web pública.

## Datos y autenticación

Supabase centraliza cuentas, perfiles, diseños, archivos privados, catálogo, carritos, pedidos, pagos y datos operativos. Las migraciones versionadas están en `supabase/migrations`.

El sitio, el visualizador y `commerce-admin` usan Supabase Auth. El traspaso de sesión entre dominios usa códigos opacos de un solo uso; no coloca tokens en la URL.

El dashboard de operaciones conserva actualmente un acceso fijo en el frontend y guarda solamente la sesión en `localStorage`. Sus datos productivos sí se persisten en Supabase. Ese acceso es una barrera básica y debe migrarse a Supabase Auth antes de considerarlo un panel de seguridad fuerte.

## Diseños personalizados

Los originales aportados por clientes se guardan sin transformación en el bucket privado `design-assets`. Las vistas finales se generan como PNG versionados en `design-previews`: mate, virola y, cuando corresponde, frente y reverso del fleje. Los pedidos guardan referencias inmutables para que una edición posterior del borrador no cambie lo comprado.

## Comercio

El catálogo y los checkout están implementados. La disponibilidad efectiva depende de las variables públicas de cada despliegue y de `commerce_settings` en Supabase. El backend recalcula precios y envío, crea el pedido antes de abrir Mercado Pago y confirma pagos únicamente mediante un webhook validado. Los pedidos internacionales se registran sin preferencia de pago y continúan por WhatsApp.

No existe control de stock en el flujo comercial actual.

## Desarrollo y despliegue

Cada carpeta tiene su propio `package.json`, variables y comandos. Consultá su README antes de trabajar en una aplicación.

En Vercel, el mismo repositorio se importa cuatro veces con estos Root Directory:

1. `paginaweb`
2. `visualizador`
3. `commerce-admin`
4. `dashboard`

La configuración de Supabase, Mercado Pago, correo y activación comercial está documentada en [COMMERCE_RUNBOOK.md](COMMERCE_RUNBOOK.md). Nunca deben exponerse `service_role`, secretos de webhooks ni credenciales de Mercado Pago mediante variables `VITE_` o `NEXT_PUBLIC_`.
