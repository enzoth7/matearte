# Pendientes del sitio, Marca País y catálogo

Última revisión: 4 de septiembre de 2026.

Este documento sirve como recordatorio de decisiones y trabajos que todavía no están cerrados. El hosting será resuelto por Enzo y no se incluye entre los pendientes técnicos de esta lista.

## Marca País Uruguay Natural

### Qué significa

La auditoría indica que MateArte ya obtuvo la Marca País Uruguay Natural. Por lo tanto, no falta "conseguir" la Marca País: lo que la auditoría propone es aprovechar mejor ese reconocimiento en la comunicación de la empresa y en su presentación internacional.

Marca País no es un archivo SEO ni un requisito técnico de Google. Es un activo de identidad y posicionamiento que permite reforzar el origen uruguayo, la calidad artesanal y la proyección internacional de MateArte.

### Estado actual

- La portada ya menciona el vínculo con Marca País Uruguay Natural y muestra el isologotipo de Uruguay.
- El repositorio contiene imágenes de Uruguay Natural y de la composición Marca País + LSQA.
- Esos archivos están marcados internamente como pendientes de validación porque el material recibido no incorporaba una constancia de autorización junto con los archivos.
- El manual indica que deben respetarse las versiones aprobadas, el contraste según el fondo, los colores institucionales y el espacio libre alrededor del isologotipo. No se debe deformar, reordenar ni recolorear la marca.

### Qué quedaría por decidir

- Confirmar que los archivos entregados son los oficiales y están autorizados para el uso de MateArte. Si la autorización ya existe, guardar una copia de esa constancia junto con los recursos de identidad.
- Decidir si se quiere mostrar Marca País también en:
  - el footer;
  - la página Nosotros;
  - las fichas de producto;
  - una página propia sobre Marca País y el origen uruguayo;
  - correos, catálogo mayorista, PDF comercial, packaging y campañas.
- Definir si corresponde usar el isologotipo Uruguay solo o la composición Marca País + LSQA en cada soporte.

No es necesario agregar todos esos lugares de una vez. Para la web, una primera etapa razonable sería portada + Nosotros + footer, respetando el manual.

## Vinculación entre commerce-admin y el catálogo público

### Respuesta corta

La vinculación principal ya está funcionando. Cuando un producto se crea en `commerce-admin`, se le cargan imágenes y variantes y finalmente se marca como publicado, aparece en `/catalogo` al recargar la página. No es necesario editar el código para agregarlo.

El sitio obtiene desde Supabase:

- publicación u ocultamiento;
- nombre, descripción y categoría;
- foto principal y resto de imágenes;
- variantes activas, SKU y precio en UYU;
- stock disponible.

La grilla usa el precio de la variante activa más económica. Si todavía no hay una variante con precio, el producto puede aparecer como “Consultar”. Si no se cargó una imagen, usa temporalmente el logo de MateArte para no romper la página.

### Cómo publicar un producto nuevo

1. Crear el producto en `commerce-admin` con nombre, slug, categoría y descripción.
2. Subir al menos una imagen; la primera según el orden será la portada.
3. Crear al menos una variante activa con SKU, precio en UYU y stock.
4. Marcar el producto como publicado.
5. Recargar `/catalogo`. El producto también tendrá su propia URL `/producto/[slug]`.

Los productos ocultos o no publicados no se exponen al visitante. La categoría interna `sandbox` permanece excluida de la grilla pública.

### Compatibilidad con el catálogo existente

- Los productos editoriales que todavía no están publicados en el panel continúan visibles como contenido de respaldo.
- Si un producto publicado tiene el mismo slug que uno editorial, Supabase reemplaza sus datos comerciales y sus imágenes cargadas tienen prioridad.
- Los productos totalmente nuevos se agregan al final del catálogo.
- En inglés y portugués, los productos editoriales conservan sus traducciones existentes. Un producto nuevo usa por ahora el texto cargado en el panel en los tres idiomas, hasta definir cómo se administrarán las traducciones.

### Seguridad aplicada

Se separó la lectura pública de la administración. Los visitantes solo pueden leer productos publicados, variantes activas e imágenes públicas. Las operaciones de creación, edición y eliminación siguen reservadas a administradores autenticados; ninguna clave administrativa se entrega al navegador.

### Lo que permite commerce-admin

- Crear, editar, ocultar, publicar y eliminar productos.
- Cargar nombre, categoría, descripción y modalidad de venta.
- Subir varias fotos PNG, JPEG o WebP de hasta 5 MB.
- Crear variantes con SKU, nombre, precio en UYU, peso y stock.
- Activar o desactivar variantes.
- Controlar stock disponible y reservado.

## Trabajo técnico que queda para una segunda etapa

1. Definir y guardar materiales, tipo de mate y colores cuando esté claro qué productos se recibirán.
2. Decidir si los filtros pertenecen al producto completo o a cada variante.
3. Incorporar en el panel los textos de producto para español, inglés y portugués.
4. Definir un orden manual o la condición de producto destacado desde el panel.
5. Reemplazar gradualmente el contenido editorial de respaldo por productos publicados reales.

## Decisión pendiente sobre filtros

Los filtros que existen actualmente en la interfaz son:

- Categoría: todos, mates, bombillas, materas, termos y regalos personalizados.
- Precio: menos de $3.000; $3.000-$4.999; $5.000-$6.999; $7.000 o más.
- Material: cuero, alpaca, acero inoxidable, otros metales y madera.
- Tipo de mate: imperial, camionero, criollo y torpedo.
- Color: cuero tostado, arena, cacao y salvia. Está preparado, pero aparece deshabilitado porque los productos todavía no reciben colores desde la base.

Antes de implementar los filtros definitivos en la base y en el panel hay que decidir:

- qué filtros se mantienen y cuáles se eliminan;
- si cada filtro pertenece al producto o a cada variante;
- qué materiales y colores serán opciones cerradas;
- si el tipo de mate debe mostrarse únicamente cuando la categoría es Mates;
- si el precio del filtro usa la variante más barata, la variante principal o un precio propio del producto;
- cómo se ordenan los productos destacados.

Estas decisiones pueden tomarse después de recibir los productos. La integración actual no obliga a definirlas ahora: los productos nuevos aparecen en “Todos” y participan del filtro de precio; los filtros sin datos no los excluyen mientras el visitante no los seleccione.

## Otros pendientes del diagnóstico SEO

Para retomar más adelante:

- validar y ampliar las descripciones comerciales de cada producto;
- definir preguntas frecuentes y contenidos informativos;
- aprobar políticas de envíos, cambios, devoluciones y garantías;
- cargar códigos de Google Search Console, Bing, Analytics y Meta cuando existan;
- evaluar Google Merchant Center y Meta Catalog una vez que el catálogo dinámico tenga precios, stock e imágenes reales;
- decidir en qué lugares se comunicará Marca País;
- crear `Offer` en los datos estructurados solamente cuando el precio y la disponibilidad provengan del catálogo comercial real.
