# Matearte · Ventas del local

Herramienta interna para registrar ventas presenciales y guardar los datos de clientes del local.

## Ejecutar

```bash
npm install
npm run dev
```

## Datos

Los clientes se guardan en `public.local_sales_customers` de Supabase. El acceso requiere una cuenta activa en `admin_users` o `commerce_admin_users`.

Las ventas y los totales todavía se mantienen únicamente durante la sesión del navegador; la persistencia del historial de ventas corresponde a la siguiente etapa.

## Vercel

Crear un proyecto separado conectado a este repositorio y configurar:

- Root Directory: `localventas`
- Framework Preset: Vite
- Build Command: `npm run build`
- Output Directory: `dist`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

La URL debe apuntar al proyecto Supabase `agdkljuulwjwjasftcce`. La clave debe ser la publishable/anon pública; nunca se debe agregar la service role al frontend.
