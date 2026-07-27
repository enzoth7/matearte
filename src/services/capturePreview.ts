import html2canvas from 'html2canvas';

/**
 * Captura un elemento del DOM como PNG Blob.
 * Sanitiza todo el CSS (etiquetas <style>, <link rel="stylesheet"> y estilos inline)
 * reemplazando las funciones de color oklch/oklab de Tailwind v4 por colores RGB/HEX
 * que html2canvas puede interpretar sin fallar.
 */
export async function captureElementAsBlob(element: HTMLElement): Promise<Blob | null> {
  try {
    console.log('📸 Iniciando captura de vista previa con html2canvas...', element);

    const canvas = await html2canvas(element, {
      backgroundColor: '#fbf3de',
      scale: 1.5,
      useCORS: true,
      allowTaint: true,
      logging: false,
      imageTimeout: 15000,
      onclone: async (clonedDoc) => {
        const dummyCanvas = clonedDoc.createElement('canvas');
        dummyCanvas.width = 1;
        dummyCanvas.height = 1;
        const ctx = dummyCanvas.getContext('2d');

        const convertColor = (colorStr: string): string => {
          if (!ctx) return '#808080';
          try {
            ctx.fillStyle = colorStr;
            return ctx.fillStyle; // El navegador convierte oklch/oklab a #hex o rgb() automáticamente
          } catch {
            return '#808080';
          }
        };

        const sanitizeCssString = (cssText: string): string => {
          if (!cssText || (!cssText.includes('oklch') && !cssText.includes('oklab'))) {
            return cssText;
          }
          return cssText.replace(/(oklch|oklab)\([^)]+\)/gi, (match) => convertColor(match));
        };

        // 1. Reemplazar <link rel="stylesheet"> por <style> inlined y saneados (para archivos CSS de Vercel/Vite)
        const linkTags = Array.from(clonedDoc.querySelectorAll('link[rel="stylesheet"]'));
        await Promise.all(
          linkTags.map(async (link) => {
            try {
              const href = link.getAttribute('href');
              if (href) {
                const res = await fetch(href);
                const cssText = await res.text();
                const cleanCss = sanitizeCssString(cssText);
                
                const style = clonedDoc.createElement('style');
                style.textContent = cleanCss;
                if (link.parentNode) {
                  link.parentNode.replaceChild(style, link);
                }
              }
            } catch (e) {
              console.warn('No se pudo sanear la hoja de estilos vinculada:', e);
            }
          })
        );

        // 2. Sanear todas las etiquetas <style> existentes en el DOM clonado
        const styleTags = clonedDoc.querySelectorAll('style');
        styleTags.forEach((style) => {
          if (style.textContent) {
            style.textContent = sanitizeCssString(style.textContent);
          }
        });

        // 3. Sanear estilos inline en todos los elementos
        const allElements = clonedDoc.querySelectorAll('*');
        allElements.forEach((el) => {
          const htmlEl = el as HTMLElement;
          const styleAttr = htmlEl.getAttribute('style');
          if (styleAttr) {
            const cleanStyle = sanitizeCssString(styleAttr);
            htmlEl.setAttribute('style', cleanStyle);
          }
        });
      },
    });

    return new Promise<Blob | null>((resolve) => {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            console.log('✅ Screenshot de preview generado exitosamente:', blob.size, 'bytes');
          } else {
            console.warn('⚠️ html2canvas.toBlob retornó null');
          }
          resolve(blob);
        },
        'image/png',
        0.9
      );
    });
  } catch (err) {
    console.error('❌ Error capturando vista previa con html2canvas:', err);
    return null;
  }
}
