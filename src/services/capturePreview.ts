import html2canvas from 'html2canvas';

/**
 * Captura un elemento del DOM como PNG Blob.
 * Convierte los colores oklab/oklch (generados por Tailwind CSS v4) a RGB/HEX
 * para evitar el error de html2canvas (Error: Attempting to parse an unsupported color function "oklab").
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
      onclone: (clonedDoc) => {
        // Solución para Tailwind CSS v4: Convertir todos los colores oklab/oklch a RGB
        const dummyCanvas = clonedDoc.createElement('canvas');
        dummyCanvas.width = 1;
        dummyCanvas.height = 1;
        const ctx = dummyCanvas.getContext('2d');

        if (!ctx) return;

        const convertColor = (val: string): string => {
          if (!val || (!val.includes('oklab') && !val.includes('oklch'))) {
            return val;
          }
          try {
            ctx.fillStyle = val;
            return ctx.fillStyle; // El navegador convierte oklab/oklch a #hex o rgb() automáticamente
          } catch {
            return '#000000';
          }
        };

        const colorProps = [
          'color',
          'background-color',
          'border-color',
          'border-top-color',
          'border-right-color',
          'border-bottom-color',
          'border-left-color',
          'outline-color',
          'fill',
          'stroke',
        ];

        const allElements = clonedDoc.querySelectorAll('*');
        allElements.forEach((el) => {
          const htmlEl = el as HTMLElement;
          if (!htmlEl.style) return;

          const computed = clonedDoc.defaultView?.getComputedStyle(htmlEl);
          if (!computed) return;

          colorProps.forEach((prop) => {
            const val = computed.getPropertyValue(prop);
            if (val && (val.includes('oklab') || val.includes('oklch'))) {
              const converted = convertColor(val);
              htmlEl.style.setProperty(prop, converted, 'important');
            }
          });
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
