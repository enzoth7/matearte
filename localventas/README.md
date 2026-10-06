# Matearte · Ventas del local

Herramienta interna para registrar ventas presenciales y guardar los datos de clientes del local.

## Ejecutar

```bash
npm install
npm run dev
```

## Datos

Los clientes se guardan en `public.local_sales_customers`. Las ventas se guardan en `public.local_sales` y sus productos en `public.local_sale_items`.

El registro se realiza de forma atómica mediante `public.create_local_sale`, y el acceso requiere una cuenta activa en `admin_users` o `commerce_admin_users`.

## Vercel

Crear un proyecto separado conectado a este repositorio y configurar:

- Root Directory: `localventas`
- Framework Preset: Vite
- Build Command: `npm run build`
- Output Directory: `dist`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

La URL debe apuntar al proyecto Supabase `agdkljuulwjwjasftcce`. La clave debe ser la publishable/anon pública; nunca se debe agregar la service role al frontend.
