# MateArte Operaciones

Panel interno de clientes, pedidos y producción desplegado en <https://matearte-dashboard.vercel.app>.

## Funciones

- Resumen de unidades, estados y valor de producción.
- Alta de clientes y edición de sus datos.
- Alta de pedidos con varios artículos bajo un único identificador.
- Edición, finalización y eliminación de líneas de producción.
- Histórico de trabajos completados.
- Catálogo operativo y conversión de precios ARG → UYU.
- Exportación de producción a Excel/CSV y PDF agrupado por cliente.
- Actualización automática al volver a la pestaña y cada ocho segundos.

## Persistencia real

En producción, `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` están configuradas. La aplicación lee y escribe directamente en las tablas `settings`, `products`, `customers` y `order_lines` de Supabase; por eso los cambios se comparten entre navegadores y personas.

`localStorage` se usa para conservar la sesión visual del login, no como almacenamiento productivo de pedidos.

El código mantiene dos modos auxiliares:

- `VITE_DASHBOARD_DATA_MODE=demo`: datos de prueba persistidos localmente en el navegador.
- `VITE_DASHBOARD_DATA_MODE=api`: llamadas al servidor Express de `server.mjs`.

Si Supabase está configurado y no se fuerza uno de esos modos, se usa Supabase directamente.

## Acceso y seguridad

El login actual es una validación fija implementada en `src/store/useAuth.ts`. No usa Supabase Auth y, por sí solo, no protege la base de datos. Es adecuado únicamente como acceso operativo transitorio; antes de ampliar usuarios o permisos debe reemplazarse por autenticación y autorización reales.

## Desarrollo local

Requisitos: Node.js 20 o superior y pnpm.

```bash
pnpm install
pnpm dev
```

La aplicación queda disponible en `http://localhost:5175`.

Variables para usar Supabase directamente:

```dotenv
VITE_SUPABASE_URL=https://PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

## Verificación

```bash
pnpm test
pnpm build
```

`data/setup.sql` es una carga inicial histórica y destructiva: elimina y vuelve a insertar datos de las tablas operativas. No debe ejecutarse sobre producción como una migración cotidiana.
