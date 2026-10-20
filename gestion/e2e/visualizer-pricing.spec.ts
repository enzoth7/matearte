import { expect, test } from '@playwright/test';
import { mockCommerce } from './commerce-fixture';

test('Configurador Visualizador configura y publica los precios del mismo Visualizador', async ({ page }) => {
  await mockCommerce(page);
  const calls: string[] = [];
  const state = {
    definitions: [
      { rule_key: 'family:camionero', rule_type: 'family', label: 'Camionero', value_kind: 'uyu', family_id: 'camionero', texture_id: null, customization_id: null, required: true, active: true, sort_order: 1 },
      { rule_key: 'leather:raw', rule_type: 'texture', label: 'Cuero crudo', value_kind: 'uyu', family_id: null, texture_id: null, customization_id: null, required: true, active: true, sort_order: 2 },
      { rule_key: 'customization:laser:rim_text', rule_type: 'customization', label: 'Texto láser', value_kind: 'uyu', family_id: null, texture_id: null, customization_id: 'laser:rim_text', required: true, active: true, sort_order: 3 },
      { rule_key: 'commission:mercado_pago', rule_type: 'commission', label: 'Mercado Pago', value_kind: 'percent', family_id: null, texture_id: null, customization_id: null, required: true, active: true, sort_order: 4 },
    ],
    draft: { id: 'draft-1', version: 2, status: 'draft', updatedAt: '2026-10-20T10:00:00Z', publishedAt: null, values: { 'family:camionero': 1000, 'leather:raw': 100, 'customization:laser:rim_text': 300, 'commission:mercado_pago': 6 } },
    published: { id: 'published-1', version: 1, status: 'published', updatedAt: '2026-10-19T10:00:00Z', publishedAt: '2026-10-19T10:00:00Z', values: { 'family:camionero': 1000, 'leather:raw': 100, 'customization:laser:rim_text': 300, 'commission:mercado_pago': 6 } },
  };
  await page.route('**/rest/v1/rpc/*pricing*', async (route) => {
    const rpc = new URL(route.request().url()).pathname.split('/').at(-1)!;
    calls.push(rpc);
    if (rpc === 'save_pricing_draft') {
      state.draft.values = route.request().postDataJSON().p_values;
      state.draft.updatedAt = '2026-10-20T10:01:00Z';
    }
    if (rpc === 'publish_pricing_draft') {
      state.published.values = { ...state.draft.values };
      state.published.updatedAt = '2026-10-20T10:02:00Z';
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(state) });
  });

  await page.goto('/productos/personalizador');
  const productNavigation = page.getByRole('navigation', { name: 'Subáreas de Productos' });
  await expect(productNavigation.getByRole('link', { name: 'Configurador Visualizador' })).toHaveAttribute('aria-current', 'page');
  await expect(productNavigation.getByRole('link', { name: 'Configurador Visualizador' })).toHaveAttribute('href', '/productos/personalizador');
  await expect(page.getByRole('navigation', { name: 'Subáreas de Producción' }).getByRole('link', { name: 'Configurador Visualizador' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Configurador Visualizador', level: 1 })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Pedidos personalizados' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Precios del Visualizador' })).toHaveCount(0);
  await expect(page.getByText('CONTROL DE PRECIOS')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Abrir Visualizador' })).toHaveCount(0);
  await expect(page.locator('.visualizer-pricing__summary')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Todos los parámetros' })).toBeVisible();
  await expect(page.locator('.visualizer-configurator span, .visualizer-configurator p, .visualizer-configurator [class*="eyebrow"]')).toHaveCount(0);
  await expect(page.getByLabel('Cuero crudo')).toBeVisible();
  await expect(page.getByLabel('Texto láser')).toBeVisible();
  await expect(page.getByLabel('Mercado Pago')).toBeVisible();
  const pricingLayout = await page.locator('.visualizer-pricing__groups').evaluate((element) => getComputedStyle(element).display);
  expect(pricingLayout).toBe('grid');
  await page.getByRole('searchbox', { name: 'Buscar precios del Visualizador' }).fill('cuero');
  await expect(page.getByLabel('Cuero crudo')).toBeVisible();
  await expect(page.getByLabel('Texto láser')).toHaveCount(0);
  await page.getByRole('button', { name: 'Limpiar búsqueda' }).click();
  await page.getByRole('spinbutton', { name: 'Camionero' }).fill('1500');
  await expect(page.getByRole('button', { name: 'Publicar precios' })).toBeDisabled();
  await page.getByRole('button', { name: 'Guardar borrador' }).click();
  await expect(page.getByText('Borrador guardado. Los precios publicados todavía no cambiaron.')).toBeVisible();
  await page.getByRole('button', { name: 'Publicar precios' }).click();
  await page.getByRole('button', { name: 'Confirmar publicación' }).click();
  await expect(page.getByText(/Precios publicados/)).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('heading', { name: 'Todos los parámetros' })).toBeVisible();
  const mobileLayout = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth > window.innerWidth,
    searchDirection: getComputedStyle(document.querySelector('.visualizer-pricing__search')!).flexDirection,
  }));
  expect(mobileLayout).toEqual({ overflow: false, searchDirection: 'row' });
  expect(calls).toEqual(['get_pricing_admin_state', 'save_pricing_draft', 'publish_pricing_draft']);
});

test('no abre la configuración si la cuenta no administra precios', async ({ page }) => {
  await mockCommerce(page);
  await page.route('**/rest/v1/rpc/get_pricing_admin_state', async (route) => {
    await route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ message: 'not authorized' }) });
  });
  await page.goto('/productos/personalizador');
  await expect(page.getByRole('heading', { name: 'No se pudo abrir la configuración' })).toBeVisible();
  await expect(page.getByText('Tu cuenta no tiene permiso para administrar los precios del Visualizador.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Publicar precios' })).toHaveCount(0);
});

test('mantiene el Configurador Visualizador accesible si falla la carga de pedidos', async ({ page }) => {
  await mockCommerce(page, { failure: true });
  await page.route('**/rest/v1/rpc/get_pricing_admin_state', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      definitions: [],
      draft: { id: 'draft-1', version: 2, updatedAt: '2026-10-20T10:00:00Z', values: {} },
      published: { id: 'published-1', version: 1, updatedAt: '2026-10-19T10:00:00Z', values: {} },
    }) });
  });
  await page.goto('/productos/personalizador');
  await expect(page.getByText('Lectura interrumpida')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Configurador Visualizador', level: 1 })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Todos los parámetros' })).toBeVisible();
});

test('la ruta anterior lleva a Productos y ya no figura en Producción', async ({ page }) => {
  await mockCommerce(page, { writable: true });
  await page.goto('/produccion/personalizados');
  await expect(page.getByRole('navigation', { name: 'Subáreas de Producción' }).getByRole('link', { name: 'Configurador Visualizador' })).toHaveCount(0);
  await page.goto('/produccion/configurador-visualizador');
  await expect(page).toHaveURL(/\/productos\/personalizador$/);
  await expect(page.getByRole('navigation', { name: 'Subáreas de Productos' }).getByRole('link', { name: 'Configurador Visualizador' })).toHaveAttribute('aria-current', 'page');
});

test('la falta de una columna opcional de personalizados no deja todo Gestión en blanco', async ({ page }) => {
  await mockCommerce(page);
  let fallbackCalls = 0;
  await page.route('**/rest/v1/local_sales?*', async (route) => {
    const select = new URL(route.request().url()).searchParams.get('select') || '';
    if (!select.includes('customization')) return route.fallback();
    fallbackCalls += 1;
    await route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ code: '42703', message: 'column local_sale_items_1.customization does not exist' }) });
  });
  await page.goto('/produccion/personalizados');
  await expect(page.getByRole('heading', { name: 'Pedidos personalizados', level: 1 })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Configurar Visualizador' })).toHaveCount(0);
  await expect(page.getByText('Los datos no se pudieron cargar.')).toHaveCount(0);
  expect(fallbackCalls).toBeGreaterThan(0);
});

test('permite editar y publicar opciones del catálogo sin alterar los IDs', async ({ page }) => {
  await mockCommerce(page, { writable: true });
  const calls: string[] = [];
  const catalog = {
    draft: { id: 'draft-catalog', version: 2, updatedAt: '2026-10-20T10:00:00Z', document: {} as Record<string, unknown> },
    published: { id: 'published-catalog', version: 1, updatedAt: '2026-10-19T10:00:00Z', document: {} as Record<string, unknown> },
  };
  await page.route('**/rest/v1/rpc/*visualizer_catalog*', async (route) => {
    const rpc = new URL(route.request().url()).pathname.split('/').at(-1)!;
    calls.push(rpc);
    if (rpc === 'save_visualizer_catalog_draft') {
      catalog.draft.document = route.request().postDataJSON().p_document;
      catalog.draft.updatedAt = '2026-10-20T10:01:00Z';
    }
    if (rpc === 'publish_visualizer_catalog_draft') {
      catalog.published.document = structuredClone(catalog.draft.document);
      catalog.published.updatedAt = '2026-10-20T10:02:00Z';
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(catalog) });
  });
  await page.goto('/productos/personalizador');
  await page.getByRole('button', { name: 'Modelos, colores e imágenes' }).click();
  await expect(page.getByRole('heading', { name: 'Opciones del Visualizador' })).toHaveCount(0);
  await expect(page.locator('.visualizer-pricing__summary')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Abrir Visualizador' })).toBeVisible();
  await expect(page.locator('.visualizer-configurator span, .visualizer-configurator p, .visualizer-configurator [class*="eyebrow"]')).toHaveCount(0);
  await expect.poll(() => page.locator('.visualizer-catalog__image img').first().evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
  await expect(page.getByRole('heading', { name: 'Colores' })).toBeVisible();
  const colorRows = page.locator('.visualizer-catalog__color-row');
  expect(await colorRows.count()).toBeGreaterThan(1);
  const firstColor = await colorRows.nth(0).boundingBox();
  const secondColor = await colorRows.nth(1).boundingBox();
  expect(firstColor).not.toBeNull();
  expect(secondColor).not.toBeNull();
  expect(secondColor!.x).toBe(firstColor!.x);
  expect(secondColor!.y).toBeGreaterThan(firstColor!.y + firstColor!.height);
  const model = page.locator('.visualizer-catalog__card').first();
  await model.getByRole('textbox', { name: 'Nombre' }).fill('Camionero especial');
  await model.locator('input[type="file"]').setInputFiles({
    name: 'camionero.png', mimeType: 'image/png',
    buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/X1cAAAAASUVORK5CYII=', 'base64'),
  });
  await page.getByRole('tab', { name: 'Técnicas de personalización' }).click();
  await page.locator('.visualizer-catalog__technique-card').first().getByRole('checkbox', { name: 'Láser' }).first().uncheck();
  await expect(page.getByRole('button', { name: 'Publicar catálogo' })).toBeDisabled();
  await page.getByRole('button', { name: 'Guardar borrador' }).click();
  await page.getByRole('button', { name: 'Publicar catálogo' }).click();
  await page.getByRole('button', { name: 'Confirmar publicación' }).click();
  expect(catalog.published.document).toMatchObject({ families: { camionero: { label: 'Camionero especial' } } });
  expect((catalog.published.document as any).families.camionero.image).toContain('/visualizer-catalog/catalog/');
  expect((catalog.published.document as any).textures['camionero::alpaca-cincelado-patas'].virola).not.toContain('laser');
  await expect(page.getByRole('heading', { name: 'Disponibilidad por construcción' })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
  expect(calls).toEqual(['get_visualizer_catalog_admin_state', 'save_visualizer_catalog_draft', 'publish_visualizer_catalog_draft']);
});
