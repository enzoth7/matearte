import { domToBlob } from 'modern-screenshot';

/**
 * Captura un elemento del DOM como PNG Blob utilizando modern-screenshot.
 * Soporta nativamente Tailwind CSS v4 (colores oklch/oklab), máscaras SVG, y fuentes modernas.
 */
export async function captureElementAsBlob(element: HTMLElement): Promise<Blob | null> {
  try {
    console.log('📸 Capturando vista previa con modern-screenshot...', element);

    const blob = await domToBlob(element, {
      backgroundColor: '#fbf3de',
      scale: 1.5,
      quality: 0.9,
    });

    if (blob) {
      console.log('✅ Screenshot generado exitosamente con modern-screenshot:', blob.size, 'bytes');
    } else {
      console.warn('⚠️ domToBlob retornó null');
    }

    return blob;
  } catch (err) {
    console.error('❌ Error capturando vista previa con modern-screenshot:', err);
    return null;
  }
}
