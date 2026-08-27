# MateArte Commerce Admin

Panel comercial separado del dashboard operativo anterior. Administra catálogo, variantes/SKU, precios, stock, envíos, pedidos, pagos y revisión de personalizados.

La sesión usa Supabase Auth y cada vista verifica una membresía activa en `commerce_admin_users`. No se confía en `user_metadata`.

## Desarrollo

Copiar `.env.example` a `.env.local`, completar solamente las credenciales públicas de Supabase y la URL del sitio principal, y ejecutar:

```powershell
npm install
npm run dev
```

Los reembolsos y demás operaciones privilegiadas se ejecutan mediante endpoints backend del sitio principal; el navegador nunca recibe una `service_role` ni credenciales de Mercado Pago.
