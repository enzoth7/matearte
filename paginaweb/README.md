# MateArte Uruguay — sitio editorial y catálogo

Sitio web independiente de MateArte Uruguay, construido con Next.js, TypeScript y Tailwind CSS. Presenta la historia, el oficio y un catálogo conectado con los productos publicados desde `commerce-admin` mediante Supabase.

## Ejecutar localmente

Requisitos: Node.js 20 o superior y npm.

```bash
npm install
copy .env.example .env.local
npm run dev
```

Abrí `http://localhost:3000`.

## Variables

- `NEXT_PUBLIC_SITE_URL`: URL canónica del sitio.
- `GOOGLE_SITE_VERIFICATION`: token de Google Search Console, sin incluir la etiqueta HTML completa.
- `BING_SITE_VERIFICATION`: token `msvalidate.01` de Bing Webmaster Tools.
- `NEXT_PUBLIC_CUSTOMIZER_URL`: URL pública del configurador. Si está vacía, `/personalizados` muestra “Configurador próximamente”.
- `NEXT_PUBLIC_ENABLE_RESTRICTED_MEDIA`: habilita únicamente para revisión interna imágenes de jugadores y escudos pendientes de autorización.
- `NEXT_PUBLIC_PRESENTATION_MODE`: muestra el material entregado para la presentación a Richard. Debe pasar a `false` antes de preparar una versión pública.
- `NEXT_PUBLIC_COMMERCE_ENABLED`: reserva el encendido futuro del comercio.
- `NEXT_PUBLIC_COMMERCE_PROVIDER`: debe ser distinto de `unavailable` para habilitar `/carrito`.

El repositorio no contiene credenciales ni una integración real de Mercado Pago.

## Rutas

- `/` — portada editorial.
- `/catalogo` — buscador, filtro por categoría y orden.
- `/catalogo?categoria=...` — catálogo unificado con categoría y filtros conservados en la URL.
- `/producto/[slug]` — galería, materiales y variantes de referencia.
- `/personalizados` — proceso y acceso configurable al visualizador.
- `/clientes` — mapa de alcance internacional y carrusel demostrativo de testimonios.
- `/nosotros` — historia familiar y origen en Paysandú.
- `/contacto` — canales públicos y ubicación.
- `/carrito` — existe en código, pero devuelve 404 mientras comercio no esté realmente configurado.
- `/checkout` — para Uruguay usa Mercado Pago; para el exterior registra el pedido y abre WhatsApp con número, destino, artículos y subtotal para coordinar envío y pago.

## Verificaciones

```bash
npm run lint
npm run typecheck
npm test
npx playwright install chromium
npm run test:e2e
npm run build
```

## SEO e indexación

- `/robots.txt` permite rastrear las páginas HTML para que los buscadores puedan leer sus directivas `noindex`; solo excluye `/api/` y `/auth/`.
- `/sitemap.xml` publica las variantes en español, inglés y portugués, sus relaciones `hreflang` y las imágenes editoriales y de producto.
- `/manifest.webmanifest` describe la marca y su icono para navegadores y dispositivos.
- `/llms.txt` resume la entidad, los idiomas, las rutas públicas y los datos de contacto para motores de respuesta.
- Carrito, checkout, perfil, pedidos y las páginas de Compras permanecen fuera del índice mediante metadatos de página hasta su aprobación.
- Cada despliegue público debe definir `NEXT_PUBLIC_SITE_URL=https://matearte.uy` antes de generar metadatos, canonical, sitemap y schema.

## Recursos y derechos

Los originales curados y el nuevo material de presentación se conservan en `public/assets/matearte/`. El ZIP de respaldo está en `_archive/recursos-matearte.zip`, fuera de los recursos servidos al navegador. Los archivos terminados en `-poster.jpg` son fotogramas optimizados generados localmente para evitar pantallas vacías al cargar los videos.

`public/assets/matearte/README.md` y `public/assets/matearte/FUENTES.csv` documentan procedencia y recomendaciones. El uso del material público no implica cesión de derechos.

Requieren validación antes de publicar:

- imágenes de Instagram y contenido de comunidad;
- José María Giménez y otras personalidades;
- escudos de AUF, AFA y clubes;
- marcas de terceros en productos;
- sello y recursos oficiales de Uruguay Natural.

En esta iteración `NEXT_PUBLIC_PRESENTATION_MODE=true` muestra los videos, logos y fotografías nuevos para la presentación interna. Antes de publicar debe cambiarse a `false` y validarse cada recurso pendiente.

## Motion y video

La portada incorpora entrada escalonada y parallax leve. El bloque audiovisual adapta `@piyushxdev/interactive-video-portfolio-scroller`, instalado desde 21st.dev, al sistema editorial de MateArte. Los videos:

- se reproducen automáticamente, sin sonido, cuando entran en pantalla;
- se pausan al salir de pantalla;
- cargan solo metadatos y un póster liviano;
- usan controles accesibles para reproducción y sonido;
- respetan `prefers-reduced-motion`.

## Comercio

`/catalogo` y `/producto/[slug]` consultan en cada visita los productos publicados en Supabase. Los productos nuevos cargados desde `commerce-admin` aparecen con nombre, descripción, categoría, imágenes, variantes activas y precio mínimo en UYU. Los productos editoriales siguen como respaldo hasta que sean reemplazados por un producto comercial con el mismo slug.

Los visitantes solo reciben filas publicadas mediante políticas RLS específicas. La categoría interna `sandbox` no se muestra en la grilla. Los materiales, tipos y colores del panel se incorporarán cuando se defina el modelo final de filtros.
