import html2canvas from 'html2canvas';

/**
 * Captura un elemento del DOM como PNG Blob.
 * Convierte los elementos SVG complejos (con filtros y máscaras)
 * en imágenes dataURI para que html2canvas los renderice sin fallar.
 */
export async function captureElementAsBlob(element: HTMLElement): Promise<Blob | null> {
  let clone: HTMLElement | null = null;
  try {
    // 1. Clonar el elemento para no modificar el DOM visible del usuario
    clone = element.cloneNode(true) as HTMLElement;
    
    // Posicionar el clon fuera de la pantalla manteniendo su ancho
    clone.style.position = 'absolute';
    clone.style.left = '-9999px';
    clone.style.top = '-9999px';
    clone.style.width = `${element.offsetWidth || 600}px`;
    clone.style.backgroundColor = '#fbf3de';
    document.body.appendChild(clone);

    // 2. Convertir todos los SVGs del clon en Data URIs <img>
    // Esto evita que html2canvas explote con <filter>, <mask id="..."> y <feColorMatrix>
    const svgs = Array.from(clone.querySelectorAll('svg'));
    await Promise.all(
      svgs.map(async (svg) => {
        try {
          // Asegurar dimensiones explícitas si falta viewBox o width
          if (!svg.getAttribute('xmlns')) {
            svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
          }
          const svgString = new XMLSerializer().serializeToString(svg);
          const dataUri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString)}`;
          
          const img = document.createElement('img');
          img.src = dataUri;
          img.style.width = '100%';
          img.style.height = '100%';
          img.style.objectFit = 'contain';

          // Esperar a que la imagen se cargue en memoria
          await new Promise((res) => {
            img.onload = res;
            img.onerror = res;
          });

          if (svg.parentNode) {
            svg.parentNode.replaceChild(img, svg);
          }
        } catch (e) {
          console.warn('Could not process SVG element:', e);
        }
      })
    );

    // 3. Renderizar con html2canvas
    const canvas = await html2canvas(clone, {
      backgroundColor: '#fbf3de',
      scale: 1.5,
      useCORS: true,
      allowTaint: true,
      logging: false,
    });

    // Limpiar el clon del DOM
    if (clone && clone.parentNode) {
      clone.parentNode.removeChild(clone);
    }

    return new Promise<Blob | null>((resolve) => {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            console.log('Preview image captured successfully:', blob.size, 'bytes');
          } else {
            console.warn('html2canvas toBlob returned null');
          }
          resolve(blob);
        },
        'image/png',
        0.9
      );
    });
  } catch (err) {
    console.error('Error capturing preview as image:', err);
    if (clone && clone.parentNode) {
      clone.parentNode.removeChild(clone);
    }
    return null;
  }
}
