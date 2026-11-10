import { test, expect } from '@playwright/test';
import { mockCommerce } from './commerce-fixture';

test('imprime todas las imágenes antes de los detalles', async ({ page }) => {
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
    configuration: { capabilities: { hasRim: true, hasFleje: true } },
  };
  await page.goto('/produccion/personalizados');
  await page.getByRole('button', { name: 'Ver detalle del pedido #9001' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('tab', { name: 'Producción' }).click();
  await expect(dialog.locator('.design-artifact-group').getByText('Referencia para el taller')).toBeVisible();
  await page.emulateMedia({ media: 'print' });
  await expect(dialog.locator('.production-print-gallery')).toBeVisible();
  await expect(dialog.locator('.production-print-gallery .customer-asset')).toHaveCount(5);
  await expect(dialog.locator('.personalized-item .design-artifact-group')).toBeHidden();
  await expect(dialog.locator('.personalized-item').first()).toHaveCSS('break-before', 'page');
  await page.pdf({ path: 'artifacts/personalized-print-gallery.pdf', printBackground: true });
});
