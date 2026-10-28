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
  const localOrder = page.getByRole('row').filter({ hasText: 'Local #00018' });
  await expect(localOrder.getByRole('cell').nth(1)).toHaveText('12/10/2026');
  await expect(localOrder.getByRole('cell', { name: 'Mates', exact: true })).toBeVisible();
  await expect(localOrder).not.toContainText('Mate de catálogo');
  await localOrder.getByRole('button', { name: 'Ver detalle del pedido Local #00018' }).click();
  const orderDialog = page.getByRole('dialog');
  await expect(orderDialog).toHaveClass(/unified-order-modal/);
  await expect(orderDialog.getByRole('region', { name: 'Resumen del pedido' }).getByText('Comprador del local')).toBeVisible();
  await expect(orderDialog.locator('.order-detail-item-meta').first()).toContainText('SKU-2');
  await expect(orderDialog.locator('.order-detail-item-meta').nth(1)).toContainText('Marrón');
  await expect(orderDialog.locator('.order-contact-phone__prefix')).toHaveText('+598');
  await page.goto('/clientes/base');
  await expect(page.getByRole('button', { name: 'Ver ficha de Comprador del local' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Origen' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Tipo' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Segmento' })).toHaveCount(0);
  await expect(page.getByRole('row').filter({ hasText: 'Comprador del local' }).getByRole('button', { name: 'Editar Comprador del local' })).toBeVisible();
  const scrollFits = await page.locator('.customers-table .table-scroll').evaluate((element) => element.scrollWidth <= element.clientWidth + 1);
  expect(scrollFits).toBe(true);
  await page.getByRole('button', { name: 'Ver ficha de Comprador del local' }).click();
  await expect(page.getByRole('dialog').getByText('Retira los sábados')).toBeVisible();
  await expect(page.getByRole('dialog').getByRole('button', { name: 'Local #00018' })).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Cerrar' }).click();
  await page.getByRole('row').filter({ hasText: 'Comprador del local' }).getByRole('button', { name: 'Editar Comprador del local' }).click();
  await page.getByRole('dialog').getByRole('textbox', { name: 'Celular', exact: true }).fill('099777888');
  await page.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect.poll(() => tables.local_sales_customers[0].phone).toBe('+59899777888');
  await page.goto('/finanzas/cobros');
  await expect(page.getByText('local:sale-18')).toBeVisible();
  await page.goto('/produccion/resumen');
  await expect(page.getByRole('button', { name: 'Local #00018' })).toHaveCount(0);
});

test('registrar venta escribe en las tablas compartidas sin duplicar el cobro', async ({ page }) => {
  const { tables, writes } = await mockCommerce(page, { writable: true });
  await page.goto('/comercial/registrar-min');
  await page.getByLabel('Buscar producto').fill('SKU-1');
  await page.getByRole('button', { name: /SKU-1 · Mate de catálogo/ }).click();
  await page.getByRole('button', { name: 'Agregar nuevo cliente' }).click();
  await expect(page.getByRole('combobox', { name: 'País' })).toHaveValue('Uruguay');
  await expect(page.getByRole('combobox', { name: 'Departamento o provincia' })).toHaveValue('Paysandú');
  await page.getByLabel('Nombre', { exact: true }).fill('Nuevo cliente local');
  await page.getByLabel('Mail').fill('nuevo@example.invalid');
  await expect(page.getByLabel('Medio de pago').getByRole('option', { name: 'Seña' })).toHaveCount(0);
  await page.getByLabel('Con seña').check();
  await page.getByLabel('Seña cobrada').fill('250');
  await page.screenshot({ path: 'artifacts/registro-local.png', fullPage: true });
  await page.getByRole('button', { name: 'Guardar venta' }).click();
  await expect(page.getByRole('button', { name: '#L001' })).toBeVisible();
  expect(writes.filter(write => write.table === 'gestion_create_local_sale_with_items')).toHaveLength(1);
  expect(tables.local_sales).toHaveLength(1);
  expect(tables.local_sales_customers).toHaveLength(1);
  expect(tables.local_sales_customers[0].country).toBe('Uruguay');
  expect(tables.local_sales_customers[0].department).toBe('Paysandú');
  expect(tables.local_sales[0].payment_method).toBe('Efectivo');
  expect(tables.local_sales[0].deposit_minor).toBe(25000);
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('dialog').getByText('Saldo de la seña')).toBeVisible();
  await page.goto('/clientes/base');
  await expect(page.getByRole('button', { name: 'Ver ficha de Nuevo cliente local' })).toBeVisible();
  await page.goto('/finanzas/cobros');
  await expect(page.getByText('local:sale-19')).toBeVisible();
  await page.reload();
  await expect(page.getByText('local:sale-19')).toBeVisible();
});

test('efectivo y transferencia cobran precio base; tarjeta cobra precio publicado', async ({ page }) => {
  const { fixture, writes } = await mockCommerce(page, { writable: true });
  fixture.products[0].commerce_variants[0].base_price_minor = 100050;
  fixture.products[0].commerce_variants[0].price_minor = 110050;
  await page.goto('/comercial/registrar-min');
  await page.getByLabel('Buscar producto').fill('SKU-1');
  await expect(page.getByRole('button', { name: /SKU-1 · Mate de catálogo/ })).toContainText('$ 1.000,5');
  await page.getByRole('button', { name: /SKU-1 · Mate de catálogo/ }).click();
  const price = page.locator('.local-sale-line input[type="number"]').first();
  await expect(price).toHaveValue('1000.5');
  await page.getByLabel('Medio de pago').selectOption('Débito');
  await expect(price).toHaveValue('1100.5');
  await page.getByLabel('Medio de pago').selectOption('Transferencia');
  await expect(price).toHaveValue('1000.5');
  await page.getByRole('button', { name: 'Agregar nuevo cliente' }).click();
  await page.getByLabel('Nombre', { exact: true }).fill('Cliente transferencia');
  await page.getByRole('button', { name: 'Guardar venta' }).click();
  await expect.poll(() => writes.find(write => write.table === 'gestion_create_local_sale_with_items')?.body.p_items[0].unit_price_minor).toBe(100050);
});

test('una seña con débito conserva el precio publicado y el saldo pendiente', async ({ page }) => {
  const { fixture, tables, writes } = await mockCommerce(page, { writable: true });
  fixture.products[0].commerce_variants[0].base_price_minor = 100050;
  fixture.products[0].commerce_variants[0].price_minor = 110050;
  await page.goto('/comercial/registrar-min');
  await page.getByLabel('Medio de pago').selectOption('Débito');
  await page.getByLabel('Buscar producto').fill('SKU-1');
  await page.getByRole('button', { name: /SKU-1 · Mate de catálogo/ }).click();
  await expect(page.locator('.local-sale-line input[type="number"]').first()).toHaveValue('1100.5');
  await page.getByLabel('Con seña').check();
  await page.getByLabel('Seña cobrada').fill('250');
  await page.getByRole('button', { name: 'Guardar venta' }).click();
  await expect(page.getByRole('dialog').getByText('Saldo de la seña')).toBeVisible();
  const saved = writes.find(write => write.table === 'gestion_create_local_sale_with_items');
  expect(saved?.body).toMatchObject({ p_payment_method: 'Débito', p_deposit_minor: 25000 });
  expect(saved?.body.p_items[0].unit_price_minor).toBe(110050);
  expect(tables.local_sales[0]).toMatchObject({ payment_method: 'Débito', total_minor: 25000, deposit_minor: 25000 });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/comercial/registrar-min');
  await expect(page.getByLabel('Con seña')).toBeVisible();
  await page.getByLabel('Con seña').check();
  await expect(page.getByLabel('Seña cobrada')).toBeVisible();
  expect(await page.locator('body').evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
});

test('editar venta permite sumar un artículo con el SKU exacto', async ({ page }) => {
  const { fixture, tables, writes } = await mockCommerce(page, { writable: true });
  fixture.products[0].commerce_variants[0].base_price_minor = 100050;
  fixture.products[0].commerce_variants[0].price_minor = 110050;
  tables.local_sales.push({ id: 'sale-edit-sku', sale_number: 37, reference_code: '#L037', channel: 'Local',
    customer_id: null, customer_name: 'Cliente sin registrar', sold_on: '2026-10-24', payment_method: 'Transferencia',
    total_minor: 200000, currency: 'UYU', created_at: '2026-10-24T12:00:00Z',
    local_sale_items: [{ id: 'item-existing', variant_id: 'variant-2', sku: 'SKU-2', product_name: 'Mate de catálogo',
      variant_name: 'Cuero marrón', quantity: 1, unit_price_minor: 200000, line_total_minor: 200000 }] });
  await page.goto('/comercial/pedidos');
  const row = page.getByRole('row').filter({ hasText: '#L037' });
  await row.getByRole('button', { name: 'Ver detalle del pedido #L037' }).click();
  await page.getByRole('dialog', { name: 'Detalle del pedido' }).getByRole('button', { name: 'Editar esta venta' }).click();
  const editor = page.getByRole('dialog', { name: 'Editar venta' });
  await editor.getByLabel('Agregar artículo por SKU').fill('NO-EXISTE');
  await editor.getByRole('button', { name: 'Agregar', exact: true }).click();
  await expect(editor.getByRole('alert')).toContainText('No encontramos un artículo');
  await editor.getByLabel('Agregar artículo por SKU').fill('sku-1');
  await expect(editor).toContainText('Mate de catálogo · $ 1.000,5');
  await editor.getByLabel('Agregar artículo por SKU').press('Enter');
  await expect(editor.locator('.local-sale-editor-line')).toHaveCount(2);
  await editor.getByLabel('Forma de pago').selectOption('Débito');
  await expect(editor.locator('.local-sale-editor-line').nth(1).getByLabel('Precio unitario')).toHaveValue('1100.5');
  await editor.getByLabel('Forma de pago').selectOption('Transferencia');
  await expect(editor.locator('.local-sale-editor-line').nth(1).getByLabel('Precio unitario')).toHaveValue('1000.5');
  await editor.screenshot({ path: 'artifacts/editar-venta-sku-desktop.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(editor.getByLabel('Agregar artículo por SKU')).toBeVisible();
  expect(await editor.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  await editor.screenshot({ path: 'artifacts/editar-venta-sku-mobile.png' });
  await page.setViewportSize({ width: 1440, height: 1100 });
  await editor.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(editor).toHaveCount(0);
  expect(tables.local_sales[0].local_sale_items).toHaveLength(2);
  expect(tables.local_sales[0].total_minor).toBe(300050);
  expect(writes.find(write => write.table === 'gestion_update_local_sale')?.body.p_items[1]).toEqual({ sku: 'SKU-1', quantity: 1, unit_price_minor: 100050 });
});

test('la seña muestra lo cobrado y el saldo se cobra en el mismo pedido', async ({ page }) => {
  const { tables, writes } = await mockCommerce(page, { writable: true });
  tables.local_sales.push({ id: 'sale-deposit-36', sale_number: 36, reference_code: '#L036', channel: 'Local',
    customer_id: null, customer_name: 'Cliente sin registrar', sold_on: '2026-10-24',
    payment_method: 'Transferencia', total_minor: 200000, deposit_minor: 200000, currency: 'UYU',
    created_at: '2026-10-24T12:00:00Z', local_sale_items: [{ id: 'item-deposit-36', variant_id: 'variant-2',
      sku: '102', product_name: 'Cartera Matera', variant_name: 'Negro/Blanco', quantity: 1,
      unit_price_minor: 450000, line_total_minor: 450000 }] });
  await page.goto('/comercial/pedidos');
  const row = page.getByRole('row').filter({ hasText: '#L036' });
  await expect(row).toContainText('$ 2.000');
  await expect(row).not.toContainText('Cobrado de');
  await expect(row).toContainText('Pago parcial');
  await row.getByRole('button', { name: 'Ver detalle del pedido #L036' }).click();
  const detail = page.getByRole('dialog', { name: 'Detalle del pedido' });
  await expect(detail).toContainText('Saldo de la seña: $ 2.500');
  await expect(detail).not.toContainText('Cobrado: $ 2.000 de $ 4.500');
  const totals = detail.getByRole('region', { name: 'Totales del pedido' });
  await expect(totals).toContainText('Valor de artículos$ 4.500');
  await expect(totals).toContainText('Seña · Transferencia');
  await expect(totals).toContainText('Saldo pendiente$ 2.500');
  await expect(totals).toContainText('Cobrado hasta ahora$ 2.000');
  await detail.screenshot({ path: 'artifacts/pedido-con-sena-desktop.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await detail.screenshot({ path: 'artifacts/pedido-con-sena-mobile.png' });
  expect(await detail.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  await page.setViewportSize({ width: 1440, height: 1100 });
  await detail.getByRole('button', { name: 'Registrar cobro' }).click();
  const receipt = page.getByRole('dialog', { name: 'Registrar cobro de #L036' });
  await expect(receipt.getByLabel('Importe cobrado (UYU)')).toHaveValue('2500');
  await receipt.getByLabel('Medio de pago').selectOption('Efectivo');
  await receipt.getByRole('button', { name: 'Registrar cobro' }).click();
  await expect(receipt).toHaveCount(0);
  await expect(row).toContainText('Pagado');
  await expect(totals).toContainText('Cobrado hasta ahora$ 4.500');
  await expect(totals).toContainText('Saldo pendiente$ 0');
  await expect(detail.getByRole('region', { name: 'Entrega y contacto' })).toContainText('Medio de pagoTransferencia · Efectivo');
  await expect(detail.getByRole('button', { name: 'Registrar cobro' })).toHaveCount(0);
  expect(tables.local_sales).toHaveLength(1);
  expect(tables.local_sale_receipts).toHaveLength(1);
  expect(tables.local_sale_receipts[0]).toMatchObject({ sale_id: 'sale-deposit-36', amount_minor: 250000, payment_method: 'Efectivo' });
  expect(writes.filter(write => write.table === 'gestion_record_local_sale_payment')).toHaveLength(1);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await detail.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
});

test('una variante oculta en la web se puede registrar en el local', async ({ page }) => {
  const { fixture, writes } = await mockCommerce(page, { writable: true });
  fixture.products[0].commerce_variants[0].active = false;
  fixture.products[0].commerce_variants[0].available_local = true;
  await page.goto('/comercial/registrar-min');
  await page.getByLabel('Buscar producto').fill('SKU-1');
  await page.getByRole('button', { name: /SKU-1 · Mate de catálogo/ }).click();
  await page.getByRole('button', { name: 'Agregar nuevo cliente' }).click();
  await page.getByLabel('Nombre', { exact: true }).fill('Cliente local');
  await page.getByRole('button', { name: 'Guardar venta' }).click();
  await expect(page.getByRole('button', { name: '#L001' })).toBeVisible();
  expect(writes.some((write) => write.table === 'gestion_create_local_sale_with_items')).toBe(true);
});

test('la miniatura de la venta respeta el encuadre usado en catálogo', async ({ page }) => {
  const { fixture } = await mockCommerce(page);
  fixture.products[0].commerce_product_images.push({ id: 'image-sale-preview', storage_path: 'test.png', alt_text: 'Mate', sort_order: 0, variant_id: null, option_values: { cover_x: 8, cover_y: -12, cover_zoom: 1.4 } });
  await page.goto('/comercial/registrar-min');
  await page.getByLabel('Buscar producto').fill('SKU-1');
  await page.getByRole('button', { name: /SKU-1 · Mate de catálogo/ }).click();
  const salePhoto = page.getByRole('img', { name: 'Foto de Mate de catálogo' });
  await expect(salePhoto).toBeVisible();
  await expect(salePhoto).toHaveAttribute('style', /translate\(8%, -12%\) scale\(1\.4\)/);
  const photoFrame = await salePhoto.locator('..').boundingBox();
  expect(photoFrame && photoFrame.height > photoFrame.width).toBeTruthy();
});

test('un servicio de precio variable se cobra en el local con el importe acordado', async ({ page }) => {
  const { fixture, writes } = await mockCommerce(page, { writable: true });
  fixture.reference.categories.push({ code: 'servicios', label_es: 'Servicios', active: true });
  fixture.products.push({
    id: 'service-1', name: 'Grabado láser', editorial_slug: 'grabado-laser',
    category: 'servicios', category_code: 'servicios', description: '', sale_mode: 'standard',
    published: false, peso: 0, updated_at: '2026-10-20T12:00:00Z', attributes: {},
    commerce_product_images: [],
    commerce_variants: [{ id: 'service-variant-1', sku: 'SERV-1', name: 'Única', price_minor: 0, base_price_minor: 0, active: true, available_local: true, available_web: false, weight_grams: 0 }],
  });

  await page.goto('/comercial/registrar-min');
  await page.getByLabel('Buscar producto').fill('SERV-1');
  await page.getByRole('button', { name: /SERV-1 · Grabado láser/ }).click();
  const agreedPrice = page.getByRole('spinbutton', { name: 'Precio acordado' });
  await expect(agreedPrice).toHaveValue('');
  await expect.poll(() => agreedPrice.evaluate((input: HTMLInputElement) => input.validity.valueMissing)).toBe(true);
  await page.getByRole('combobox', { name: 'Canal de venta' }).selectOption('Feria');
  await expect(page.getByRole('combobox', { name: 'Canal de venta' })).toHaveValue('Local');
  await agreedPrice.fill('1200');
  await page.getByRole('button', { name: 'Guardar venta' }).click();
  await expect.poll(() => writes.find((write) => write.table === 'gestion_create_local_sale_with_items')?.body.p_items[0].unit_price_minor).toBe(120000);
  expect(writes.find((write) => write.table === 'gestion_create_local_sale_with_items')?.body.p_channel).toBe('Local');
});

test('personalizados combina un mate armado, matera y bombilla y guarda los diseños', async ({ page }) => {
  await page.setViewportSize({ width: 2048, height: 1152 });
  const { fixture, writes } = await mockCommerce(page, { writable: true });
  fixture.products[0].commerce_variants[0].name = 'Natural · Tamaño Todos los tamaños';
  fixture.products[0].attributes = { ...fixture.products[0].attributes, 'tipo-mate': 'imperial', tamano: 'todos', interior: 'todos' };
  fixture.products[0].commerce_product_images.push({ id: 'image-custom-mate', storage_path: 'test.png', alt_text: 'Mate', sort_order: 0, variant_id: null });
  fixture.products.push({
    ...fixture.products[0], id: 'product-custom-matera', name: 'Matera de catálogo', category: 'materas', category_code: 'materas', commerce_product_images: [],
    commerce_variants: [{ ...fixture.products[0].commerce_variants[0], id: 'variant-custom-matera', sku: 'CUSTOM-MATERA', name: 'Cuero marrón' }],
  }, {
    ...fixture.products[0], id: 'product-custom-bombilla', name: 'Bombilla de alpaca', category: 'bombillas', category_code: 'bombillas', commerce_product_images: [],
    commerce_variants: [{ ...fixture.products[0].commerce_variants[0], id: 'variant-custom-bombilla', sku: 'CUSTOM-BOMBILLA', name: 'Alpaca' }],
  });

  await page.goto('/comercial/registrar-min');
  await expect(page.getByRole('tab', { name: 'Artículos' })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('tab', { name: 'Personalizados' }).click();
  await page.getByLabel('Categoría de artículo').selectOption('mate');
  await page.getByLabel('Modelo', { exact: true }).selectOption('imperial');
  await page.locator('.local-custom-builder').getByLabel('Color', { exact: true }).selectOption('natural');
  await page.locator('.local-custom-builder').getByLabel('Interior', { exact: true }).selectOption('calabaza');
  await page.locator('.local-custom-builder').getByLabel('Tamaño', { exact: true }).selectOption('grande');
  for (const [label,value] of [['Cuero o textura','liso'],['Virola','imperial'],['Diseño del fleje','liso'],['Posamate','sin-posamate'],['Pie','comun']]) await page.locator('#local-panel-custom > .local-custom-builder').getByLabel(label,{exact:true}).selectOption(value);
  await page.getByRole('button', { name: /Agregar personalizado/ }).click();
  await expect(page.locator('.local-sale-photo-panel')).not.toContainText('Todos los tamaños');
  await page.getByRole('navigation', { name: 'Pasos del diseño de Mate Imperial personalizado' }).getByRole('button', { name: /Virola/ }).click();
  await page.getByLabel('Texto de virola de Mate Imperial personalizado').fill('ENZO');
  await expect(page.getByRole('navigation', { name: 'Pasos del diseño de Mate Imperial personalizado' }).getByRole('button', { name: /Resumen/ })).toHaveCount(0);
  await expect(page.getByLabel('Precio unitario de Mate Imperial personalizado')).toHaveValue(/2\.720/);
  await expect(page.getByLabel('Desglose de Mate Imperial personalizado')).toContainText('Grabado láser en virola');
  await expect(page.locator('.local-personalization-card-heading').first().locator('svg, p')).toHaveCount(0);
  const productBox = await page.locator('.local-sale-product-section').boundingBox();
  const photosBox = await page.locator('.local-sale-photo-panel').boundingBox();
  expect(productBox && photosBox && photosBox.x >= productBox.x + productBox.width).toBeTruthy();

  await page.getByLabel('Categoría de artículo').selectOption('matera');
  await page.getByLabel('Modelo', { exact: true }).selectOption({ index: 1 });
  await page.getByRole('button', { name: /Agregar personalizado/ }).click();
  await expect(page.getByText('El logo es la opción habitual; también podés registrar texto')).toBeVisible();
  await page.getByLabel('Ubicación de Matera de catálogo').selectOption('front-lid');
  await page.getByLabel('Logo de Matera de catálogo').setInputFiles({ name: 'logo-cliente.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>') });
  await expect(page.getByText('logo-cliente.svg')).toBeVisible();
  await expect(page.getByLabel('Precio unitario de Matera de catálogo')).toHaveValue(/1\.240,5/);
  await expect(page.getByLabel('Precio de Matera de catálogo')).toContainText('Grabado láser en matera');

  await page.getByLabel('Categoría de artículo').selectOption('bombilla');
  await page.getByLabel('Modelo', { exact: true }).selectOption({ index: 1 });
  await page.getByRole('button', { name: /Agregar personalizado/ }).click();
  await page.getByLabel('Texto de Bombilla de alpaca').fill('ANA');
  await expect(page.getByLabel('Precio unitario de Bombilla de alpaca')).toHaveValue(/1\.120,5/);
  await expect(page.getByLabel('Precio de Bombilla de alpaca')).toContainText('Grabado láser en bombilla');
  await page.getByLabel('Indicaciones para Bombilla de alpaca').fill('Letra cursiva');
  await expect(page.locator('.local-sale-photo-item')).toHaveCount(3);
  await page.getByRole('button', { name: 'Guardar venta' }).click();
  await expect(page.getByRole('dialog').getByText('#L001')).toBeVisible();

  const write = writes.find((entry) => entry.table === 'gestion_create_local_sale_with_items');
  expect(write?.body.p_items).toHaveLength(3);
  expect(write?.body.p_items[0].unit_price_minor).toBe(272000);
  expect(write?.body.p_items[0].customization.localPricing).toMatchObject({ source: 'published-personalizer', versionId: 'pricing-test', extrasUnitPriceMinor: 12000 });
  expect(write?.body.p_items[0].customization.configuration.rim.texts[0].text).toBe('ENZO');
  expect(write?.body.p_items[0].customization.configuration.selectedOptions).toEqual({ tamano: 'grande', interior: 'calabaza' });
  expect(write?.body.p_items[1].unit_price_minor).toBe(124050);
  expect(write?.body.p_items[1].customization.localPricing).toMatchObject({ source: 'published-personalizer', versionId: 'pricing-test', extrasUnitPriceMinor: 24000 });
  expect(write?.body.p_items[1].customization.localPersonalization).toMatchObject({ kind: 'matera', placement: 'front-lid', logoName: 'logo-cliente.svg' });
  expect(write?.body.p_items[2].unit_price_minor).toBe(112050);
  expect(write?.body.p_items[2].customization.localPricing).toMatchObject({ source: 'published-personalizer', versionId: 'pricing-test', extrasUnitPriceMinor: 12000 });
  expect(write?.body.p_items[2].customization.localPersonalization).toMatchObject({ kind: 'bombilla', text: 'ANA', instructions: 'Letra cursiva' });

  await page.goto('/produccion/personalizados');
  const row = page.getByRole('row').filter({ hasText: '#L001' });
  await expect(row).toContainText('Mates, Materas, Bombillas');
  await row.getByRole('button', { name: 'Ver detalle del pedido #L001' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Mate Imperial personalizado' })).toBeVisible();
  await expect(dialog.getByRole('heading', { name: 'Matera de catálogo' })).toBeVisible();
  await expect(dialog.getByRole('heading', { name: 'Bombilla de alpaca' })).toBeVisible();
  await dialog.getByRole('tab', { name: 'Producción' }).click();
  await expect(dialog.getByText('Calabaza', { exact: true })).toBeVisible();
  await expect(dialog.getByText('Frente y tapa')).toBeVisible();
  await expect(dialog.getByText('logo-cliente.svg').first()).toBeVisible();
});

test('al cambiar de país ofrece sus provincias y guarda la seleccionada', async ({ page }) => {
  const { tables } = await mockCommerce(page, { writable: true });
  await page.goto('/comercial/registrar-min');
  await page.getByLabel('Buscar producto').fill('SKU-1');
  await page.getByRole('button', { name: /SKU-1 · Mate de catálogo/ }).click();
  await page.getByRole('button', { name: 'Agregar nuevo cliente' }).click();
  await page.getByLabel('Nombre', { exact: true }).fill('Cliente Argentina');
  await page.getByRole('combobox', { name: 'País' }).selectOption('Argentina');
  await expect(page.getByLabel('Ciudad', { exact: true })).toHaveValue('');
  const department = page.getByRole('combobox', { name: 'Departamento o provincia' });
  await expect(department).toHaveValue('');
  await expect(department.locator('option[value="Buenos Aires"]')).toHaveCount(1);
  await expect(department.locator('option[value="Paysandú"]')).toHaveCount(0);
  await department.selectOption('Buenos Aires');
  await page.getByRole('button', { name: 'Guardar venta' }).click();
  await expect.poll(() => tables.local_sales_customers[0]?.department).toBe('Buenos Aires');
  expect(tables.local_sales_customers[0].country).toBe('Argentina');
});

test('la categoría filtra el selector de productos con el código real', async ({ page }) => {
  const { fixture } = await mockCommerce(page);
  fixture.reference.categories.push({ code: 'bombillas', label_es: 'Bombillas', active: true });
  fixture.products.push({
    ...fixture.products[0], id: 'product-bombilla', name: 'Bombilla de prueba', category: 'categoría-legada', category_code: 'bombillas',
    commerce_variants: fixture.products[0].commerce_variants.map((variant, index) => ({ ...variant, id: `bombilla-${index}`, sku: `BOMB-${index}` })),
  });

  await page.goto('/comercial/registrar-min');
  await expect(page.getByRole('combobox', { name: 'Canal de venta' }).getByRole('option', { name: 'Feria' })).toHaveCount(1);
  const category = page.getByRole('combobox', { name: 'Categoría' });
  const product = page.getByRole('combobox', { name: 'Nombre' });
  await category.selectOption('bombillas');
  await expect(page.getByRole('combobox', { name: 'Tipo' })).toHaveValue('Bombilla');
  await expect(product.locator('option')).toContainText(['Bombilla de prueba']);
  await expect(product.locator('option')).not.toContainText(['Mate de catálogo']);
});

test('registrar venta de Instagram usa su referencia y canal propios', async ({ page }) => {
  const { tables, writes } = await mockCommerce(page, { writable: true });
  await page.goto('/comercial/registrar-min');
  await page.getByRole('combobox', { name: 'Canal de venta' }).selectOption('Instagram');
  await page.getByLabel('Buscar producto').fill('SKU-1');
  await page.getByRole('button', { name: /SKU-1 · Mate de catálogo/ }).click();
  await page.getByRole('button', { name: 'Guardar venta' }).click();
  const instagramRow = page.getByRole('row').filter({ hasText: '#R001' });
  await expect(instagramRow).toBeVisible();
  await expect(instagramRow.getByText('Instagram')).toBeVisible();
  expect(writes.filter((write) => write.table === 'gestion_create_local_sale_with_items')).toHaveLength(1);
  expect(tables.local_sales[0].reference_code).toBe('#R001');
  expect(tables.local_sales[0].channel).toBe('Instagram');
  await page.getByRole('dialog').getByRole('button', { name: 'Cerrar', exact: true }).last().click();
  await page.getByRole('button', { name: 'Instagram', exact: true }).click();
  await expect(page.getByRole('row').filter({ hasText: '#R001' })).toBeVisible();
});

test('una variante sin Local tampoco se ofrece al registrar ventas por redes', async ({ page }) => {
  const { fixture } = await mockCommerce(page, { writable: true });
  fixture.products[0].commerce_variants[0].available_local = false;
  await page.goto('/comercial/registrar-min');
  await page.getByRole('combobox', { name: 'Canal de venta' }).selectOption('Instagram');
  await page.getByLabel('Buscar producto').fill('SKU-1');
  await expect(page.getByRole('button', { name: /SKU-1 · Mate de catálogo/ })).toHaveCount(0);
});

test('Facebook y WhatsApp comparten serie R y mantienen el canal específico', async ({ page }) => {
  const { tables, writes } = await mockCommerce(page, { writable: true });
  for (const channel of ['Facebook', 'WhatsApp']) {
    await page.goto('/comercial/registrar-min');
    await page.getByRole('combobox', { name: 'Canal de venta' }).selectOption(channel);
    await page.getByLabel('Categoría').selectOption('mates');
    await page.getByRole('combobox', { name: 'Variante' }).selectOption('variant-1');
    await page.getByRole('button', { name: 'Agregar producto' }).click();
    await page.getByRole('button', { name: 'Guardar venta' }).click();
  }
  expect(tables.local_sales.map((sale: any) => [sale.channel, sale.reference_code])).toEqual([['Facebook', '#R001'], ['WhatsApp', '#R002']]);
  expect(writes.filter((write) => write.table === 'gestion_create_local_sale_with_items').map((write) => write.body.p_channel)).toEqual(['Facebook', 'WhatsApp']);
});

test('una venta local puede vincularse a un cliente web existente', async ({ page }) => {
  const { tables } = await mockCommerce(page, { writable: true });
  await page.goto('/comercial/registrar-min');
  await page.getByLabel('Buscar producto').fill('SKU-1');
  await page.getByRole('button', { name: /SKU-1 · Mate de catálogo/ }).click();
  await page.getByLabel('Buscar cliente').fill('Cliente de prueba');
  await page.getByRole('button', { name: /Cliente de prueba/i }).click();
  await expect(page.getByText('Cliente registrado')).toBeVisible();
  await expect(page.getByText('Sin registrar')).toHaveCount(0);
  await expect(page.getByText('Se registrará como cliente del local al guardar la venta.')).toHaveCount(0);
  await page.getByRole('button', { name: 'Guardar venta' }).click();
  await expect(page.getByRole('dialog').getByRole('region', { name: 'Resumen del pedido' }).getByText('Cliente de prueba')).toBeVisible();
  expect(tables.local_sales_customers).toHaveLength(1);
  expect(tables.local_sales_customers[0].email).toBe('test@example.invalid');
  expect(tables.local_sales_customers[0].linked_customer_id).toBe(tables.orders[0].user_id);
  expect(tables.local_sales_customers[0].department).toBeNull();
  expect(tables.local_sales[0].customer_id).toBe(tables.local_sales_customers[0].id);
  await page.goto('/clientes/base');
  await expect(page.getByRole('row').filter({ hasText: 'Cliente de prueba' })).toHaveCount(1);
  await expect(page.getByRole('row').filter({ hasText: 'Cliente de prueba' }).getByText('Web')).toBeVisible();
  await page.goto('/comercial/registrar-min');
  await page.getByLabel('Buscar producto').fill('SKU-1');
  await page.getByRole('button', { name: /SKU-1 · Mate de catálogo/ }).click();
  await page.getByLabel('Buscar cliente').fill('Cliente de prueba');
  await page.getByRole('button', { name: /Cliente de prueba/i }).click();
  await page.getByRole('button', { name: 'Guardar venta' }).click();
  expect(tables.local_sales_customers).toHaveLength(1);
  expect(tables.local_sales).toHaveLength(2);
  expect(tables.local_sales[1].customer_id).toBe(tables.local_sales_customers[0].id);
});

test('el lápiz abre la ficha del cliente registrado', async ({ page }) => {
  await mockCommerce(page, { writable: true });
  await page.goto('/comercial/registrar-min');
  await page.getByLabel('Buscar cliente').fill('Cliente de prueba');
  await page.getByRole('button', { name: /Cliente de prueba/i }).click();
  await page.getByRole('button', { name: 'Editar Cliente de prueba' }).click();
  await expect(page).toHaveURL(/\/clientes\/base\?editar=/);
  await expect(page.getByRole('dialog').getByRole('heading', { name: 'Editar cliente' })).toBeVisible();
});

test('cliente y datos de venta se adaptan a una pantalla angosta', async ({ page }) => {
  await mockCommerce(page);
  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto('/comercial/registrar-min');

  await expect(page.getByRole('heading', { name: 'Cliente' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Agregar nuevo cliente' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Datos de la venta' })).toBeVisible();
  await expect.poll(async () => page.locator('.local-sale-register').evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
});
