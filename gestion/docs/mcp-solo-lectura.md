# Consultas de Gestión desde ChatGPT

El servidor MCP de Gestión está en `supabase/functions/gestion-mcp/`. Su URL es:

`https://agdkljuulwjwjasftcce.supabase.co/functions/v1/gestion-mcp`

Ofrece herramientas para identificar la cuenta, enumerar fuentes y consultar registros comerciales, clientes, productos, producción, entregas, finanzas y Marketing. Las listas tienen paginación y límites. Los importes cuyo nombre termina en `_minor` están en centésimos. Las páginas de Gestión que todavía no tienen una fuente conectada tampoco tienen datos reales para consultar en el MCP.

Las consultas de catálogo y variantes devuelven `imagen_principal_url`, `image_url` e `images` con la foto pública actual de Gestión, seleccionada por variante y color; `imagenes_catalogo` devuelve `image_url`. Cuando se busca un único producto o variante, la herramienta también adjunta los píxeles de esa foto al resultado. ChatGPT debe usar solo esa imagen al mostrar un producto y no sustituirla por fotos de terceros obtenidas mediante búsqueda web. Este refuerzo se publicó en la versión 5 de `gestion-mcp` el 24/10/2026.

Límite observado: ChatGPT siguió buscando imágenes en la web y mostró fotos de tiendas ajenas aun después de recibir la imagen oficial del MCP. El servidor no controla la búsqueda web de ChatGPT. La ficha pública del SKU 105 responde correctamente, figura en el sitemap y anuncia la foto correcta en `og:image`; el archivo de Supabase Storage responde con `X-Robots-Tag: none`, lo que puede impedir su aparición en buscadores de imágenes. Servir las fotos desde el dominio propio sería una mejora de indexación separada; no garantiza que ChatGPT deje de elegir otras fotos en sus búsquedas.

**Estado (24/10/2026):** la función está publicada en Supabase. Responde `401` sin sesión y anuncia correctamente sus metadatos OAuth. La pantalla de consentimiento está publicada en `https://matearte-gestion.vercel.app/oauth/consent`. Supabase dirige la autorización a `https://www.matearteuruguay.com/oauth/consent`; esa ruta redirige a Gestión conservando `authorization_id`. Se registró un cliente OAuth público y se creó el complemento en la cuenta Free de Enzo Gaston. Una publicación posterior de Gestión había omitido la pantalla de consentimiento; se reincorporó a producción. Supabase Auth también requería incluir el origen de Gestión en **Redirect URLs** para aceptar el consentimiento. Tras ese ajuste, el usuario confirmó que la conexión funciona en ChatGPT Free. Falta configurar y probar la cuenta de ChatGPT de Richard.

## Acceso y alcance

- Cada petición exige un token de Supabase Auth. El servidor comprueba que corresponda a una cuenta activa de Gestión con perfil propietario (`t1`) y consulta con las políticas RLS de esa misma cuenta.
- Las herramientas solo contienen operaciones de lectura; no exponen SQL arbitrario, funciones de escritura ni claves de servicio. La función `marketing-workspace` se invoca únicamente con sus acciones de lectura permitidas.
- Esto describe el alcance del **MCP**. Una sesión OAuth de Supabase conserva los permisos propios de la cuenta fuera del MCP; el consentimiento debe tratarse como acceso a esa cuenta. Revocar la autorización OAuth corta nuevas llamadas.
- Un `401` anónimo debe incluir `WWW-Authenticate` con la URL de metadatos OAuth. La ruta `/oauth-protected-resource` debe responder con la URL de Supabase Auth. El servidor no devuelve datos sin iniciar sesión.

## Conexión con una cuenta compatible

1. El **Site URL** de Supabase dirige la autorización a la tienda. `paginaweb/src/app/oauth/consent/route.ts` redirige a la pantalla de Gestión, conservando `authorization_id`; mantener esta ruta pública y fuera del middleware de idioma. En Supabase Auth → URL Configuration, incluir el origen exacto `https://matearte-gestion.vercel.app` en **Redirect URLs**: Auth valida el encabezado `Origin` de la pantalla de consentimiento contra esa lista. No cambiar el Site URL de Auth para este MCP.
2. En la **cuenta Free de prueba elegida por el usuario**, abrir **Complementos → Añadir → Añadir servidor MCP personalizado**, indicar la URL anterior y elegir OAuth. Abrir **Ajustes avanzados de OAuth** y copiar la **URL de devolución de llamada** que muestre esa cuenta. No utilizar una URL copiada desde otro perfil de Chrome o cuenta de ChatGPT.
3. Registrar en Supabase un cliente OAuth específico para esa cuenta de ChatGPT con la URL de devolución de llamada exacta. Para la prueba Free de Enzo Gaston ya se registró un cliente público con ID `2f985e64-d473-4e8a-9c0a-ce9c767c4af0` y URL de retorno `https://chatgpt.com/connector/oauth/uZ05yJTPcXGG`. El formulario observado permite elegir **Cliente OAuth definido por el usuario** e introducir el ID; este cliente público no tiene secreto. Así no hace falta habilitar el registro dinámico para cualquier aplicación. Mantener `offline_access` entre los ámbitos si el cliente lo solicita para renovar la sesión.
4. Introducir el ID del cliente OAuth en ChatGPT y completar la conexión con una cuenta propietaria de Gestión. Revisar los permisos y aceptar el consentimiento.
5. Probar `quien_soy`, `listar_fuentes`, una consulta de catálogo y una consulta de pedidos. Comprobar que una cuenta sin perfil propietario reciba `403` y que nunca aparezcan herramientas de escritura.
6. Repetir los pasos 2 a 5 en la **cuenta de Richard**, con su propia URL de devolución de llamada y un cliente OAuth separado.

**Disponibilidad observada:** el 24/10/2026 se creó el complemento en la cuenta ChatGPT Free de Enzo Gaston y el usuario confirmó que consulta Gestión correctamente. Esto contradice la conclusión anterior basada en la documentación general de planes de OpenAI. La cuenta Plus de Richard aún no se ha probado; verificar allí la disponibilidad al configurarla.

## Mantenimiento

- Cambiar columnas y fuentes permitidas solo en `supabase/functions/gestion-mcp/index.ts`. No añadir mutaciones, SQL libre ni campos de pagos internos como `raw_payload`.
- Comprobar tipos con `npx deno check --lock supabase/functions/gestion-mcp/deno.lock supabase/functions/gestion-mcp/index.ts` y compilar Gestión con `npm run build` desde `gestion/`.
- La función usa `verify_jwt = false` para que el descubrimiento OAuth anónimo llegue al middleware; `withSupabase({ auth: "user" })` verifica el token antes de cualquier consulta.
- Si cambia la lista o los esquemas de herramientas, actualizar la conexión en ChatGPT y repetir las pruebas de lectura y autorización.

Fuentes: [MCP y OAuth de Supabase](https://supabase.com/docs/guides/ai-tools/byo-mcp), [conexiones MCP en ChatGPT](https://help.openai.com/en/articles/12584461-connecting-custom-mcp-servers-in-chatgpt).
