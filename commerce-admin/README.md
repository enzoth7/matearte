# MateArte Commerce Admin

Panel comercial separado del dashboard operativo anterior. Administra catálogo, variantes/SKU, precios, envíos, pedidos, pagos y revisión de personalizados.

Los productos marcados como publicados alimentan directamente `/catalogo` y `/producto/[slug]` del sitio principal. Para que una ficha quede completa, cargar una imagen y al menos una variante activa con SKU y precio en UYU antes de publicarla. Los cambios se ven al recargar el sitio.

La sesión usa Supabase Auth y cada vista verifica una membresía activa en `commerce_admin_users`. No se confía en `user_metadata`.

Para pruebas locales, el identificador `user` se resuelve como `user@matearte.uy`. La contraseña se crea en Supabase Auth, no en el código. Para provisionarla o rotarla:

```powershell
$env:SUPABASE_URL = '...'; $env:SUPABASE_SERVICE_ROLE_KEY = '...'; $env:COMMERCE_TEST_ADMIN_PASSWORD = '...'; npm run provision:test-admin
```

## Desarrollo

El panel reutiliza automáticamente las credenciales públicas del `.env.local` ubicado en la raíz de MateArte. También admite las variables `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` en ese mismo archivo. Después, ejecutar:

```powershell
npm install
npm run dev
```

Los reembolsos y demás operaciones privilegiadas se ejecutan mediante endpoints backend del sitio principal; el navegador nunca recibe una `service_role` ni credenciales de Mercado Pago.
