# Analítica de recorridos

## Estado de activación

La migración `20261105201523_analytics_journeys.sql` se aplicó al proyecto remoto `agdkljuulwjwjasftcce` el 5 de noviembre de 2026. Se verificaron las seis tablas con RLS y el acceso restringido a las consultas. Las funciones `analytics-admin`, `analytics-collect` y `analytics-archive` están publicadas en Supabase. La vista local de Gestión carga los recorridos vacíos, el resumen de GA4 y el enlace a Clarity. La medición propia de visitantes comienza cuando se despliegan la web y el personalizador. La propiedad de GA4 de la web personal de Enzo no se usa para MateArte.

Se creó la cuenta de GA4 `MateArte Uruguay` bajo `enzothome1@gmail.com`, con la propiedad `MateArte: web y personalizador` (ID `562606811`) y el flujo web `MateArte web y personalizador` (ID `16281399453`, medición `G-6C37JTE0XL`). Se creó el proyecto Clarity `MateArte` (ID `z91u5fn9x0`) y se activó el enmascaramiento estricto. Los identificadores públicos de ambos proveedores están en los `.env` locales de la web y del personalizador, fuera de Git.

La API de datos de GA4 está habilitada en Google Cloud `matearte-analytics`. Se creó la cuenta de servicio `matearte-ga4-reader@matearte-analytics.iam.gserviceaccount.com` sin permisos generales sobre el proyecto y se le concedió el rol Lector solo en la propiedad GA4 de MateArte. La consulta exacta del informe devolvió HTTP 200. Su clave JSON está resguardada fuera del repositorio, en `%LOCALAPPDATA%\MateArte\secrets\ga4-reader.json`, y una copia quedó como secreto `GA4_SERVICE_ACCOUNT_JSON` en Supabase. También están configurados `GA4_PROPERTY_ID` y `CLARITY_PROJECT_URL`. La autorización temporal de Google OAuth Playground para administrar usuarios de Analytics se retiró después de asignar el permiso.

Enzo abrió el perfil de Chrome `enzogaston12` para Vercel y Supabase. Allí se comprobó que el proyecto Supabase `matearte` es `agdkljuulwjwjasftcce` y que Vercel muestra datos de Web Analytics en `matearte-web` y `matearte-personalizador`. En Supabase existen `VERCEL_ANALYTICS_TOKEN`, `VERCEL_TEAM_ID` y `VERCEL_ANALYTICS_SITES`. Los resúmenes SHA256 de los dos últimos coinciden exactamente con el equipo `team_Q5mgDmc9QFiOscny3YmDZK3l` y los proyectos `prj_aSWhysDQelDrnTWGmcHUoTB7fkFV` (web) y `prj_gfTLsfVKOfsFe9t5haSyIlVJn5p3` (personalizador). La función de archivo acepta la clave histórica del trabajo programado mediante una huella SHA256 guardada en `ANALYTICS_ARCHIVE_KEY_SHA256`. Los archivos `.vercel/project.json` locales conservan enlaces antiguos y no deben usarse para esta activación.

El archivo inicial recuperó los días disponibles: 180 registros para 90 días y dos proyectos, con 62 completos y 118 pendientes porque la API de Vercel rechazó con HTTP 400 las fechas anteriores al 5 de octubre de 2026. Los días pendientes no se cuentan como cero. La repetición comprobó que no se duplican filas; las fechas antiguas ya rechazadas no se consultan de nuevo cada mañana. El trabajo `matearte-analytics-vercel-archive` está activo a las 11:00 UTC, las 08:00 de Uruguay, y el trabajo de limpieza también está activo.

## Verificación de publicación

1. Verificar los despliegues de la web, Gestión y el personalizador desde el commit de GitHub. Los identificadores públicos de GA4 y Clarity ya están configurados en los proyectos de Vercel de web y personalizador.
2. Recorrer ambos caminos hasta un carrito con artículo y comprobar el paso entre subdominios, los eventos en la base y GA4 y las cuentas autorizadas de Gestión. Comprobar que «Marketing > Analytics» siga funcionando.
3. Comprobar en una grabación real de Clarity que datos de contacto, carrito, pagos y diseño queden ocultos. El modo estricto ya está activo.
4. Comparar el total de un día archivado con Vercel. La repetición segura del proceso diario ya se verificó.

## Datos y límites

Los eventos individuales y los identificadores de sesión se eliminan después de 90 días. Los resúmenes diarios y los datos archivados de Vercel no vencen. Un día sin consulta válida queda pendiente; un fallo al actualizar un día ya guardado conserva su último valor válido. El desglose de rutas de Vercel puede dejar de estar disponible antes que el total diario. Los visitantes únicos diarios se guardan por día y nunca se suman como visitantes únicos del período.

La vista inicial muestra 90 días completos. Los recorridos propios y GA4 empiezan a contar desde su activación. El consentimiento se solicita antes de cargar los rastreadores en regiones donde se exige o cuando no se puede determinar la región. Los secretos de Vercel y Google residen solo en las funciones del servidor.
