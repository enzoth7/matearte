# MateArte

Monorepo de la experiencia digital de MateArte. Cada carpeta se despliega como un proyecto independiente de Vercel desde el mismo repositorio.

| Aplicación | Carpeta | URL productiva |
| --- | --- | --- |
| Sitio público | `paginaweb` | <https://matearte.vercel.app> |
| Personalizador | `visualizador` | <https://matearte-visualizador.vercel.app> |
| Administración comercial | `commerce-admin` | <https://matearte-commerce-admin.vercel.app> |
| Operaciones demo | `dashboard` | <https://matearte-dashboard.vercel.app> |

## Demo para cliente

Mientras no exista un dominio propio, las aplicaciones usan sus dominios `*.vercel.app`. El sitio público debe recibir `NEXT_PUBLIC_CUSTOMIZER_URL` con la URL del proyecto del visualizador.

El visualizador permite diseñar como invitado y conserva el borrador localmente. Registrarse, guardar diseños, abrir “Mis diseños” o comprar requiere Supabase Auth. No existen usuarios ficticios ni recuperación automática ante errores de autenticación.

El comercio nuevo vive en `commerce-admin`; el dashboard anterior continúa únicamente como demo operativa y no autoriza acciones comerciales.

## Despliegue en Vercel

Importar este repositorio cuatro veces y configurar un Root Directory diferente en cada proyecto:

1. `paginaweb`
2. `visualizador`
3. `commerce-admin`
4. `dashboard`

Los comandos y directorios de salida se detectan desde los `package.json` de cada aplicación. Antes de publicar, ejecutar las verificaciones documentadas en el README de cada carpeta.

Las variables de entorno, URLs de Auth, migraciones, feature flags y orden seguro de activación están documentados en [COMMERCE_RUNBOOK.md](COMMERCE_RUNBOOK.md).

## Estado comercial

La infraestructura de cuentas, biblioteca de diseños, carrito, catálogo, pedidos y Checkout Pro está implementada. El comercio permanece apagado hasta cargar variantes publicables, credenciales backend y completar la matriz sandbox de Mercado Pago. La redirección del navegador nunca confirma un pago: solamente lo hace un webhook válido y verificado.
