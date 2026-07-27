import html2canvas from 'html2canvas';

/**
 * Captura un elemento del DOM como PNG Blob.
 * Se usa para capturar el contenedor de previews del SummaryStep.
 */
export async function captureElementAsBlob(element: HTMLElement): Promise<Blob | null> {
  try {
    const canvas = await html2canvas(element, {
      backgroundColor: '#fbf3de', // Fondo del tema mate
      scale: 2, // Resolución 2x para buena calidad
      useCORS: true, // Permitir imágenes cross-origin
      logging: false,
    });

    return new Promise<Blob | null>((resolve) => {
      canvas.toBlob(
        (blob) => resolve(blob),
        'image/png',
        0.92
      );
    });
  } catch (err) {
    console.error('Error capturing preview as image:', err);
    return null;
  }
}
