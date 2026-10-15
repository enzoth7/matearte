import { test, expect } from '@playwright/test';
import { mockCommerce } from './commerce-fixture';

test('ventas del local comparten pedidos, clientes y cobros con Gestión', async ({ page }) => {
  const { tables } = await mockCommerce(page, { writable: true });
  tables.local_sales_customers.push({ id: 'local-customer-1', full_name: 'Comprador del local', email: 'local@example.invalid',
    phone: '099123456', birth_date: '1990-02-03', first_purchase_date: '2026-10-12', last_purchase_date: '2026-10-12',
    source_user_id: null, notes: 'Retira los sábados' });
  tables.local_sales.push({ id: 'sale-18', sale_number: 18, customer_id: 'local-customer-1',
    customer_name: 'Comprador del local', sold_on: '2026-10-12', payment_method: 'Efectivo', total_minor: 200000,
    currency: 'UYU', created_at: '2026-10-12T13:00:00Z', local_sale_items: [{ id: 'sale-item-18', variant_id: 'variant-2',
      sku: 'SKU-2', product_name: 'Mate de catálogo', variant_name: 'Cuero marrón', quantity: 1,
      unit_price_minor: 200000, line_total_minor: 200000 }] });

  await page.goto('/comercial/pedidos');
  await expect(page.getByRole('button', { name: 'Local #00018' })).toBeVisible();
  await expect(page.getByRole('row').filter({ has: page.getByRole('button', { name: 'Local #00018' }) }).getByRole('cell').nth(1)).toHaveText('12/10/2026');
  await page.getByRole('button', { name: 'Local #00018' }).click();
  await expect(page.getByRole('dialog').getByText('Comprador del local')).toBeVisible();
  await expect(page.getByRole('dialog').getByText('SKU-2')).toBeVisible();
  await page.goto('/clientes/base');
  await expect(page.getByRole('button', { name: 'Comprador del local' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Canal' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Segmento' })).toHaveCount(0);
  await expect(page.getByRole('row').filter({ hasText: 'Comprador del local' }).getByRole('button', { name: 'Editar' })).toBeVisible();
  const scrollFits = await page.locator('.customers-table .table-scroll').evaluate((element) => element.scrollWidth <= element.clientWidth + 1);
  expect(scrollFits).toBe(true);
  await page.getByRole('button', { name: 'Comprador del local' }).click();
  await expect(page.getByRole('dialog').getByText('Retira los sábados')).toBeVisible();
  await expect(page.getByRole('dialog').getByRole('button', { name: 'Local #00018' })).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Cerrar' }).click();
  await page.getByRole('row').filter({ hasText: 'Comprador del local' }).getByRole('button', { name: 'Editar' }).click();
  await page.getByLabel('Celular').fill('099777888');
  await page.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect.poll(() => tables.local_sales_customers[0].phone).toBe('099777888');
  await page.goto('/finanzas/cobros');
  await expect(page.getByText('local:sale-18')).toBeVisible();
  await page.goto('/produccion/resumen');
  await expect(page.getByRole('button', { name: 'Local #00018' })).toHaveCount(0);
});

test('registrar venta escribe en las tablas compartidas sin duplicar el cobro', async ({ page }) => {
  const { tables, writes } = await mockCommerce(page, { writable: true });
  await page.goto('/comercial/registrar');
  await page.getByLabel('Buscar producto').fill('SKU-1');
  await page.getByRole('button', { name: /SKU-1 · Mate de catálogo/ }).click();
  await page.getByRole('combobox', { name: 'Cliente', exact: true }).selectOption('new');
  await page.getByLabel('Nombre', { exact: true }).fill('Nuevo cliente local');
  await page.getByLabel('Mail').fill('nuevo@example.invalid');
  await page.getByLabel('Medio de pago').selectOption('Seña');
  await page.getByLabel('Seña cobrada').fill('250');
  await page.screenshot({ path: 'artifacts/registro-local.png', fullPage: true });
  await page.getByRole('button', { name: 'Guardar venta' }).click();
  await expect(page.getByRole('button', { name: '#L001' })).toBeVisible();
  expect(writes.filter(write => write.table === 'create_local_sale_with_items')).toHaveLength(1);
  expect(tables.local_sales).toHaveLength(1);
  expect(tables.local_sales_customers).toHaveLength(1);
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('dialog').getByText('Saldo de la seña')).toBeVisible();
  await page.goto('/clientes/base');
  await expect(page.getByRole('button', { name: 'Nuevo cliente local' })).toBeVisible();
  await page.goto('/finanzas/cobros');
  await expect(page.getByText('local:sale-19')).toBeVisible();
  await page.reload();
  await expect(page.getByText('local:sale-19')).toBeVisible();
});

test('registrar venta de Instagram usa su referencia y canal propios', async ({ page }) => {
  const { tables, writes } = await mockCommerce(page, { writable: true });
  await page.goto('/comercial/registrar');
  await page.getByRole('combobox', { name: 'Canal de venta' }).selectOption('Instagram');
  await page.getByLabel('Buscar producto').fill('SKU-1');
  await page.getByRole('button', { name: /SKU-1 · Mate de catálogo/ }).click();
  await page.getByRole('button', { name: 'Guardar venta' }).click();
  await expect(page.getByRole('button', { name: '#R001' })).toBeVisible();
  await expect(page.getByRole('row').filter({ has: page.getByRole('button', { name: '#R001' }) }).getByText('Instagram')).toBeVisible();
  expect(writes.filter((write) => write.table === 'create_channel_sale_with_items')).toHaveLength(1);
  expect(tables.local_sales[0].reference_code).toBe('#R001');
  expect(tables.local_sales[0].channel).toBe('Instagram');
  await page.getByRole('dialog').getByRole('button', { name: 'Cerrar' }).click();
  await page.getByRole('button', { name: 'Instagram', exact: true }).click();
  await expect(page.getByRole('button', { name: '#R001' })).toBeVisible();
});

test('Facebook y WhatsApp comparten serie R y mantienen el canal específico', async ({ page }) => {
  const { tables, writes } = await mockCommerce(page, { writable: true });
  for (const channel of ['Facebook', 'WhatsApp']) {
    await page.goto('/comercial/registrar');
    await page.getByRole('combobox', { name: 'Canal de venta' }).selectOption(channel);
    await page.getByLabel('Familia').selectOption('Mates');
    await page.getByRole('combobox', { name: 'Producto y variante' }).selectOption('variant-1');
    await page.getByRole('button', { name: 'Agregar producto' }).click();
    await page.getByRole('button', { name: 'Guardar venta' }).click();
  }
  expect(tables.local_sales.map((sale: any) => [sale.channel, sale.reference_code])).toEqual([['Facebook', '#R001'], ['WhatsApp', '#R002']]);
  expect(writes.filter((write) => write.table === 'create_channel_sale_with_items').map((write) => write.body.p_channel)).toEqual(['Facebook', 'WhatsApp']);
});

test('una venta local puede vincularse a un cliente web existente', async ({ page }) => {
  const { tables } = await mockCommerce(page, { writable: true });
  await page.goto('/comercial/registrar');
  await page.getByLabel('Buscar producto').fill('SKU-1');
  await page.getByRole('button', { name: /SKU-1 · Mate de catálogo/ }).click();
  await page.getByRole('combobox', { name: 'Cliente', exact: true }).selectOption('customer-1');
  await page.getByRole('button', { name: 'Guardar venta' }).click();
  await expect(page.getByRole('dialog').getByText('Cliente de prueba')).toBeVisible();
  expect(tables.local_sales_customers).toHaveLength(1);
  expect(tables.local_sales_customers[0].email).toBe('test@example.invalid');
  expect(tables.local_sales[0].customer_id).toBe(tables.local_sales_customers[0].id);
  await page.goto('/clientes/base');
  await expect(page.getByRole('row').filter({ hasText: 'Cliente de prueba' })).toHaveCount(1);
});
