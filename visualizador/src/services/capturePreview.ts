import { domToBlob } from 'modern-screenshot';

async function waitForVisualAssets(element: HTMLElement) {
  await document.fonts?.ready;
  const images = Array.from(element.querySelectorAll('img'));
  await Promise.all(images.map(async (image) => {
    if (!image.complete) await new Promise<void>((resolve) => {
      image.addEventListener('load', () => resolve(), { once: true });
      image.addEventListener('error', () => resolve(), { once: true });
    });
    try { await image.decode(); } catch { /* The capture reports unusable assets. */ }
  }));
  await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
}

/**
 * Captura un elemento del DOM como PNG Blob utilizando modern-screenshot.
 * Soporta nativamente Tailwind CSS v4 (colores oklch/oklab), máscaras SVG, y fuentes modernas.
 */
export async function captureElementAsBlob(element: HTMLElement): Promise<Blob | null> {
  try {
    await waitForVisualAssets(element);

    const blob = await domToBlob(element, {
      backgroundColor: '#fbf3de',
      scale: 2,
      quality: 1,
    });
    return blob;
  } catch (err) {
    console.error('No se pudo capturar la vista previa:', err);
    return null;
  }
}
