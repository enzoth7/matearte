import { test, expect, type Page } from "@playwright/test";
import { mockCommerce } from "./commerce-fixture";
import { mateAssemblyFields } from "../../shared/mate-assembly";

async function assemble(page: Page, changes: Record<string, string> = {}) {
  await page.goto('/comercial/registrar-min');
  await page.getByRole('tab', { name: 'Personalizados' }).click();
  await page.getByLabel('Categoría de artículo').selectOption('mate');
  const builder = page.locator('#local-panel-custom > .local-custom-builder');
  const values: Record<string,string> = { 'tipo-mate':'imperial', interior:'ceramica', 'tipo-cuero':'croco', color:'mostaza-chocolate', 'tipo-virola':'alpaca-y-bronce', 'diseno-fleje':'laureles', posamate:'con-posamate', pie:'alpaca', tamano:'grande', ...changes };
  for (const field of mateAssemblyFields) if (values[field.code]) await builder.getByLabel(field.label, { exact:true }).selectOption(values[field.code]);
  return builder;
}

test('arma por piezas sin catálogo y conserva diseño y precio en venta y producción', async ({ page }) => {
  const {fixture,writes,tables} = await mockCommerce(page, {writable:true});
  fixture.products.splice(0);
  const builder=await assemble(page);
  await expect(builder).not.toContainText('variante compatible');
  for (const code of ['tipo-cuero','color','tipo-virola','pie']) {
    const field=mateAssemblyFields.find(f=>f.code===code)!;
    await expect(builder.getByLabel(field.label,{exact:true}).locator('option')).toHaveCount(field.options.length+1);
  }
  await expect(builder.getByLabel('Precio del armado')).toContainText('4.500');
  await builder.screenshot({path:'test-results/assembly-desktop.png'});
  await builder.getByRole('button',{name:/Agregar personalizado/}).click();
  await page.getByLabel('Texto de virola de Mate Imperial personalizado').fill('ENZO');
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
  await page.getByLabel('Terminación de fleje de Mate Imperial personalizado').selectOption('pattern-1');
  await page.setViewportSize({width:390,height:844});
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.locator('.local-personalization-card').screenshot({path:'test-results/assembly-mobile.png'});
  await page.getByRole('button',{name:'Guardar venta'}).click();
  await expect.poll(()=>writes.some(w=>w.table==='gestion_create_local_sale_with_items')).toBe(true);
  const item=writes.find(w=>w.table==='gestion_create_local_sale_with_items')!.body.p_items[0];
  expect(item.item_kind).toBe('custom_mate'); expect(item.variant_id).toBeNull();
  expect(item.unit_price_minor).toBe(468000);
  expect(item.customization.assembly.selections).toMatchObject({'tipo-cuero':'croco',color:'mostaza-chocolate',pie:'alpaca'});
  expect(item.customization.configuration.rim.texts[0].text).toBe('ENZO');
  expect(item.customization.previews.map((preview: {role:string}) => preview.role)).toEqual(['virola','fleje_front','fleje_back']);
  expect(item.customization.previews.every((preview: {byte_size:number}) => preview.byte_size > 1000)).toBe(true);
  expect(item.customization.configuration.rim.icons).toHaveLength(2);
  expect(new Set(item.customization.configuration.rim.icons.map((icon: {id:string}) => icon.id)).size).toBe(2);
  expect(item.customization.flejeConfiguration.sides.front.text).toBe('MATE');
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
  expect(rimBox!.width).toBeLessThanOrEqual(301);
  expect(flejeBoxes[0].x).toBe(flejeBoxes[1].x);
  expect(flejeBoxes[1].y).toBeGreaterThan(flejeBoxes[0].y);
  await page.locator('.local-production-views').screenshot({path:'test-results/production-layout.png'});
});

test('cambiar piezas conserva elecciones y sin virola permite guardar sin grabado',async({page})=>{
  const {writes}=await mockCommerce(page,{writable:true});
  const builder=await assemble(page,{'tipo-virola':'sin-virola','diseno-fleje':'sin-fleje'});
  await builder.getByLabel('Cuero o textura').selectOption('pelos');
  await expect(builder.getByLabel('Color',{exact:true})).toHaveValue('mostaza-chocolate');
  await expect(builder.getByLabel('Pie',{exact:true})).toHaveValue('alpaca');
  await builder.getByRole('button',{name:/Agregar personalizado/}).click();
  await expect(page.getByRole('navigation',{name:/Pasos del diseño/}).getByRole('button',{name:/Virola/})).toHaveCount(0);
  await page.getByRole('button',{name:'Guardar venta'}).click();
  await expect.poll(()=>writes.some(w=>w.table==='gestion_create_local_sale_with_items')).toBe(true);
});

test('una tarifa ausente bloquea el cobro y muestra precio pendiente',async({page})=>{
  await mockCommerce(page,{writable:true});
  const rules=Object.fromEntries(mateAssemblyFields.flatMap(f=>f.options.map(o=>[o.ruleKey,o.initialPrice])));
  delete rules['assembly:pie:alpaca'];
  await page.route('**/rpc/get_published_pricing_catalog',route=>route.fulfill({json:{versionId:'price',version:1,rules}}));
  const builder=await assemble(page);
  await expect(builder).toContainText('Precio pendiente');
  await expect(builder.getByRole('button',{name:/Agregar personalizado/})).toBeDisabled();
});
