# Marketing en Gestión

Marketing reúne Campañas, Sorteo, Contactos, Suscripción, Descuentos, Avisos y Métricas. Las rutas anteriores `/comercial/avisos` y `/comercial/descuentos` redirigen a las nuevas. La cuenta de Betiana (`t5`) accede solo a Marketing; Richard puede ajustar las pestañas desde Permisos.

Sorteo muestra un QR vectorial fijo a `https://www.matearteuruguay.com/sorteo`. La vista incluye una hoja A4 para imprimir y permite descargar el SVG del QR. El diseño no usa una API externa para generar el código.

La suscripción de bienvenida aparece en la portada después de un aviso de feria o evento, si lo hay. La persona deja su nombre y correo, recibe un enlace de confirmación y entra a su cuenta. El código `BIENVENIDA10` se muestra en Perfil y se valida en el servidor: exige suscripción activa y confirmada, y ninguna compra web pagada previa. El formulario guarda `utm_source` como origen cuando la visita llega con ese parámetro.

Contactos muestra en una sola tabla la agenda con correo, incluidas las cuentas web, los clientes locales, los participantes de sorteos y los suscriptores. Si el contacto también tiene celular, aparece en su columna. La tabla indica el estado de suscripción; tener correo no autoriza el envío de campañas. Solo los suscriptores activos entran en el segmento de correo.

Las tarjetas de Contactos cuentan los contactos con correo por el valor de Origen. Cada tarjeta filtra la tabla por ese origen; Todos quita el filtro. La búsqueda se aplica dentro del origen seleccionado y la paginación conserva el filtro.

Las campañas guardan asunto, mensaje, imagen y enlace. Se puede enviar una prueba. Antes de enviar a todos, Gestión sincroniza en lotes los suscriptores activos con un segmento de Resend y retira los pendientes o dados de baja. Resend gestiona el enlace de baja de cada difusión. El primer envío puede tardar mientras incorpora los contactos históricos; los siguientes solo preparan los contactos cambiados.

## Configuración para publicar

1. Las migraciones `supabase/migrations/20261020203147_marketing_workspace.sql`, `supabase/migrations/20261020203341_marketing_offer_invoker.sql`, `supabase/migrations/20261020204909_marketing_contact_directory.sql`, `supabase/migrations/20261020205429_marketing_welcome_name_copy.sql` y `supabase/migrations/20261020212315_marketing_contact_origin_counts.sql` ya están aplicadas en Matearte. Las funciones `gestion-users` y `marketing-workspace` también están publicadas.
2. Usar el segmento exclusivo `Matearte Marketing` creado en Resend (ID `3c32ef75-deb8-4871-9067-d82b30ece567`), distinto de `General`, y configurar `RESEND_MARKETING_SEGMENT_ID` tanto en la web como en `marketing-workspace`. El entorno local de la web ya lo tiene. La función toma `RESEND_API_KEY`, `RESEND_NEWSLETTER_TOPIC_ID` y el remitente de sus variables o de la configuración segura ya usada por los otros correos de Matearte. La web también necesita el remitente, la clave, el tema y `NEXT_PUBLIC_SITE_URL`.
3. Si Gestión usa otro dominio, incorporarlo a `GESTION_ALLOWED_ORIGINS` de la función.
4. Publicar Gestión y la web después de la migración. Probar una alta real con un correo propio, confirmar el enlace, comprobar el cupón en Perfil y enviar una campaña de prueba antes de habilitar envíos masivos.

El envío masivo requiere una acción explícita en Campañas; guardar un borrador o activar la suscripción no dispara una difusión.
