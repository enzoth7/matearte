import { test, expect } from '@playwright/test';
import { mockCommerce } from './commerce-fixture';

for (const width of [1440, 390]) {
  test(`W023 muestra originales y ambos descuentos a ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    const { fixture } = await mockCommerce(page);
    const order = fixture.orders[0];
    Object.assign(order, {
      reference_code: '#W023', items_subtotal_minor: 729000, shipping_minor: 0,
      payment_fee_minor: 0, discount_code: 'BIENVENIDA10', discount_minor: 72900, total_minor: 656100,
      customer_snapshot: { ...order.customer_snapshot, purchaseFlow: 'uruguay_retail_transfer', priceSource: 'published_discount_10', transferDiscountPercent: 10 },
      order_items: [
        ['Bombilla Cincelada', 110000, 99000], ['Bombillon Pico de Loro Bronce', 140000, 126000],
        ['Mate Imperial Fleje Manos', 295000, 265500], ['Mate Torpedo Cuero Crudo Alpaca Cincelada', 265000, 238500],
      ].map(([title, original, charged], index) => ({
        id: `item-${index}`, item_type: 'catalog', title, quantity: 1,
        unit_price_minor: charged, total_minor: charged, requires_review: false,
        immutable_snapshot: { variant: { price_minor: original } },
      })),
    });
    await page.goto('/comercial/pedidos');
    await page.getByRole('button', { name: 'Ver detalle del pedido #W023' }).click();
    const dialog = page.getByRole('dialog', { name: 'Detalle del pedido' });
    await expect(dialog.getByRole('listitem').filter({ hasText: 'Bombilla Cincelada' })).toContainText('1.100');
    await expect(dialog.locator('.line-item').filter({ hasText: 'Subtotal sin descuentos' })).toContainText('8.100');
    await expect(dialog.locator('.line-item').filter({ hasText: 'Descuento por transferencia · 10%' })).toContainText('810');
    await expect(dialog.locator('.line-item').filter({ hasText: 'BIENVENIDA10' })).toContainText('729');
    await expect(dialog.locator('.line-item').filter({ hasText: 'Total UYU' })).toContainText('6.561');
    await dialog.getByRole('region', { name: 'Totales del pedido' }).scrollIntoViewIfNeeded();
    await expect(dialog.getByText('Descuento por transferencia · 10%', { exact: true })).toBeVisible();
    await dialog.screenshot({ path: `artifacts/order-transfer-discount-${width}.png` });
  });
}
