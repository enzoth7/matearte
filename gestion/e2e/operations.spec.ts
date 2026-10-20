import { test, expect } from '@playwright/test';
import { mockCommerce } from './commerce-fixture';
import { defaultCatalogTaxonomy } from '../../shared/catalog-taxonomy';

test('el catálogo se reacomoda en dos paneles y conserva cambios sin guardar', async ({page}) => {
  const {fixture} = await mockCommerce(page,{writable:true});
  fixture.products.push({ ...structuredClone(fixture.products[0]), id:'product-2', name:'Bombilla', editorial_slug:'bombilla', commerce_variants:[{...fixture.products[0].commerce_variants[0],id:'variant-3',sku:'SKU-3'}], commerce_product_images:[] });
  await page.goto('/productos/catalogo');
  await expect(page.locator('.product-grid:not(.catalog-rail-grid) .product-card')).toHaveCount(3);
  await page.locator('.product-grid:not(.catalog-rail-grid) .product-card').first().click();
  await expect(page.locator('.catalog-split-view')).toBeVisible();
  await expect(page.locator('.catalog-rail-grid .product-card')).toHaveCount(3);
  await expect(page.locator('.catalog-rail-grid .product-card[aria-pressed="true"]')).toHaveCount(1);
  await expect(page.locator('.catalog-index')).toHaveCount(0);
  await expect(page.locator('.catalog-editor-column h3').first()).toHaveText('Mate de catálogo');
  const rail = await page.locator('.catalog-product-rail').boundingBox();
  const editor = await page.locator('.catalog-editor-column').boundingBox();
  expect(rail && editor && rail.x < editor.x).toBe(true);
  const name = page.locator('.product-details').getByRole('textbox',{name:'Nombre',exact:true});
  await name.fill('Nombre sin guardar');
  await page.locator('.catalog-rail-grid .product-card').nth(1).click();
  await expect(page.locator('.catalog-rail-grid .product-card[aria-pressed="true"]')).toHaveCount(1);
  await expect(name).toHaveValue('Nombre sin guardar');
  page.once('dialog',dialog=>void dialog.dismiss());
  await page.locator('.catalog-rail-grid .product-card').filter({hasText:'Bombilla'}).click();
  await expect(name).toHaveValue('Nombre sin guardar');
  page.once('dialog',dialog=>void dialog.accept());
  await page.locator('.catalog-rail-grid .product-card').filter({hasText:'Bombilla'}).click();
  await expect(page.locator('.catalog-editor-column h3').first()).toHaveText('Bombilla');
  await expect(page.locator('.catalog-editor-section').first()).toHaveAttribute('open','');
  await page.locator('.catalog-editor-section').first().locator('summary').click();
  await expect(page.locator('.catalog-editor-section').first()).not.toHaveAttribute('open','');
  await page.screenshot({path:'artifacts/catalogo-paneles.png',fullPage:true});
  await page.goBack();
  await expect(page.locator('.catalog-editor-column h3').first()).toHaveText('Mate de catálogo');
});

test('materiales múltiples, cierre de ficha y nueva variante alineada', async ({page}) => {
  const {fixture,tables} = await mockCommerce(page,{writable:true});
  fixture.products[0].attributes = {acabado:'valor anterior','material-mate':'calabaza','tipo-virola':'acero','tipo-cuero':'liso',posamate:'sin-posamate'};
  tables.commerce_attribute_definitions = defaultCatalogTaxonomy.attributes;
  tables.commerce_attribute_options = defaultCatalogTaxonomy.options;
  tables.commerce_category_attributes = defaultCatalogTaxonomy.rules;
  await page.goto('/productos/catalogo');
  await page.locator('.product-card').first().click();
  const materials = page.getByRole('group',{name:'Materiales'});
  await expect(materials).toBeVisible();
  await materials.getByRole('checkbox',{name:'Cuero'}).check();
  await materials.getByRole('checkbox',{name:'Alpaca'}).check();
  await expect(page.locator('.product-details')).not.toContainText('Acabado');
  await page.locator('.product-details').screenshot({path:'artifacts/catalogo-materiales.png'});
  await page.getByRole('button',{name:'Guardar cambios'}).click();
  await expect.poll(()=>fixture.products[0].catalog_filters.materials).toEqual(['cuero','alpaca']);
  expect(fixture.products[0].attributes?.acabado).toBe('valor anterior');
  const variantForm = page.locator('.variant-create');
  const sku = await variantForm.getByRole('textbox',{name:'SKU'}).boundingBox();
  const color = await variantForm.getByRole('combobox',{name:'Color'}).boundingBox();
  expect(sku && color && Math.abs(sku.y-color.y)<4).toBe(true);
  const close = await page.getByRole('button',{name:'Cerrar ficha'}).boundingBox();
  const remove = await page.getByRole('button',{name:'Eliminar producto'}).boundingBox();
  expect(close && remove && close.x>remove.x).toBe(true);
  await page.getByRole('button',{name:'Cerrar ficha'}).click();
  await expect(page.locator('.catalog-split-view')).toHaveCount(0);
  await page.getByRole('button',{name:'Nuevo producto'}).click();
  await page.getByRole('textbox',{name:'Nombre del producto'}).fill('Mate de dos materiales');
  await page.locator('.new-product-panel').getByRole('combobox',{name:'Material del mate'}).selectOption('calabaza');
  await page.locator('.new-product-panel').getByRole('combobox',{name:'Tipo de virola'}).selectOption('acero');
  await page.locator('.new-product-panel').getByRole('combobox',{name:'Tipo de cuero'}).selectOption('liso');
  await page.locator('.new-product-panel').getByRole('combobox',{name:'Posamate'}).selectOption('sin-posamate');
  const newMaterials = page.locator('.new-product-panel').getByRole('group',{name:'Materiales'});
  await newMaterials.getByRole('checkbox',{name:'Cuero'}).check();
  await newMaterials.getByRole('checkbox',{name:'Plata'}).check();
  await expect(page.locator('.new-product-panel')).not.toContainText('Acabado');
  await page.getByRole('button',{name:'Crear producto',exact:true}).click();
  await expect.poll(()=>fixture.products.find(product=>product.name==='Mate de dos materiales')?.catalog_filters.materials).toEqual(['cuero','plata']);
});

test('cada variante toma su foto al asociar las imágenes por color', async ({page}) => {
  const {fixture} = await mockCommerce(page,{writable:true});
  fixture.products[0].commerce_variants[0].option_values = {color:'negro'};
  fixture.products[0].commerce_variants[1].option_values = {color:'blanco'};
  fixture.products[0].commerce_product_images = [
    {id:'black-photo',product_id:'product-1',storage_path:'product-1/black.png',original_name:'negro.png',alt_text:'',mime_type:'image/png',byte_size:100,sort_order:0,variant_id:null,option_values:{}},
    {id:'white-photo',product_id:'product-1',storage_path:'product-1/white.png',original_name:'blanco.png',alt_text:'',mime_type:'image/png',byte_size:100,sort_order:1,variant_id:null,option_values:{}},
  ] as any;
  await page.goto('/productos/catalogo');
  await page.locator('.product-card').first().click();
  await page.getByRole('combobox',{name:'Color para negro.png'}).selectOption('negro');
  await page.getByRole('combobox',{name:'Color para blanco.png'}).selectOption('blanco');
  await expect(page.locator('.catalog-rail-grid .product-photo').first()).toHaveAttribute('src',/black\.png/);
  await expect(page.locator('.catalog-rail-grid .product-photo').nth(1)).toHaveAttribute('src',/white\.png/);
});

test('editar producto y precio persiste en las pantallas existentes', async ({page}) => {
  const { fixture } = await mockCommerce(page, {writable:true});
  await page.goto('/productos/catalogo');
  await page.locator('.product-card').first().click();
  const form = page.locator('.product-details');
  await expect(form.getByRole('textbox', {name:'Nombre',exact:true})).toHaveValue('Mate de catálogo');
  await form.getByRole('textbox', {name:'Nombre',exact:true}).fill('Mate actualizado');
  await form.getByRole('button',{name:'Guardar cambios',exact:true}).click();
  await expect.poll(()=>fixture.products[0].name).toBe('Mate actualizado');
  const row = page.locator('.variants-section tbody tr').first();
  await expect(row.getByRole('button',{name:'Guardar',exact:true})).toBeVisible();
  await row.getByLabel('Precio',{exact:true}).fill('1750.25');
  await row.getByRole('button',{name:'Guardar',exact:true}).click();
  await expect.poll(()=>fixture.products[0].commerce_variants[0].base_price_minor).toBe(175025);
  await page.getByRole('button',{name:'Cerrar ficha'}).click();
  await expect(page.locator('.product-card').first()).toContainText('Mate actualizado');
  await page.reload();
  await expect(page.locator('.product-card').first()).toContainText('Mate actualizado');
});

test('la disponibilidad Web se guarda por variante sin cambiar el precio', async ({page}) => {
  const {fixture} = await mockCommerce(page, {writable:true});
  const originalPrice = fixture.products[0].commerce_variants[0].price_minor;
  await page.goto('/productos/catalogo');
  await page.locator('.product-card').first().click();
  const row = page.locator('.variants-section tbody tr').first();
  await expect(row.getByRole('button',{name:'Guardar',exact:true})).toBeVisible();
  const channels = page.locator('.catalog-variant-details').first();
  await channels.getByRole('checkbox',{name:'Web'}).uncheck();
  await row.getByRole('button',{name:'Guardar',exact:true}).click();
  await expect.poll(()=>fixture.products[0].commerce_variants[0].available_web).toBe(false);
  expect(fixture.products[0].commerce_variants[0].price_minor).toBe(originalPrice);
});

test('subir varias imágenes y guardar encuadre conserva la galería', async ({page}) => {
  const {fixture} = await mockCommerce(page,{writable:true});
  await page.goto('/productos/catalogo');
  await page.locator('.product-card').first().click();
  const buffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/X1cAAAAASUVORK5CYII=','base64');
  await page.locator('input[type=file]').setInputFiles([{name:'frente.png',mimeType:'image/png',buffer},{name:'lateral.png',mimeType:'image/png',buffer}]);
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('slider').fill('1.5');
  await page.getByRole('button',{name:'Guardar portada'}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect.poll(()=>fixture.products[0].commerce_product_images.length).toBe(2);
  expect((fixture.products[0].commerce_product_images[0] as any).option_values.cover_zoom).toBe(1.5);
  await expect(page.locator('.image-gallery figure')).toHaveCount(2);
});

test('edición de cliente comparte el contacto con ventas',async({page})=>{
  const {fixture}=await mockCommerce(page,{writable:true});
  await page.goto('/clientes/base');
  await page.getByRole('button',{name:/Editar Cliente de Prueba/i}).click();
  await page.getByLabel('Nombre completo',{exact:true}).fill('Contacto corregido');
  await page.getByRole('button',{name:'Guardar contacto'}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect.poll(()=>fixture.orders[0].customer_snapshot.fullName).toBe('Contacto corregido');
  await page.goto('/comercial/pedidos');
  await expect(page.getByText('Contacto Corregido',{exact:true})).toBeVisible();
});

test('un contacto Web con pedidos muestra sus datos y bloquea el borrado', async ({ page }) => {
  const { fixture, writes } = await mockCommerce(page, { writable: true });
  await page.goto('/clientes/base');
  await page.getByRole('button', { name: /Editar Cliente de Prueba/i }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('Fecha de nacimiento')).toHaveValue('1993-04-05');
  await expect(dialog.getByLabel('Ciudad', { exact: true })).toHaveValue('Montevideo');
  await expect(dialog.getByLabel('País')).toHaveValue('Uruguay');
  await expect(dialog.getByLabel('Dirección', { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: /Eliminar Cliente de Prueba/i }).click();
  await expect(dialog.getByRole('alert')).toContainText('pedido vinculado');
  expect(writes.filter((write) => write.table === 'gestion_delete_unlinked_contact')).toHaveLength(0);
  expect(fixture.orders).toHaveLength(1);
});

test('una ficha Local vinculada a Web conserva ambos historiales al intentar borrarla', async ({ page }) => {
  const { tables, writes } = await mockCommerce(page, { writable: true });
  tables.local_sales_customers.push({ id: 'local-web', full_name: 'Cliente Combinado', company_name: 'Panz', address: 'Calle 2',
    email: 'test@example.invalid', phone: '+59899123456', city: 'Montevideo', country: 'Uruguay', birth_date: '1993-04-05',
    first_purchase_date: null, last_purchase_date: null, source_user_id: 'customer-1', notes: 'Nota local',
    agenda_import_key: null, agenda_additional_phones: [], agenda_inferred_category: null, updated_at: '2026-10-15T12:00:00Z' });
  await page.goto('/clientes/base');
  await page.getByRole('button', { name: 'Editar Cliente Combinado' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('Dirección')).toHaveValue('Calle 2');
  await dialog.getByRole('button', { name: 'Eliminar Cliente Combinado' }).click();
  await expect(dialog.getByRole('alert')).toContainText('pedido vinculado');
  expect(writes.filter((write) => write.table === 'gestion_delete_unlinked_contact')).toHaveLength(0);
  expect(tables.local_sales_customers).toHaveLength(1);
});

test('seguimiento de pedido se guarda en Entregas y conserva el importe',async({page})=>{
  const {fixture}=await mockCommerce(page,{writable:true});
  await page.goto('/entregas/envios');
  await page.getByRole('row').filter({hasText:'#9001'}).getByRole('button',{name:'Ver detalle del pedido #9001'}).click();
  await page.getByRole('button',{name:'Marcar enviado',exact:true}).click();
  await page.getByLabel('Empresa de envío').selectOption({label:'Otra empresa (escribir nombre)…'});
  await page.getByLabel('Nombre de la empresa').fill('Transportista');
  await page.getByLabel('Código de seguimiento').fill('TRACK-9001');
  await page.getByRole('button',{name:'Confirmar envío',exact:true}).click();
  await expect.poll(()=>fixture.orders[0].tracking_code).toBe('TRACK-9001');
  expect(fixture.orders[0].total_minor).toBe(410100);
  await page.reload();
  await page.getByRole('row').filter({hasText:'#9001'}).getByRole('button',{name:'Ver detalle del pedido #9001'}).click();
  await expect(page.getByRole('dialog').getByText('TRACK-9001',{exact:true})).toBeVisible();
});

test('cotizaciones, descuentos y tarifas guardan valores y unidades correctos',async({page})=>{
  const {fixture,writes}=await mockCommerce(page,{writable:true});
  await page.goto('/finanzas/monedas');
  const usd=page.locator('tr').filter({hasText:'USD'});
  await usd.getByRole('spinbutton').fill('41.5');
  await usd.getByRole('button',{name:'Guardar'}).click();
  await expect.poll(()=>fixture.reference.exchangeRates[0].rate_to_uyu).toBe(41.5);
  await page.goto('/marketing/descuentos');
  await page.getByLabel('Código',{exact:true}).fill('NUEVO15');
  await page.getByLabel('Tipo',{exact:true}).selectOption('percentage');
  await page.getByLabel('Porcentaje',{exact:true}).fill('15');
  await page.getByLabel('Válido desde').fill('2026-10-01');
  await page.getByLabel('Válido hasta').fill('2026-12-31');
  await page.getByRole('button',{name:'Crear descuento'}).click();
  await expect(page.getByRole('button',{name:'NUEVO15',exact:true})).toBeVisible();
  expect(writes.find(w=>w.table==='commerce_discounts')?.body.value).toBe(15);
  await page.goto('/entregas/tarifas');
  await page.getByRole('button',{name:'Editar tarifas internacionales'}).click();
  await page.locator('tbody input[type=number]').first().fill('725');
  await page.getByRole('button',{name:/Guardar cambios/}).click();
  await expect.poll(()=>fixture.reference.shippingRates[0].argentina).toBe(725);
});

test('un guardado rechazado no cierra el formulario ni anuncia éxito',async({page})=>{
  const {fixture}=await mockCommerce(page,{writable:true,failWrite:'gestion_update_customer_contact'});
  await page.goto('/clientes/base');
  await page.getByRole('button',{name:/Editar Cliente de Prueba/i}).click();
  await page.getByLabel('Nombre completo',{exact:true}).fill('Cambio rechazado');
  await page.getByRole('button',{name:'Guardar contacto'}).click();
  await expect(page.getByRole('alert')).toHaveText('Guardado rechazado');
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(fixture.orders[0].customer_snapshot.fullName).toBe('Cliente de prueba');
});

test('comprobante bancario utiliza el servicio existente con sesión y actualiza el pedido',async({page})=>{
  const {fixture}=await mockCommerce(page,{writable:true});
  fixture.orders[0].status='payment_verification_pending';
  fixture.orders[0].commerce_bank_transfer_receipts=[{id:'receipt-1',status:'pending',submitted_at:'2026-10-12',original_name:'comprobante.png',mime_type:'image/png',byte_size:100} as any];
  let approved=false;
  await page.route('**/commerce-api/api/admin/orders/order-1/bank-transfer',async route=>{
    expect(route.request().headers().authorization).toBe('Bearer header.payload.signature');
    if(route.request().method()==='GET') return route.fulfill({json:{signedUrl:'https://example.invalid/comprobante.png',receipt:{original_name:'comprobante.png',mime_type:'image/png'}}});
    expect(route.request().postDataJSON().decision).toBe('approve');
    approved=true;
    fixture.orders[0].status='ready_for_fulfillment';
    fixture.orders[0].commerce_bank_transfer_receipts[0].status='approved';
    return route.fulfill({json:{ok:true}});
  });
  await page.route('https://example.invalid/**',route=>route.fulfill({status:200,body:''}));
  await page.goto('/comercial/pedidos?pedido=order-1');
  await expect(page.getByRole('button',{name:'Aprobar pago',exact:true})).toBeEnabled();
  page.once('dialog',dialog=>dialog.accept());
  await page.getByRole('button',{name:'Aprobar pago',exact:true}).click();
  await expect.poll(()=>approved).toBe(true);
  await expect(page.getByRole('button',{name:'Aprobar pago',exact:true})).toHaveCount(0);
});

test('configuración de pagos y cuenta bancaria se guarda sin cambiar contratos',async({page})=>{
  const {tables}=await mockCommerce(page,{writable:true});
  await page.goto('/administracion/canales');
  await page.getByRole('checkbox',{name:'Habilitar PayPal',exact:true}).uncheck();
  await expect.poll(()=>tables.commerce_settings.paypal_enabled).toBe(false);
  await page.getByRole('textbox',{name:'Titular',exact:true}).fill('Titular corregido');
  await page.getByRole('button',{name:'Guardar datos bancarios',exact:true}).click();
  await expect.poll(()=>tables.commerce_bank_transfer_settings.account_holder).toBe('Titular corregido');
  await page.reload();
  await expect(page.getByRole('textbox',{name:'Titular',exact:true})).toHaveValue('Titular corregido');
});

test('personalizaciones abre los archivos privados y sus descargas',async({page})=>{
  const {fixture,writes}=await mockCommerce(page,{writable:true});
  fixture.orders[0].order_items[0].item_type='design';
  fixture.orders[0].order_items[0].requires_review=true;
  fixture.orders[0].order_items[0].immutable_snapshot={assets:[{bucket_id:'design-assets',object_path:'customer/design/logo.png',original_name:'logo.png',mime_type:'image/png',byte_size:128}]};
  await page.goto('/produccion/personalizados');
  await page.getByRole('button',{name:'Ver detalle del pedido #9001'}).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('link',{name:'Descargar original'})).toBeVisible();
  expect(writes.filter(write=>write.body.expiresIn===900)).toHaveLength(2);
});

test('editores utilizables en móvil y sin desbordamiento del documento',async({page})=>{
  await mockCommerce(page);
  await page.setViewportSize({width:390,height:844});
  for(const path of ['/marketing/descuentos','/productos/categorias','/finanzas/monedas','/administracion/canales','/productos/catalogo']) {
    await page.goto(path);
    await expect(page.getByRole('button',{name:'Actualizar',exact:true})).toBeVisible();
    await expect(page.locator('main')).not.toContainText('Cargando datos…');
    if(path==='/productos/catalogo') {
      await page.locator('.product-card').first().click();
      await expect(page.locator('.product-details')).toBeVisible();
      await page.screenshot({path:'artifacts/editor-producto-mobile.png',fullPage:true});
    }
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),path).toBe(true);
  }
});
