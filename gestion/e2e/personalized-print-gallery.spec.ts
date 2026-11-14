import { test, expect } from '@playwright/test';
import { mockCommerce } from './commerce-fixture';

test('imprime los escudos y letras debajo del título del fleje sin su dibujo ornamental', async ({ page }) => {
  const { fixture } = await mockCommerce(page, { writable: true });
  const design = fixture.orders[0].order_items[0];
  fixture.orders[0].order_items = [design];
  design.item_type = 'design';
  design.immutable_snapshot = {
    previews: ['virola', 'fleje_front', 'fleje_back'].map(role => ({ role, bucket_id: 'order-assets', object_path: `test/${role}.png`, mime_type: 'image/png', byte_size: 100 })),
    assets: [
      { role: 'workshop_reference', bucket_id: 'order-assets', object_path: 'test/referencia.png', original_name: 'referencia.png', mime_type: 'image/png', byte_size: 100 },
      { bucket_id: 'order-assets', object_path: 'test/logo.png', original_name: 'logo.png', mime_type: 'image/png', byte_size: 100 },
    ],
    configuration: { engravingTypeId: 'laser', flejeEngravingTypeId: 'bronze-applique', capabilities: { hasRim: true, hasFleje: true }, selectionLabels: { characteristics: { 'diseno-fleje': 'Griego' } } },
    flejeConfiguration: {
      sides: {
        front: { imageMode: 'image', icons: [{ id: 'escudo-frente', selectedImageId: 'escudo-frente', customImage: { id: 'escudo-frente', name: 'Escudo del frente', previewUrl: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Ccircle cx="50" cy="50" r="38" fill="black"/%3E%3C/svg%3E' } }] },
        back: { imageMode: 'image', icons: [{ id: 'escudo-reverso', selectedImageId: 'escudo-reverso', customImage: { id: 'escudo-reverso', name: 'Escudo del reverso', previewUrl: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Crect x="20" y="20" width="60" height="60" fill="black"/%3E%3C/svg%3E' } }], textMode: 'text', text: 'SR' },
      },
    },
  };
  await page.goto('/produccion/personalizados');
  await page.getByRole('button', { name: 'Ver detalle del pedido #9001' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('tab', { name: 'Producción' }).click();
  await expect(dialog.locator('.design-artifact-group').getByText('Referencia para el taller')).toBeVisible();
  await expect(dialog.locator('.production-print-fleje-label')).toBeHidden();
  await expect(dialog.locator('.production-print-gallery [data-preview-role^="fleje_"]')).toHaveCount(2);
  await page.evaluate(() => {
    (window as Window & { printCalls?: number }).printCalls = 0;
    window.print = () => { (window as Window & { printCalls?: number }).printCalls = 1; };
  });
  await dialog.getByRole('button', { name: 'Imprimir para producción' }).click();
  await expect.poll(() => page.evaluate(() => (window as Window & { printCalls?: number }).printCalls)).toBe(1);
  await page.emulateMedia({ media: 'print' });
  await expect(dialog.locator('.production-print-gallery')).toBeVisible();
  await expect(dialog.locator('.production-print-gallery .customer-asset')).toHaveCount(3);
  await expect(dialog.locator('.production-print-uploads .customer-asset')).toHaveCount(2);
  await expect(dialog.locator('.production-print-gallery [data-preview-role="virola"]')).toBeVisible();
  await expect(dialog.locator('.production-print-gallery [data-preview-role^="fleje_"]').first()).toBeHidden();
  await expect(dialog.locator('[data-print-part="virola"]')).toHaveText('TÉCNICA DE VIROLA: GRABADO LÁSER');
  await expect(dialog.locator('.production-print-fleje-label > strong')).toHaveText('FLEJE: Griego');
  await expect(dialog.locator('.production-print-fleje-label')).toBeVisible();
  await expect(dialog.locator('.production-print-fleje-side')).toHaveCount(2);
  await expect(dialog.locator('.production-print-fleje-side').first().getByRole('img', { name: 'Escudo del frente' })).toBeVisible();
  await expect(dialog.locator('.production-print-fleje-side').last().getByRole('img', { name: 'Escudo del reverso' })).toBeVisible();
  await expect(dialog.locator('.production-print-fleje-side').last().getByText('SR')).toBeVisible();
  await expect(dialog.locator('[data-print-part="fleje"]')).toHaveText('TÉCNICA DE FLEJE: APLIQUE DE BRONCE');
  await expect(dialog.locator('.personalized-item .design-artifact-group')).toBeHidden();
  await expect(dialog.locator('.production-print-gallery')).toHaveCSS('break-after', 'page');
  await page.pdf({ path: 'artifacts/personalized-print-gallery.pdf', printBackground: true, preferCSSPageSize: true });

  delete (design.immutable_snapshot as Record<string, unknown>).flejeConfiguration;
  (design.immutable_snapshot.configuration as Record<string, unknown>).flejeEngravingTypeId = 'alpaca-applique';
  await page.emulateMedia({ media: 'screen' });
  await page.reload();
  await page.getByRole('button', { name: 'Ver detalle del pedido #9001' }).click();
  await page.emulateMedia({ media: 'print' });
  await expect(page.getByRole('dialog').locator('.production-print-fleje-fallback .customer-asset')).toHaveCount(2);
  await expect(page.getByRole('dialog').locator('.production-print-fleje-fallback [data-preview-role="fleje_front"]')).toBeVisible();
  await expect(page.getByRole('dialog').locator('.production-print-fleje-fallback [data-preview-role="fleje_back"]')).toBeVisible();
  await expect(page.getByRole('dialog').locator('[data-print-part="fleje"]')).toHaveText('TÉCNICA DE FLEJE: APLIQUE DE ALPACA');
});
