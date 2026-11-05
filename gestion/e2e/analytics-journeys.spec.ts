import { test, expect } from '@playwright/test';
import { mockCommerce } from './commerce-fixture';

const owners = ['deeec8ea-ace6-4f0a-a578-17751a83f707', '5afbc94d-aecf-44e8-b12e-e136f49abb62'];
for (const userId of owners) {
  test(`Analítica muestra los recorridos a la cuenta ${userId}`, async ({ page }) => {
    await mockCommerce(page, { userId });
    await page.route('**/rest/v1/rpc/gestion_logs_context', (route) => route.fulfill({ json: { canViewLogs: false } }));
    const requests: Record<string, unknown>[] = [];
    await page.route('**/functions/v1/analytics-admin', async (route) => {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      requests.push(body);
      if (body.action === 'markChange') return route.fulfill({ json: { saved: true } });
      return route.fulfill({ json: {
        steps: [{ journey: 'catalog', step: 'entry', sessions: 20 }, { journey: 'catalog', step: 'catalog', sessions: 15 }, { journey: 'catalog', step: 'product', sessions: 10 }, { journey: 'catalog', step: 'cart', sessions: 4 }],
        daily: [{ day: '2026-11-04', journey: 'catalog', step: 'product', sessions: 10, screen_samples: 10, visible_ms: 120000, scroll_25: 8, scroll_50: 6, scroll_75: 4, scroll_90: 2 }],
        vercel: [{ day: '2026-11-04', site: 'web', status: 'complete', pageviews: 70, daily_visitors: 40, pages: [], error: null }],
        changes: [], activated_on: '2026-11-01', ga4: { status: 'unconfigured' }, clarityUrl: '',
      } });
    });
    await page.goto('/analitica/recorridos');
    await expect(page.getByRole('heading', { name: 'Recorridos hasta el carrito' })).toBeVisible();
    await expect(page.getByText('4 sesiones')).toBeVisible();
    await expect(page.getByText('12 s', { exact: false })).toBeVisible();
    await expect(page.getByText('70', { exact: true })).toBeVisible();
    if (userId === owners[0]) await page.screenshot({ path: 'artifacts/analytics-journeys-desktop.png', fullPage: true });
    await page.getByLabel('Dispositivo').selectOption('mobile');
    await expect.poll(() => requests.at(-1)?.device).toBe('mobile');
    await page.setViewportSize({ width: 390, height: 844 });
    if (userId === owners[0]) await page.screenshot({ path: 'artifacts/analytics-journeys-mobile.png', fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  });
}

test('otra cuenta propietaria no ve Analítica ni puede consultar su API desde la vista', async ({ page }) => {
  await mockCommerce(page, { userId: 'another-director' });
  await page.route('**/rest/v1/rpc/gestion_logs_context', (route) => route.fulfill({ json: { canViewLogs: false } }));
  let calls = 0;
  await page.route('**/functions/v1/analytics-admin', async (route) => { calls++; await route.fulfill({ status: 403, json: { error: 'Sin acceso.' } }); });
  await page.goto('/analitica/recorridos');
  await expect(page.getByText('Esta sección no está habilitada para tu perfil')).toBeVisible();
  expect(calls).toBe(0);
});

test('Marketing conserva su panel de Analytics', async ({ page }) => {
  await mockCommerce(page, { userId: owners[0] });
  await page.route('**/rest/v1/rpc/gestion_logs_context', (route) => route.fulfill({ json: { canViewLogs: false } }));
  await page.goto('/marketing/analytics');
  await expect(page.getByText('Datos de Vercel Web Analytics.')).toBeVisible();
  await expect(page.getByText('Páginas más vistas')).toBeVisible();
});
