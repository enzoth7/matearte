# MateArte Uruguay

Sitio público, catálogo y comercio de MateArte, construido con Next.js, TypeScript, Tailwind CSS y Supabase. Producción: <https://www.matearteuruguay.com>.

## Funciones

- Portada editorial y contenido en español, inglés y portugués.
- Catálogo comercial conectado con los productos publicados desde `commerce-admin`.
- Fichas de producto con imágenes, variantes y precios en UYU.
- Registro, login con Google, perfil y consulta de pedidos mediante Supabase Auth.
- Carrito combinado de productos estándar y diseños personalizados.
- Checkout nacional con retiro o envío y Mercado Pago.
- Pedidos internacionales registrados para coordinación por WhatsApp.
- Recepción segura de diseños desde el visualizador mediante códigos de un solo uso.
- API para conservar originales subidos por invitados al autenticarse.

No se realiza control de stock en los productos o variantes.

## Rutas principales

- `/` — portada.
- `/catalogo` y `/producto/[slug]` — catálogo y fichas comerciales.
- `/personalizados` — presentación y acceso al visualizador.
- `/clientes`, `/nosotros` y `/contacto` — contenido institucional.
- `/carrito` y `/checkout` — compra nacional o internacional.
- `/perfil` y `/perfil/editar` — cuenta, pedidos y datos del cliente.
- `/pedidos/[id]` — estado y detalle de un pedido.
- `/compras/*` — términos, privacidad, condiciones y envíos.

Las rutas públicas se localizan con `next-intl`. El español se sirve sin prefijo; inglés usa `/en` y portugués `/pt`.

## Comercio y pedidos personalizados

El catálogo se obtiene desde Supabase en cada visita. Los productos editoriales funcionan como respaldo cuando no existe una ficha comercial publicada con el mismo slug.

El backend recalcula productos, diseños y envío; no confía en importes enviados por el navegador. Para pagos nacionales crea el pedido y luego la preferencia de Mercado Pago. El webhook firmado es la única fuente que confirma el pago.

Los pedidos internacionales se crean con estado de revisión manual y abren WhatsApp con número de pedido, destino, artículos y subtotal. No generan una preferencia de Mercado Pago.

Los pedidos personalizados guardan un snapshot inmutable con las vistas PNG y los originales activos utilizados al comprar. `commerce-admin` crea enlaces firmados temporales para consultarlos o descargarlos.

La disponibilidad comercial depende de `NEXT_PUBLIC_COMMERCE_ENABLED`, `NEXT_PUBLIC_COMMERCE_PROVIDER` y los controles de `commerce_settings` en Supabase.

## Variables de entorno

Partir de `.env.example`. Las principales variables públicas son:

- `NEXT_PUBLIC_SITE_URL`: URL canónica; en producción, `https://www.matearteuruguay.com`.
- `NEXT_PUBLIC_CUSTOMIZER_URL`: URL del visualizador.
- `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: cliente público de Supabase.
- `NEXT_PUBLIC_COMMERCE_ENABLED` y `NEXT_PUBLIC_COMMERCE_PROVIDER`: disponibilidad del comercio.
- `NEXT_PUBLIC_PRESENTATION_MODE` y `NEXT_PUBLIC_ENABLE_RESTRICTED_MEDIA`: material editorial sujeto a aprobación.
- `GOOGLE_SITE_VERIFICATION` y `BING_SITE_VERIFICATION`: verificaciones de buscadores.

Variables exclusivas del backend:

- `SUPABASE_SERVICE_ROLE_KEY`.
- `MERCADO_PAGO_ACCESS_TOKEN`.
- `MERCADO_PAGO_WEBHOOK_SECRET`.
- `MERCADO_PAGO_ENV`.
- `COMMERCE_ADMIN_URL`.
- `CRON_SECRET`.
- `MATEARTE_WHATSAPP_NUMBER`.

Nunca exponer secretos mediante variables `NEXT_PUBLIC_`.

## Desarrollo local

Requisitos: Node.js 20 o superior y npm.

```bash
npm install
copy .env.example .env.local
npm run dev
```

La web queda disponible en `http://localhost:3000`.

## Verificación

```bash
npm run lint
npm run typecheck
npm test
npx playwright install chromium
npm run test:e2e
npm run build
```

## SEO, recursos y derechos

El proyecto genera metadatos, canonical, `hreflang`, sitemap, robots y manifest. Carrito, checkout, perfil, pedidos y políticas comerciales mantienen sus propias reglas de indexación.

Los recursos editoriales están en `public/assets/matearte`. Su procedencia y restricciones se documentan en `public/assets/matearte/README.md`. Las imágenes de personas, publicaciones sociales, escudos, marcas de terceros y recursos de Uruguay Natural deben contar con autorización antes de su uso público.
