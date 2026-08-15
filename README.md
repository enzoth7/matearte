# MateArte

Monorepo de la experiencia digital de MateArte. Cada carpeta se despliega como un proyecto independiente de Vercel desde el mismo repositorio.

| Aplicación | Carpeta | URL temporal |
| --- | --- | --- |
| Sitio público | `paginaweb` | <https://matearte.vercel.app> |
| Personalizador | `visualizador` | <https://matearte-visualizador.vercel.app> |
| Operaciones demo | `dashboard` | <https://matearte-dashboard.vercel.app> |

## Demo para cliente

Mientras no exista un dominio propio, las aplicaciones usan sus dominios `*.vercel.app`. El sitio público debe recibir `NEXT_PUBLIC_CUSTOMIZER_URL` con la URL del proyecto del visualizador.

El visualizador entra automáticamente en modo invitado cuando no se configuran las variables públicas de Supabase. El dashboard funciona por defecto en modo demo y persiste los cambios en `localStorage`. Cada navegador mantiene su propia copia; no existe sincronización entre personas. Para volver a usar el servidor Express local, definir `VITE_DASHBOARD_DATA_MODE=api`.

## Despliegue en Vercel

Importar este repositorio tres veces y configurar un Root Directory diferente en cada proyecto:

1. `paginaweb`
2. `visualizador`
3. `dashboard`

Los comandos y directorios de salida se detectan desde los `package.json` de cada aplicación. Antes de publicar, ejecutar las verificaciones documentadas en el README de cada carpeta.

El `vercel.json` de la raíz mantiene compatible el proyecto `matearte-visualizador`: como su integración de GitHub apunta a la raíz del repositorio, instala y construye `visualizador` y publica `visualizador/dist`.

## Etapa productiva posterior

El dashboard demo no debe utilizarse como base compartida de operaciones. La siguiente etapa es migrar clientes, pedidos, productos y producción a Supabase con autenticación y RLS antes de habilitarlo para uso interno real.
