import { test, expect } from '@playwright/test';
import { mockCommerce } from './commerce-fixture';
test('pestañas de compras compactas en escritorio y móvil', async ({page}) => {
  await mockCommerce(page);
  await page.goto('/inventario/compras');
  const tabs=page.getByRole('tablist',{name:'Compras y gastos fijos'});
  await expect(tabs).toBeVisible();
  const desktop=await tabs.boundingBox();
  expect(desktop!.width).toBeLessThan(340);
  await tabs.getByRole('tab',{name:'Gastos fijos'}).click();
  await expect(tabs.getByRole('tab',{name:'Gastos fijos'})).toHaveAttribute('aria-selected','true');
  await page.setViewportSize({width:390,height:844});
  const mobile=await tabs.boundingBox();
  expect(mobile!.width).toBeLessThan(340);
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});
