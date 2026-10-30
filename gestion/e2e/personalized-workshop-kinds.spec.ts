import { expect, test } from '@playwright/test';
import { mockCommerce } from './commerce-fixture';

test('Personalizados muestra bombillas, materas y grabados con su propia ficha', async ({ page }) => {
  const { fixture, tables } = await mockCommerce(page);
  fixture.products.push({
    id: 'product-service', name: 'Grabado con aplique', editorial_slug: 'grabado-aplique',
    category: 'servicios', category_code: 'servicios', published: false, sale_mode: 'standard',
    peso: 0, updated_at: '2026-10-30T12:00:00Z', attributes: {}, commerce_product_images: [],
    commerce_variants: [{ id: 'variant-service', sku: 'SVC-1', name: 'Única', price_minor: 50000,
      base_price_minor: 50000, active: true, available_local: true, available_web: false,
      available_wholesale: false, weight_grams: 0, rim_type: null, leather_type: null, option_values: {} }],
  });
  const sale = (id: string, reference_code: string, item: Record<string, unknown>) => ({
    id, sale_number: Number(reference_code.slice(2)), reference_code, channel: 'Instagram', customer_id: null,
    customer_name: 'Cliente de prueba', sold_on: '2026-10-30', payment_method: 'Efectivo',
    total_minor: 50000, currency: 'UYU', created_at: '2026-10-30T12:00:00Z', local_sale_items: [{
      id: `${id}-item`, variant_id: 'variant-1', sku: 'SKU-1', product_name: 'Artículo',
      variant_name: 'Marrón', quantity: 1, unit_price_minor: 50000, line_total_minor: 50000, ...item,
    }],
  });
  tables.local_sales.push(
    sale('sale-bombilla', '#R006', { product_name: 'Bombillón Pico de Loro Alpaca',
      customization: { source: 'local', localPersonalization: { kind: 'bombilla', techniqueLabel: 'Aplique de bronce',
        contentLabel: 'Texto', placementLabel: 'Cuerpo', text: '13', instructions: '' }, configuration: { rim: {} },
        previews: [{ role: 'virola', bucket_id: 'order-assets', object_path: 'old/virola.png', mime_type: 'image/png' }] } }),
    sale('sale-matera', '#R007', { product_name: 'Matera personalizada', customization: { source: 'local',
      localPersonalization: { kind: 'matera', techniqueLabel: 'Láser', contentLabel: 'Logo',
        placementLabel: 'Frente y tapa', text: '', instructions: 'Logo centrado' }, configuration: { rim: {} } } }),
    sale('sale-service', '#L039', { variant_id: 'variant-service', sku: 'SVC-1', product_name: 'Grabado con aplique',
      customization: null, production_notes: null }),
  );

  await page.goto('/produccion/personalizados');
  const bombilla = page.getByRole('row').filter({ hasText: '#R006' });
  await expect(bombilla).toContainText('Bombillas');
  await bombilla.getByRole('button', { name: 'Ver detalle del pedido #R006' }).click();
  let dialog = page.getByRole('dialog');
  await dialog.getByRole('tab', { name: 'Producción' }).click();
  await expect(dialog.getByRole('heading', { name: 'Así quiere la bombilla' })).toBeVisible();
  await expect(dialog).toContainText('Aplique de bronce');
  await expect(dialog).toContainText('13');
  await expect(dialog.getByRole('heading', { name: /virola|fleje/i })).toHaveCount(0);
  await expect(dialog.getByRole('heading', { name: 'Indicaciones para el taller' })).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Cerrar detalle' }).click();

  const matera = page.getByRole('row').filter({ hasText: '#R007' });
  await expect(matera).toContainText('Materas');
  await matera.getByRole('button', { name: 'Ver detalle del pedido #R007' }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByRole('tab', { name: 'Producción' }).click();
  await expect(dialog.getByRole('heading', { name: 'Así quiere la matera' })).toBeVisible();
  await expect(dialog).toContainText('Logo centrado');
  await dialog.getByRole('button', { name: 'Cerrar detalle' }).click();

  const service = page.getByRole('row').filter({ hasText: '#L039' });
  await expect(service).toContainText('Apliques');
  await service.getByRole('button', { name: 'Ver detalle del pedido #L039' }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByRole('tab', { name: 'Producción' }).click();
  await expect(dialog.getByRole('heading', { name: 'Detalle del aplique' })).toBeVisible();
  await expect(dialog.getByRole('heading', { name: 'Indicaciones para el taller' })).toHaveCount(0);
});
