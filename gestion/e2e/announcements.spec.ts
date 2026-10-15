import { expect, test } from '@playwright/test';
import { mockCommerce } from './commerce-fixture';

test('programa un aviso con imagen y fechas desde Comercial', async ({ page }) => {
  const { writes } = await mockCommerce(page, { writable: true });
  await page.goto('/comercial/avisos');

  await expect(page.getByRole('heading', { name: 'Avisos', exact: true })).toBeVisible();
  await page.getByLabel('Imagen del aviso').setInputFiles({
    name: 'expo-rural.jpg',
    mimeType: 'image/jpeg',
    buffer: Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
  });
  await page.getByLabel('Descripción accesible').fill('Expo Rural Paysandú 2026');
  await page.getByLabel('Mostrar desde').fill('2026-10-15');
  await page.getByLabel('Mostrar hasta').fill('2026-10-18');
  await page.getByRole('button', { name: 'Publicar aviso' }).click();

  await expect(page.getByText('Aviso publicado.')).toBeVisible();
  await expect(page.getByText('expo-rural.jpg')).toBeVisible();
  const databaseWrite = writes.find(write => write.table === 'site_announcements' && write.method === 'POST');
  expect(databaseWrite?.body).toMatchObject({
    alt_text: 'Expo Rural Paysandú 2026',
    valid_from: '2026-10-15',
    valid_until: '2026-10-18',
    enabled: true,
  });
});
