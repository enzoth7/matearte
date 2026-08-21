# Matearte — configurador de mates

Configurador web de Matearte construido con React, TypeScript y Vite. Permite elegir el producto, tamaño y color, personalizar virola y fleje, guardar diseños y revisar un checkout visual antes de producción.

## Desarrollo local

```bash
npm install
npm run dev
```

Verificaciones disponibles:

```bash
npm test
npm run lint
npm run build
```

## Configuración

Copiá `.env.example` como `.env.local` si necesitás modificar opciones locales.

- `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY`: conexión pública de Supabase. Sin un catálogo publicado válido el visualizador muestra “Precio no disponible” y bloquea el checkout.
- `VITE_PRICING_ADMIN_USERNAME` y `VITE_PRICING_ADMIN_EMAIL`: alias visible e identidad interna del administrador de `/dashboard`. La contraseña vive únicamente en Supabase Auth.

Para provisionar o rotar la cuenta administrativa sin escribir la contraseña en el código:

```bash
SUPABASE_URL=... SUPABASE_SECRET_KEY=... MATEARTE_ADMIN_PASSWORD=... npm run pricing:provision-admin
```

`SUPABASE_SECRET_KEY` y `MATEARTE_ADMIN_PASSWORD` son variables exclusivas del entorno local/CI y nunca deben usar el prefijo `VITE_`.

## Alcance del checkout

La pantalla de pago es un mockup. Cambiar su estado no crea preferencias de Mercado Pago, no procesa transferencias, no genera comprobantes, no llama webhooks y no envía el pedido a producción. La continuación visual se habilita solamente cuando el estado simulado es `confirmado`.

Los tamaños, precios específicos por tamaño y combinaciones que aún no fueron informados permanecen señalados como datos pendientes; el catálogo no inventa esas variantes.
