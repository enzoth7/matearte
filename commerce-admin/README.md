# MateArte Commerce Admin

Panel comercial de MateArte desplegado en <https://matearte-commerce-admin.vercel.app>.

## Funciones

- Alta y edición del catálogo comercial.
- Variantes activas, SKU y precios en UYU.
- Imágenes de producto y orden de galería.
- Publicación de productos en el sitio principal.
- Pedidos, pagos y estados comerciales.
- Revisión de pedidos personalizados.
- Vista y descarga de PNG finales por artículo: mate, virola y lados del fleje.
- Vista y descarga independiente de los archivos originales aportados por el cliente.
- Zonas, tarifas, cotizaciones y controles de activación del comercio.

Los productos publicados alimentan `/catalogo` y `/producto/[slug]` en la web principal. Una ficha necesita al menos una variante activa con SKU y precio válido para poder venderse.

## Acceso

La sesión usa Supabase Auth. Después del login, el panel exige una membresía activa en `commerce_admin_users`; no confía en `user_metadata`.

El alias local predeterminado `user` se resuelve como `user@matearte.uy`. La contraseña existe solamente en Supabase Auth y no puede leerse desde el repositorio o Vercel. Para crear o rotar la cuenta de prueba:

```powershell
$env:SUPABASE_URL = '...'
$env:SUPABASE_SERVICE_ROLE_KEY = '...'
$env:COMMERCE_TEST_ADMIN_PASSWORD = '...'
npm run provision:test-admin
```

Para propietarios reales conviene crear una cuenta individual en Supabase Auth y agregar su `user_id` activo a `commerce_admin_users`, en lugar de compartir una contraseña.

## Configuración

En desarrollo, Vite lee variables desde la raíz del monorepo. También acepta los nombres `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` usados por `paginaweb`.

```dotenv
VITE_SUPABASE_URL=https://PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
VITE_STORE_API_URL=http://localhost:3000
```

`VITE_STORE_API_URL` apunta al backend del sitio principal; en producción debe ser `https://www.matearteuruguay.com`.

Los archivos de catálogo usan `product-images`. Las vistas y originales personalizados se leen mediante enlaces firmados desde los buckets privados `design-previews`, `design-assets` y, para compatibilidad, `order-assets`.

Las operaciones privilegiadas, como revisar un personalizado y ejecutar un reembolso, pasan por endpoints del sitio principal. El navegador nunca recibe una `service_role` ni credenciales de Mercado Pago.

## Desarrollo y verificación

```bash
npm install
npm run dev
npm test
npm run build
```

El servidor local usa `http://localhost:5174`.
