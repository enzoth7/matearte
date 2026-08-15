# MateArte Uruguay — sitio editorial y catálogo

Sitio web independiente de MateArte Uruguay, construido con Next.js, TypeScript y Tailwind CSS. Presenta la historia, el oficio, las categorías y un catálogo local preparado para conectarse posteriormente con precios, stock y Mercado Pago.

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
- `NEXT_PUBLIC_CUSTOMIZER_URL`: URL pública del configurador. Si está vacía, `/personalizados` muestra “Configurador próximamente”.
- `NEXT_PUBLIC_ENABLE_RESTRICTED_MEDIA`: habilita únicamente para revisión interna imágenes de jugadores y escudos pendientes de autorización.
- `NEXT_PUBLIC_PRESENTATION_MODE`: muestra el material entregado para la presentación a Richard. Debe pasar a `false` antes de preparar una versión pública.
- `NEXT_PUBLIC_COMMERCE_ENABLED`: reserva el encendido futuro del comercio.
- `NEXT_PUBLIC_COMMERCE_PROVIDER`: debe ser distinto de `unavailable` para habilitar `/carrito`.

El repositorio no contiene credenciales ni una integración real de Mercado Pago.

## Rutas

- `/` — portada editorial.
- `/catalogo` — buscador, filtro por categoría y orden.
- `/catalogo/[categoria]` — mates, bombillas, materas, termos y regalos.
- `/producto/[slug]` — galería, materiales y variantes de referencia.
- `/personalizados` — proceso y acceso configurable al visualizador.
- `/clientes` — mapa de alcance internacional y carrusel demostrativo de testimonios.
- `/nosotros` — historia familiar y origen en Paysandú.
- `/contacto` — canales públicos y ubicación.
- `/carrito` — existe en código, pero devuelve 404 mientras comercio no esté realmente configurado.

## Verificaciones

```bash
npm run lint
npm run typecheck
npm test
npx playwright install chromium
npm run test:e2e
npm run build
```

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

Los tipos `CommerceAdapter`, `CartItem`, `Money` y `CheckoutResult` dejan preparado el contrato de integración. No existe endpoint ficticio, no se procesan pagos y no se muestran precios antiguos como vigentes.
