import { test, expect, type Page } from '@playwright/test';
import { mockCommerce } from './commerce-fixture';
for (const userId of ['deeec8ea-ace6-4f0a-a578-17751a83f707', '5afbc94d-aecf-44e8-b12e-e136f49abb62', 'another-director']) {
 test(`Logs pendiente de activación con cuenta ${userId}`, async ({ page }) => {
   await mockCommerce(page, { userId });
   let dataRequests = 0;
   await page.route('**/rest/v1/rpc/gestion_logs_*', async route => {
     if (!route.request().url().endsWith('gestion_logs_context')) dataRequests++;
     return route.fulfill({ status: 404, json: { code: 'PGRST202', message: 'Function not found' } });
   });
   await page.goto('/administracion/links');
   await expect(page.getByRole('heading', { name: 'Links', exact: true }).first()).toBeVisible();
   const link = page.getByRole('link', { name: 'Logs', exact: true });
   if (userId === 'another-director') {
     await expect(link).toHaveCount(0);
   } else {
     await expect(link).toBeVisible();
     await link.click();
     await expect(page.getByRole('heading', { name: 'Pendiente de activación' })).toBeVisible();
     await expect(page.getByText('El registro todavía no está activo', { exact: false })).toBeVisible();
   }
   expect(dataRequests).toBe(0);
 });
}
const users = [
 { id: 'enzo', name: 'Enzo Thome', accessId: 't1' }, { id: 'richard', name: 'Richard Ortiz', accessId: 't1' },
 { id: 'costa', name: 'Florencia Costa', accessId: 't2' }, { id: 'pizzorno', name: 'Florencia Pizzorno', accessId: 't3' },
 { id: 'marketing', name: 'Marketing', accessId: 't5' },
];
async function mockLogs(page: Page, allowed = true, empty = false, reference = '#R004: Mate Imperial, #R006: Bombillon') {
 const requests: Record<string, any>[] = [];
 await page.route('**/rest/v1/rpc/gestion_logs_*', async route => {
   const rpc = new URL(route.request().url()).pathname.split('/').at(-1);
   if (rpc === 'gestion_logs_context') return route.fulfill({ json: { canViewLogs: allowed, users, activatedAt: '2026-11-05T17:00:00Z' } });
   if (!allowed) return route.fulfill({ status: 403, json: { message: 'No tenés acceso a Logs' } });
   const body = route.request().postDataJSON();
   if (rpc === 'gestion_logs_list') {
     requests.push(body);
     if (empty) return route.fulfill({ json: { total: 0, groups: [] } });
     return route.fulfill({ json: { total: 51, groups: [{ group_id: 'tx:1', occurred_at: '2026-11-05T17:29:00Z', actor_name: 'Florencia Costa', source: 'gestion', attention: true, event_count: 2, reference, operations: ['UPDATE'] }] } });
   }
   return route.fulfill({ json: [405000, 160000].map((before, i) => ({ id: String(i), occurred_at: '2026-11-05T17:29:00Z', actor_name: 'Florencia Costa', source: 'gestion', entity_type: 'Artículo del pedido', reference: i ? '#R006: Bombillon' : '#R004: Mate Imperial', operation: 'UPDATE', before_values: { unit_price_minor: before }, after_values: { unit_price_minor: i ? 150000 : 399000 }, changed_fields: ['unit_price_minor'], monetary: true, currency: 'UYU' })) });
 });
 return requests;
}
test('Logs muestra importes anteriores y nuevos, filtros y páginas', async ({ page }) => {
 await mockCommerce(page);
 const requests = await mockLogs(page, true, false, '#R013: Mate Imperial personalizado, interior de cerámica, cuero con textura, virola grabada y diseño especial con una descripción extensa que debe ocupar solo dos líneas');
 await page.goto('/administracion/actividad');
 await expect(page).toHaveURL(/\/administracion\/logs$/);
 await expect(page.getByRole('heading', { name: 'Logs', exact: true })).toBeVisible();
 await expect.poll(() => requests.at(-1)?.p_users).toBeNull();
 await expect(page.getByRole('columnheader', { name: 'Fecha y hora' })).toBeVisible();
 await expect(page.getByRole('columnheader', { name: 'Usuario' })).toBeVisible();
 await expect(page.getByRole('columnheader', { name: 'Acción' })).toBeVisible();
 await expect(page.getByRole('columnheader', { name: 'Referencia' })).toBeVisible();
 await expect(page.locator('.audit-column-select svg')).toHaveCount(3);
 await expect(page.getByRole('button', { name: 'Buscar referencia' })).toHaveCount(0);
 await expect.poll(() => requests.at(-1)?.p_users).toBeNull();
 await expect(page.getByRole('row', { name: /Florencia Costa/ })).toHaveClass(/audit-attention/);
 const referenceLayout = await page.locator('.audit-reference-text').evaluate(element => {
   const bounds = element.getBoundingClientRect();
   const origin = element.closest('td')?.nextElementSibling?.getBoundingClientRect();
   const style = getComputedStyle(element);
   return { right: bounds.right, originLeft: origin?.left ?? 0, height: bounds.height, lineHeight: Number.parseFloat(style.lineHeight), lines: style.webkitLineClamp };
 });
 expect(referenceLayout.lines).toBe('2');
 expect(referenceLayout.height).toBeLessThanOrEqual(referenceLayout.lineHeight * 2 + 1);
 expect(referenceLayout.right).toBeLessThanOrEqual(referenceLayout.originLeft);
 await page.getByRole('button', { name: 'Ver cambios (2)' }).click();
 await expect(page.getByRole('cell', { name: 'UYU 4.050', exact: true })).toBeVisible();
 await expect(page.getByRole('cell', { name: 'UYU 3.990', exact: true })).toBeVisible();
 await expect(page.getByRole('cell', { name: 'UYU -60', exact: true })).toBeVisible();
 await expect(page.getByRole('cell', { name: 'UYU -100', exact: true })).toBeVisible();
 await expect(page.locator('.audit-row')).toHaveClass(/audit-attention/);
 await page.screenshot({ path: 'artifacts/audit-logs-desktop.png', fullPage: true });
 await page.getByLabel('Filtrar acción').selectOption('money');
 await expect.poll(() => requests.at(-1)?.p_money_only).toBe(true);
 await page.getByLabel('Buscar referencia o producto').fill('R004');
 await expect.poll(() => requests.at(-1)?.p_search).toBe('R004');
 await page.getByLabel('Filtrar usuario').selectOption('costa');
 await expect.poll(() => requests.at(-1)?.p_users).toEqual(['costa']);
 await page.getByLabel('Filtrar usuario').selectOption('');
 await expect.poll(() => requests.at(-1)?.p_users).toBeNull();
 await page.getByRole('button', { name: 'Siguiente', exact: true }).click();
 await expect.poll(() => requests.at(-1)?.p_page).toBe(1);
 await page.setViewportSize({ width: 390, height: 844 });
 await page.screenshot({ path: 'artifacts/audit-logs-mobile.png', fullPage: true });
 expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});
test('una persona sin permiso no ve Logs aunque tenga la ruta asignada', async ({ page }) => {
 await mockCommerce(page, { accessUserId: 't2', allowedPaths: ['/inicio/resumen','/administracion/logs'] });
 const requests = await mockLogs(page, false);
 await page.goto('/administracion/logs');
 await expect(page.getByRole('heading', { name: 'Sin acceso', exact: true })).toBeVisible();
 await expect(page.getByRole('heading', { name: 'Logs', exact: true })).toHaveCount(0);
 expect(requests).toHaveLength(0);
});

test('la tabla conserva encabezados cuando todavía no hay registros', async ({ page }) => {
 await mockCommerce(page);
 await mockLogs(page, true, true);
 await page.goto('/administracion/logs');
 await expect(page.getByRole('columnheader', { name: 'Fecha y hora' })).toBeVisible();
 await expect(page.getByRole('columnheader', { name: 'Referencia' })).toBeVisible();
 await expect(page.locator('.audit-empty')).toContainText('No hay registros');
 await expect(page.getByLabel('Filtrar usuario')).toBeVisible();
 await expect(page.getByLabel('Filtrar usuario').locator('option')).toHaveCount(users.length + 1);
 await expect(page.getByText('Flor Costa, Flor Pizzorno y Marketing')).toHaveCount(0);
 await expect(page.getByText('Historial de actividad')).toHaveCount(0);
});
