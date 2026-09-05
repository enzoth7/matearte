# MateArte Visualizador

Personalizador de mates construido con React, TypeScript, Vite y Three.js. Está desplegado en <https://matearte-visualizador.vercel.app>.

## Flujo actual

1. El cliente elige modelo, tamaño, color y terminaciones.
2. Personaliza virola y fleje con textos, íconos del catálogo o imágenes propias.
3. El precio se calcula con el catálogo de precios publicado en Supabase.
4. El diseño puede guardarse y retomarse desde “Mis diseños”.
5. Antes de abrir el carrito se sincronizan los originales, se generan las vistas finales y se registra el diseño.
6. Un código de sesión de un solo uso conecta al cliente con `https://www.matearteuruguay.com/carrito`.

Si falla la carga, captura o persistencia, el diseño no entra al carrito y la interfaz permite reintentar.

## Diseños y archivos

Los borradores de invitados se conservan en IndexedDB hasta que la persona inicia sesión. Los diseños autenticados se guardan en Supabase.

Los archivos PNG, JPEG o SVG aportados por el cliente se almacenan sin transformación en el bucket privado `design-assets`. La configuración guarda una referencia permanente `storage:` separada de la URL firmada temporal usada para mostrarlos.

Antes de continuar al carrito se generan PNG versionados en `design-previews`:

- Mate completo: 1200 × 1200.
- Virola: 1200 × 1200.
- Fleje frente: 1800 × 600.
- Fleje reverso: 1800 × 600.

Los modelos sin fleje generan solamente mate y virola. Cada archivo debe ser válido y no superar 5 MB. Las rutas versionadas evitan sobrescribir imágenes ya utilizadas por pedidos.

## Cuentas y panel de precios

Registro, login, recuperación y biblioteca de diseños usan Supabase Auth. Las acciones que guardan o compran exigen una cuenta y, cuando corresponde, un perfil completo.

`/dashboard` dentro del visualizador es el panel de precios del personalizador. Usa Supabase Auth y exige una membresía en `admin_users`. No es el mismo sistema que `matearte-dashboard.vercel.app`, que administra operaciones y producción.

Para provisionar o rotar el administrador de precios:

```bash
SUPABASE_URL=... SUPABASE_SECRET_KEY=... MATEARTE_ADMIN_PASSWORD=... npm run pricing:provision-admin
```

`SUPABASE_SECRET_KEY` y `MATEARTE_ADMIN_PASSWORD` son secretos locales o de CI; nunca deben usar el prefijo `VITE_`.

## Configuración

```dotenv
VITE_SUPABASE_URL=https://PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
VITE_MAIN_SITE_URL=http://localhost:3000
VITE_PRICING_ADMIN_USERNAME=user
VITE_PRICING_ADMIN_EMAIL=pricing-admin@matearte.uy
```

En producción, `VITE_MAIN_SITE_URL` debe ser `https://www.matearteuruguay.com`.

## Desarrollo y verificación

```bash
npm install
npm run dev
npm run lint
npm test
npm run build
```

El servidor local usa `http://localhost:5173`.
