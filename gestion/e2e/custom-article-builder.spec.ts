import { test, expect, type Page } from "@playwright/test";
import { mockCommerce } from "./commerce-fixture";
import { mateAssemblyFields } from "../../shared/mate-assembly";

async function assemble(page: Page, changes: Record<string, string> = {}) {
  await page.goto('/comercial/registrar-min');
  await page.getByRole('tab', { name: 'Personalizados' }).click();
  await page.getByLabel('Categoría de artículo').selectOption('mate');
  const builder = page.locator('#local-panel-custom > .local-custom-builder');
  const values: Record<string,string> = { 'tipo-mate':'imperial', interior:'ceramica', 'tipo-cuero':'croco', color:'mostaza-chocolate', 'tipo-virola':'alpaca-y-bronce', posamate:'con-posamate', pie:'alpaca', tamano:'grande', ...changes };
  for (const field of mateAssemblyFields.filter(field => ['tipo-mate', 'forma-criollo', 'tipo-cuero'].includes(field.code))) if (values[field.code]) await builder.getByLabel(field.label, { exact:true }).selectOption(values[field.code]);
  return builder;
}

async function completeMaterials(page: Page, changes: Record<string, string> = {}) {
  const values: Record<string,string> = { interior:'ceramica', color:'mostaza-chocolate', 'tipo-virola':'alpaca-y-bronce', posamate:'con-posamate', pie:'alpaca', tamano:'grande', ...changes };
  const card = page.locator('.local-personalization-card').first();
  await card.getByRole('navigation', { name: /Pasos del diseño/ }).getByRole('button', { name: /Materiales/ }).click();
  for (const field of mateAssemblyFields) if (values[field.code]) await card.getByLabel(field.label, { exact:true }).selectOption(values[field.code]);
  return card;
}

test('registra el fleje una sola vez desde el paso de diseño', async ({ page }) => {
  const { writes } = await mockCommerce(page, { writable: true });
  const builder = await assemble(page);
  await builder.getByRole('button', { name: /Agregar personalizado/ }).click();
  const card = await completeMaterials(page);
  await expect(card.getByLabel('Diseño del fleje', { exact: true })).toHaveCount(0);
  await card.getByRole('navigation', { name: /Pasos del diseño/ }).getByRole('button', { name: /Virola/ }).click();
  await card.getByLabel('Texto de virola de Mate Imperial personalizado').fill('ENZO');
  await card.getByRole('navigation', { name: /Pasos del diseño/ }).getByRole('button', { name: /Fleje/ }).click();
  await card.getByLabel('Técnica de fleje de Mate Imperial personalizado').selectOption('bronze-applique');
  await card.getByLabel('Terminación de fleje de Mate Imperial personalizado').selectOption('1');
  await card.getByLabel('Texto del frente del fleje de Mate Imperial personalizado').fill('MATE');
  await page.getByRole('button', { name: 'Guardar venta' }).click();
  await expect.poll(() => writes.some(write => write.table === 'gestion_create_local_sale_with_items')).toBe(true);
  const item = writes.find(write => write.table === 'gestion_create_local_sale_with_items')!.body.p_items[0];
  expect(item.customization.assembly.selections).not.toHaveProperty('diseno-fleje');
  expect(item.customization.configuration.selectionLabels.characteristics).not.toHaveProperty('diseno-fleje');
  expect(item.customization.flejeConfiguration.finishId).toBe('1');
  expect(item.customization.flejeConfiguration.sides.front.text).toBe('MATE');
});

test('bombillones se eligen por nombre y conservan el precio de su artículo', async ({ page }) => {
  const { fixture, writes, tables } = await mockCommerce(page, { writable: true });
  const template = fixture.products[0];
  const variant = template.commerce_variants[0];
  tables.commerce_attribute_options.push({ attribute_code: 'tipo-bombilla', code: 'clasica', label_es: 'Fina' });
  for (const [name, sku, price] of [
    ['Bombillón Pico Alpaca', '318', 120000],
    ['Bombillón Con Aros Pico Alpaca', '319', 130000],
  ] as const) fixture.products.push({
    ...template, id: `product-${sku}`, name, category: 'bombillas', category_code: 'bombillas',
    attributes: { 'tipo-bombilla': 'bombillon' }, commerce_product_images: [],
    commerce_variants: [{ ...variant, id: `variant-${sku}`, sku, name: 'Metálico', color: 'metalico',
      option_values: { color: 'metalico' }, price_minor: price, base_price_minor: price }],
  });
  fixture.products.push({
    ...template, id: 'product-fina', name: 'Bombilla Cincelada', category: 'bombillas', category_code: 'bombillas',
    attributes: { 'tipo-bombilla': 'clasica' }, commerce_product_images: [],
    commerce_variants: [{ ...variant, id: 'variant-fina', sku: '320', name: 'Metálico', color: 'metalico',
      option_values: { color: 'metalico' }, price_minor: 95000, base_price_minor: 95000 }],
  });

  await page.goto('/comercial/registrar-min');
  await page.getByRole('tab', { name: 'Personalizados' }).click();
  await page.getByLabel('Categoría de artículo').selectOption('bombilla');
  const builder = page.locator('#local-panel-custom > .local-custom-builder');
  await expect(builder.getByLabel('Modelo', { exact: true })).toContainText('Fina');
  await expect(builder.getByLabel('Modelo', { exact: true })).not.toContainText('Clásica');
  await builder.getByLabel('Modelo', { exact: true }).selectOption({ index: 1 });
  await expect(builder.getByLabel('Color', { exact: true })).toHaveCount(0);
  await expect(builder.getByLabel('Precio base', { exact: true })).toHaveCount(0);
  const names = builder.getByLabel('Nombre', { exact: true });
  await expect(names.locator('option')).toHaveText([
    'Elegir nombre', 'Bombillón Con Aros Pico Alpaca', 'Bombillón Pico Alpaca',
  ]);
  await expect(builder.getByRole('button', { name: /Agregar personalizado/ })).toBeDisabled();
  await names.selectOption('variant-319');
  await expect(builder.getByRole('button', { name: /Agregar personalizado/ })).toContainText('1.300');
  await builder.getByRole('button', { name: /Agregar personalizado/ }).click();
  const technique = page.getByLabel('Técnica de Bombillón Con Aros Pico Alpaca');
  await expect(technique.locator('option')).toHaveText(['Elegir técnica', 'Aplique de bronce', 'Aplique de alpaca']);
  await expect(page.getByLabel('Ubicación de Bombillón Con Aros Pico Alpaca')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Guardar venta' })).toBeDisabled();
  await technique.selectOption('bronze-applique');
  await page.getByLabel('Texto de Bombillón Con Aros Pico Alpaca').fill('ANA');
  await expect(page.getByLabel('Precio de Bombillón Con Aros Pico Alpaca')).not.toContainText('Grabado láser');
  await page.getByRole('button', { name: 'Guardar venta' }).click();
  await expect.poll(() => writes.some(write => write.table === 'gestion_create_local_sale_with_items')).toBe(true);
  const item = writes.find(write => write.table === 'gestion_create_local_sale_with_items')!.body.p_items[0];
  expect(item.variant_id).toBe('variant-319');
  expect(item.unit_price_minor).toBe(137500);
  expect(item.customization.localPersonalization).not.toHaveProperty('placement');
});

test('arma por piezas sin catálogo y conserva diseño y precio en venta y producción', async ({ page }) => {
  const {fixture,writes,tables} = await mockCommerce(page, {writable:true});
  fixture.products.splice(0);
  const builder=await assemble(page);
  await expect(builder).not.toContainText('variante compatible');
  await expect(builder.getByLabel('Precio rápido del mate')).toContainText('3.200');
  await builder.getByRole('button',{name:/Agregar personalizado/}).click();
  const card = await completeMaterials(page);
  await expect(card.getByLabel('Diseño del fleje', { exact: true })).toHaveCount(0);
  for (const code of ['tipo-cuero','color','tipo-virola','pie']) {
    const field=mateAssemblyFields.find(f=>f.code===code)!;
    await expect(card.getByLabel(field.label,{exact:true}).locator('option')).toHaveCount(field.options.length+1);
  }
  await expect(card.getByLabel('Precio del armado')).toContainText('4.500');
  await card.screenshot({path:'test-results/assembly-desktop.png'});
  await card.getByRole('navigation', { name: /Pasos del diseño/ }).getByRole('button', { name: /Virola/ }).click();
  await page.getByLabel('Texto de virola de Mate Imperial personalizado').fill('ENZO');
  await page.getByLabel('Texto 2 para la virola de Mate Imperial personalizado').fill('MATE');
  const rimPreview = card.getByLabel('Vista editable de la virola imperial');
  await rimPreview.locator('[data-rim-text-id="text-1"] path[stroke="transparent"]').click();
  await rimPreview.getByRole('button', { name: 'Invertir el texto y ponerlo abajo' }).click();
  await expect.poll(() => page.locator('.local-design-icons img').evaluateAll(images => images.length > 0 && images.every(image => (image as HTMLImageElement).naturalWidth > 0))).toBe(true);
  await page.locator('.local-design-icons button').nth(1).click();
  await page.locator('.local-design-icons button').nth(2).click();
  await expect(page.getByLabel('Precio unitario de Mate Imperial personalizado')).toHaveValue(/4\.620/);
  const breakdown = page.getByLabel('Desglose de Mate Imperial personalizado');
  await expect(breakdown).toContainText('Grabado láser en virola');
  await expect(breakdown).toContainText('4.620');
  await page.getByRole('navigation',{name:/Pasos del diseño/}).getByRole('button',{name:/Fleje/}).click();
  await page.getByLabel('Técnica de fleje de Mate Imperial personalizado').selectOption('bronze-applique');
  await page.getByLabel('Texto del frente del fleje de Mate Imperial personalizado').fill('MATE');
  await page.getByLabel('Terminación de fleje de Mate Imperial personalizado').selectOption('1');
  const finishOverlay = card.locator('.fleje-preview-side').first().locator('svg image[href$="/1.webp"]');
  await expect(finishOverlay).toHaveCount(1);
  const finishUrl = await finishOverlay.getAttribute('href');
  expect((await page.request.get(new URL(finishUrl!, page.url()).toString())).status()).toBe(200);
  await page.setViewportSize({width:390,height:844});
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.locator('.local-personalization-card').screenshot({path:'test-results/assembly-mobile.png'});
  await page.getByRole('button',{name:'Guardar venta'}).click();
  await expect.poll(()=>writes.some(w=>w.table==='gestion_create_local_sale_with_items'), { timeout: 20_000 }).toBe(true);
  const item=writes.find(w=>w.table==='gestion_create_local_sale_with_items')!.body.p_items[0];
  expect(item.item_kind).toBe('custom_mate'); expect(item.variant_id).toBeNull();
  expect(item.unit_price_minor).toBe(468000);
  expect(item.customization.assembly.selections).toMatchObject({'tipo-cuero':'croco',color:'mostaza-chocolate',pie:'alpaca'});
  expect(item.customization.assembly.selections).not.toHaveProperty('diseno-fleje');
  expect(item.customization.configuration.selectionLabels.characteristics).not.toHaveProperty('diseno-fleje');
  expect(item.customization.configuration.rim.texts[0].text).toBe('ENZO');
  expect(item.customization.configuration.rim.texts).toMatchObject([{ text: 'ENZO', inverted: true }, { text: 'MATE', inverted: false }]);
  expect(item.customization.previews.map((preview: {role:string}) => preview.role)).toEqual(['virola','fleje_front','fleje_back']);
  expect(item.customization.previews.every((preview: {byte_size:number}) => preview.byte_size > 1000)).toBe(true);
  expect(item.customization.configuration.rim.icons).toHaveLength(2);
  expect(new Set(item.customization.configuration.rim.icons.map((icon: {id:string}) => icon.id)).size).toBe(2);
  expect(item.customization.flejeConfiguration.sides.front.text).toBe('MATE');
  expect(item.customization.flejeConfiguration.finishId).toBe('1');
  await expect(page.getByRole('dialog')).toContainText('Mate Imperial personalizado');
  tables.local_sales[0].local_sale_items[0].customization.previews = [];
  await page.setViewportSize({width:1440,height:1100});
  await page.goto('/produccion/personalizados');
  await page.getByRole('row').filter({hasText:'#L001'}).getByRole('button',{name:'Ver detalle del pedido #L001'}).click();
  await expect(page.getByRole('dialog')).toContainText(/Mate Imperial personalizado/i);
  await page.getByRole('dialog').getByRole('tab',{name:'Producción'}).click();
  await expect(page.getByRole('dialog')).toContainText('Croco');
  await expect(page.getByRole('dialog')).toContainText('Mostaza/Chocolate');
  await expect(page.locator('.local-production-rim')).toBeVisible();
  const rimBox = await page.locator('.local-production-rim').boundingBox();
  const flejeBoxes = await page.locator('.local-production-fleje').evaluateAll(nodes => nodes.map(node => { const r = node.getBoundingClientRect(); return {x:r.x,y:r.y}; }));
  expect(rimBox!.width).toBeGreaterThan(301);
  expect(flejeBoxes[0].x).toBeGreaterThan(rimBox!.x);
  expect(flejeBoxes[1].x).toBeGreaterThan(flejeBoxes[0].x);
  expect(flejeBoxes[0].y).toBe(flejeBoxes[1].y);
  await page.locator('.recovered-production-views').screenshot({path:'test-results/production-layout.png'});
});

test('ofrece Pétalos en la virola de una venta minorista personalizada', async ({ page }) => {
  await mockCommerce(page, { writable: true });
  const builder = await assemble(page);
  await builder.getByRole('button', { name: /Agregar personalizado/ }).click();
  const card = page.locator('.local-personalization-card').first();
  await card.getByRole('navigation', { name: /Pasos del diseño/ }).getByRole('button', { name: /Virola/ }).click();
  await page.getByLabel('Terminación de virola de Mate Imperial personalizado').selectOption('petalos');
  const finishImage = card.getByLabel('Vista editable de la virola imperial').locator('svg image[href$="/petalos.webp"]');
  await expect(finishImage).toHaveCount(1);
  const finishUrl = await finishImage.getAttribute('href');
  expect((await page.request.get(new URL(finishUrl!, page.url()).toString())).status()).toBe(200);
  await page.getByLabel('Técnica de virola de Mate Imperial personalizado').selectOption('bronze-applique');
  const finishSelect = page.getByLabel('Terminación de virola de Mate Imperial personalizado');
  await expect(finishSelect).toHaveValue('none');
  await expect(finishSelect.locator('option', { hasText: 'Laureles' })).toHaveCount(1);
  await expect(finishSelect.locator('option', { hasText: 'Pétalos' })).toHaveCount(1);
  await finishSelect.selectOption('applique-finish-petalos');
  await expect(finishImage).toHaveCount(1);
  await finishSelect.selectOption('applique-finish-puntas-cinceladas');
  const cinceladoImage = card.getByLabel('Vista editable de la virola imperial').locator('svg image[href$="/apliques-05-puntas-cinceladas.webp"]');
  await expect(cinceladoImage).toHaveCount(1);
  const cinceladoUrl = await cinceladoImage.getAttribute('href');
  expect((await page.request.get(new URL(cinceladoUrl!, page.url()).toString())).status()).toBe(200);
  await finishSelect.selectOption('applique-finish-cadenas');
  const cadenasImage = card.getByLabel('Vista editable de la virola imperial').locator('svg image[href$="/apliques-06-cadenas.webp"]');
  await expect(cadenasImage).toHaveCount(1);
  const cadenasUrl = await cadenasImage.getAttribute('href');
  expect((await page.request.get(new URL(cadenasUrl!, page.url()).toString())).status()).toBe(200);
  await finishSelect.selectOption('applique-finish-coronas-2');
  const coronas2Image = card.getByLabel('Vista editable de la virola imperial').locator('svg image[href$="/apliques-07-coronas-2.webp"]');
  await expect(coronas2Image).toHaveCount(1);
  const coronas2Url = await coronas2Image.getAttribute('href');
  expect((await page.request.get(new URL(coronas2Url!, page.url()).toString())).status()).toBe(200);
});

test('cambiar piezas conserva elecciones y sin virola permite guardar sin grabado',async({page})=>{
  const {writes}=await mockCommerce(page,{writable:true});
  const builder=await assemble(page,{'tipo-cuero':'pelos'});
  await builder.getByRole('button',{name:/Agregar personalizado/}).click();
  const card = await completeMaterials(page,{'tipo-virola':'sin-virola'});
  await expect(card.getByLabel('Cuero o textura')).toHaveValue('pelos');
  await expect(card.getByLabel('Color',{exact:true})).toHaveValue('mostaza-chocolate');
  await expect(card.getByLabel('Pie',{exact:true})).toHaveValue('alpaca');
  await expect(page.getByRole('navigation',{name:/Pasos del diseño/}).getByRole('button',{name:/Virola/})).toHaveCount(0);
  await page.getByRole('button',{name:'Guardar venta'}).click();
  await expect.poll(()=>writes.some(w=>w.table==='gestion_create_local_sale_with_items')).toBe(true);
});

test('una tarifa ausente bloquea el cobro y muestra tarifa no disponible',async({page})=>{
  await mockCommerce(page,{writable:true});
  const rules=Object.fromEntries(mateAssemblyFields.flatMap(f=>f.options.map(o=>[o.ruleKey,o.initialPrice])));
  delete rules['assembly:pie:alpaca'];
  await page.route('**/rpc/get_published_pricing_catalog',route=>route.fulfill({json:{versionId:'price',version:1,rules}}));
  const builder=await assemble(page);
  await expect(builder.getByLabel('Precio rápido del mate')).toContainText('3.200');
  await builder.getByRole('button',{name:/Agregar personalizado/}).click();
  const card = await completeMaterials(page);
  await expect(card.getByLabel('Precio del armado')).toContainText('Tarifa no disponible');
  await expect(page.getByRole('button',{name:'Guardar venta'})).toBeDisabled();
});

test('el descuento aplica solo a los personalizados: precio original tachado, nuevo precio y payload con porcentaje', async ({ page }) => {
  const { fixture, writes } = await mockCommerce(page, { writable: true });
  fixture.products.splice(0);
  const builder = await assemble(page);
  await expect(page.getByLabel('Aplicar descuento a personalizados')).toHaveCount(0);
  await builder.getByRole('button', { name: /Agregar personalizado/ }).click();
  const card = await completeMaterials(page);
  await card.getByRole('navigation', { name: /Pasos del diseño/ }).getByRole('button', { name: /Virola/ }).click();
  await page.getByLabel('Texto de virola de Mate Imperial personalizado').fill('ENZO');
  await expect.poll(() => page.locator('.local-design-icons img').evaluateAll(images => images.length > 0 && images.every(image => (image as HTMLImageElement).naturalWidth > 0))).toBe(true);
  const footer = page.locator('.local-sale-footer');
  await expect(footer.locator('s')).toHaveCount(0);
  await page.getByLabel('Aplicar descuento a personalizados').selectOption('si');
  await page.getByRole('spinbutton', { name: 'Porcentaje de descuento' }).fill('10');
  const listUnit = Number((await page.getByLabel('Precio unitario de Mate Imperial personalizado').inputValue()).replace(/[^\d]/g, ''));
  await expect(footer.locator('s')).toBeVisible();
  await expect(footer).toContainText('-10%');
  await page.getByRole('button', { name: 'Guardar venta' }).click();
  await expect.poll(() => writes.some(w => w.table === 'gestion_create_local_sale_with_items')).toBe(true);
  const item = writes.find(w => w.table === 'gestion_create_local_sale_with_items')!.body.p_items[0];
  expect(item.discount_percent).toBe(10);
  expect(item.customization.discount.percent).toBe(10);
  expect(item.unit_price_minor).toBe(Math.round(item.customization.discount.listUnitPriceMinor * 90 / 100));
  expect(item.customization.discount.listUnitPriceMinor).toBeGreaterThan(item.unit_price_minor);
  expect(listUnit).toBeGreaterThan(0);
});
