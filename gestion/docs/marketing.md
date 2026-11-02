# Marketing en Gestión

Marketing reúne Campañas, Sorteo, Contactos, Suscripción, Descuentos, Avisos y Métricas. Las rutas anteriores `/comercial/avisos` y `/comercial/descuentos` redirigen a las nuevas. La cuenta de Betiana (`t5`) accede solo a Marketing; Richard puede ajustar las pestañas desde Permisos.

Sorteo muestra un QR vectorial fijo a `https://www.matearteuruguay.com/sorteo`. La vista incluye una hoja A4 para imprimir y permite descargar el SVG del QR. El diseño no usa una API externa para generar el código.

La suscripción de bienvenida aparece en la portada después de un aviso de feria o evento, si lo hay. La persona deja su nombre y correo, recibe un enlace de confirmación y entra a su cuenta. El código `BIENVENIDA10` se muestra en Perfil y se valida en el servidor: exige suscripción activa y confirmada, y ninguna compra web pagada previa. El formulario guarda `utm_source` como origen cuando la visita llega con ese parámetro.

Contactos muestra en una sola tabla la agenda con correo, incluidas las cuentas web, los clientes locales, los participantes de sorteos y los suscriptores. Si el contacto también tiene celular, aparece en su columna. La tabla indica el estado de suscripción. Todas las personas con correo en la base autorizaron recibir campañas: solo quedan afuera quienes se dieron de baja, y Resend suprime por su cuenta los rebotes.

Las tarjetas de Contactos cuentan los contactos con correo por el valor de Origen. Cada tarjeta filtra la tabla por ese origen; Todos quita el filtro. La búsqueda se aplica dentro del origen seleccionado y la paginación conserva el filtro.

Las campañas guardan asunto, título, mensaje, imagen, enlace y, si se elige, un descuento. Se puede enviar una prueba. La audiencia es Todos (toda persona con correo que no se dio de baja), un segmento guardado o personas elegidas a mano. Antes de enviar, Gestión prepara a los destinatarios en un grupo de Resend propio de la campaña, descartando bajas y rebotes. Resend gestiona el enlace de baja de cada difusión. Cuando la campaña termina, su grupo se libera al preparar la siguiente, porque el plan gratis de Resend permite pocos grupos.

Segmentos ordena la base por origen, país, canal de la última compra, si compró o no, cantidad de compras, fecha de la última compra y cuenta en la web, con el conteo en vivo. Un segmento nunca incluye a quienes se dieron de baja.

Bajas: el pie de cada campaña tiene el enlace "Cancelar suscripción" y Resend registra a quien lo toca. Al abrir Segmentos o Campañas, Gestión copia esas bajas a la tabla `marketing_unsubscribes` (acción `syncUnsubscribes`), muestra un aviso con las bajas nuevas y la lista de quiénes son, y la vista `marketing_contact_directory` las marca como "Baja" para cualquier correo de la base, no solo para quienes usaron el formulario de suscripción. Leads, Segmentos y Campañas las dejan afuera. Las bajas que aparecen al preparar un envío también se registran. La fecha es la de detección (Resend no informa cuándo se dio la baja) y una baja registrada no se borra sola: para volver a incluir a alguien hay que eliminar su fila de `marketing_unsubscribes`.

El plan gratis de Resend permite 100 correos por día entre campañas y correos de pedidos. Por eso una campaña a un segmento, o a Todos si supera el tamaño de la tanda, se divide en tandas: borradores con el mismo contenido y personas distintas, ordenadas desde quienes compraron hace menos tiempo. Se envía una tanda por día. Editar el texto, la imagen, el enlace o el descuento de una tanda lo aplica a las demás tandas pendientes. Campañas muestra cuántos correos de campañas salieron hoy y avisa antes de pasar el límite.

Los enlaces a matearteuruguay.com llevan `utm_source=email`, `utm_medium=campaign` y `utm_campaign` con el asunto y la fecha de creación. El código de descuento elegido aparece destacado en el correo (modo mensaje).

## Configuración para publicar

1. Las migraciones `supabase/migrations/20261020203147_marketing_workspace.sql`, `supabase/migrations/20261020203341_marketing_offer_invoker.sql`, `supabase/migrations/20261020204909_marketing_contact_directory.sql`, `supabase/migrations/20261020205429_marketing_welcome_name_copy.sql` y `supabase/migrations/20261020212315_marketing_contact_origin_counts.sql` ya están aplicadas en Matearte, igual que las de campañas con audiencia e historial, segmentos y tandas (`20261102184740` a `20261102213000`). La función `marketing-workspace` se publica aparte y trae sus archivos de `shared/`. `gestion-users` conserva su última versión publicada.
2. Usar el segmento exclusivo `Matearte Marketing` creado en Resend (ID `3c32ef75-deb8-4871-9067-d82b30ece567`), distinto de `General`, y configurar `RESEND_MARKETING_SEGMENT_ID` tanto en la web como en `marketing-workspace`. El entorno local de la web ya lo tiene. La función toma `RESEND_API_KEY`, `RESEND_NEWSLETTER_TOPIC_ID` y el remitente de sus variables o de la configuración segura ya usada por los otros correos de Matearte. La web también necesita el remitente, la clave, el tema y `NEXT_PUBLIC_SITE_URL`.
3. Si Gestión usa otro dominio, incorporarlo a `GESTION_ALLOWED_ORIGINS` de la función.
4. Publicar Gestión y la web después de la migración. Probar una alta real con un correo propio, confirmar el enlace, comprobar el cupón en Perfil y enviar una campaña de prueba antes de habilitar envíos masivos.

El envío masivo requiere una acción explícita en Campañas; guardar un borrador o activar la suscripción no dispara una difusión.
