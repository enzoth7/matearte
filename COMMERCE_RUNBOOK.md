# Puesta en producción de cuentas y comercio

## Arquitectura

- Supabase único: `agdkljuulwjwjasftcce`.
- Registro, login, Google OAuth, recuperación y biblioteca de diseños: `visualizador`.
- Catálogo, carrito, checkout, sesión SSR, pedidos y webhook: `paginaweb`.
- Catálogo, stock, zonas, revisión de personalizados y reembolsos: `commerce-admin`.
- El traspaso entre dominios usa un código opaco de un solo uso, expira en cinco minutos y nunca coloca tokens de Supabase en la URL.

## Configuración obligatoria

En los tres proyectos se usan únicamente la URL de Supabase y la publishable key públicas. La `service_role` nunca puede estar en una variable `VITE_` o `NEXT_PUBLIC_`.

En `paginaweb` configurar exclusivamente como secretos de backend:

- `SUPABASE_SERVICE_ROLE_KEY`
- `MERCADO_PAGO_ACCESS_TOKEN`
- `MERCADO_PAGO_WEBHOOK_SECRET`
- `MERCADO_PAGO_ENV=sandbox` durante las pruebas
- `MATEARTE_WHATSAPP_NUMBER`, en formato internacional sólo con dígitos, para coordinar compras del exterior

Los ejemplos completos, sin credenciales reales, están en `paginaweb/.env.example`, `visualizador/.env.example` y `commerce-admin/.env.example`.

## Supabase Auth

Configurar el sitio y redirects permitidos para producción y desarrollo:

- `https://matearte-visualizador.vercel.app`
- `https://matearte-visualizador.vercel.app/**`
- `http://localhost:5173/**`
- `https://matearte.vercel.app/auth/handoff`

Habilitar confirmación por correo, SMTP propio, Google OAuth y protección contra contraseñas filtradas. El proveedor Google debe regresar al callback de Supabase indicado por el dashboard del proyecto.

## Datos y seguridad

Las migraciones de `supabase/migrations` crean perfiles, diseños, assets privados, handoffs, catálogo, variantes, envíos, carritos, pedidos, reservas, pagos y membresías administrativas. Todas las tablas de clientes tienen grants explícitos y RLS por propietario. Los buckets `design-assets`, `design-previews` y `order-assets` son privados y usan rutas `user_id/design_id/...`.

La autorización del panel comercial depende de `commerce_admin_users`; nunca de `user_metadata`.

## Orden de activación

1. Completar SMTP, Google OAuth y redirects de Auth.
2. Configurar los tres secretos backend en Vercel.
3. Crear variantes con SKU, precio UYU, peso, modalidad y stock cuando corresponda.
4. Configurar retiro y tarifas por departamento.
5. Publicar únicamente productos y variantes completos.
6. Mantener `commerce_settings.commerce_enabled=false` y `NEXT_PUBLIC_COMMERCE_ENABLED=false` durante la matriz sandbox.
7. Probar aprobado, pendiente, rechazado, vencido, firma inválida, duplicado, evento fuera de orden y reembolso.
8. Validar por escrito la comisión separada de Mercado Pago antes de habilitarla.
9. Cambiar credenciales a producción y recién entonces habilitar ambos feature flags.

## Garantías del checkout

- `POST /api/checkout` ignora precios enviados por el navegador y recalcula productos, diseños, envío y comisión en backend.
- El pedido `pending_payment` y las reservas de stock se crean atómicamente antes de la preferencia.
- Las reservas vencen a los 30 minutos y se liberan al ejecutar el proceso de expiración o al iniciar un nuevo checkout.
- `POST /api/webhooks/mercado-pago` valida `x-signature`, consulta el pago a Mercado Pago y procesa el evento de manera idempotente.
- Un personalizado aprobado queda en `paid_pending_review`; solamente el panel administrativo puede aprobar producción o rechazar y reembolsar.
- Las compras con destino fuera de Uruguay no crean una preferencia de Mercado Pago. Generan un pedido `manual_review` con artículos inmutables, subtotal sin envío y un mensaje de WhatsApp preparado por el backend para coordinar envío y pago.
- Las solicitudes internacionales no reservan stock hasta que el equipo confirme manualmente disponibilidad, envío y forma de pago.

## Estado de la matriz sandbox

Validado el 2026-08-25 (America/Montevideo):

- Cuenta vendedora y cuenta compradora de prueba separadas.
- Checkout Pro aprobado por 100 UYU.
- Webhook productivo de la aplicación sandbox configurado únicamente para pagos.
- Firma válida, pago acreditado y pedido movido a `ready_for_fulfillment`.
- Reserva de stock movida de `active` a `committed`.
- Repetición del mismo evento con respuesta `200 OK` sin duplicar pagos ni eventos.
- `commerce_enabled=false` y `mercado_pago_enabled=false` después de la prueba.

Siguen pendientes los casos: pago pendiente, rechazado, vencido, firma inválida, evento fuera de orden y reembolso.

## Verificación local

```powershell
cd paginaweb
npm run lint
npm run typecheck
npx vitest run --pool=threads --maxWorkers=1
npm run build

cd ..\visualizador
npm test
npm run build

cd ..\commerce-admin
npm run build
```

En Windows se limita Vitest del sitio a un worker para evitar que procesos concurrentes de `jsdom` queden esperando al cerrar.
