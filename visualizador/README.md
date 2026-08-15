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

- `VITE_MERCADO_PAGO_COMMISSION_PERCENT`: porcentaje usado únicamente para calcular la comisión visible en el mock de Mercado Pago. Su valor predeterminado es `0`.

## Alcance del checkout

La pantalla de pago es un mockup. Cambiar su estado no crea preferencias de Mercado Pago, no procesa transferencias, no genera comprobantes, no llama webhooks y no envía el pedido a producción. La continuación visual se habilita solamente cuando el estado simulado es `confirmado`.

Los tamaños, precios específicos por tamaño y combinaciones que aún no fueron informados permanecen señalados como datos pendientes; el catálogo no inventa esas variantes.
