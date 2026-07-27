import html2canvas from 'html2canvas';

/**
 * Captura un elemento del DOM como PNG Blob.
 * Utiliza html2canvas directamente sobre el elemento visible con opciones de CORS y fallback.
 */
export async function captureElementAsBlob(element: HTMLElement): Promise<Blob | null> {
  try {
    console.log('Iniciando captura de pantalla del elemento preview...', element);

    const canvas = await html2canvas(element, {
      backgroundColor: '#fbf3de',
      scale: 1.5,
      useCORS: true,
      allowTaint: true,
      logging: false,
      imageTimeout: 15000,
      onclone: (_clonedDoc, clonedElement) => {
        clonedElement.style.backgroundColor = '#fbf3de';
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
