import { expect, test } from '@playwright/test';
import { mockCommerce } from './commerce-fixture';

for (const width of [1440, 390]) {
  test(`las opciones del formulario quedan en una fila a ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await mockCommerce(page);
    await page.goto('/marketing/descuentos');
    const labels = page.locator('.discount-form label.discount-enabled');
    await expect(labels).toHaveCount(2);
    for (const label of await labels.all()) {
      const layout = await label.evaluate(element => {
        const checkbox = element.querySelector('input')!.getBoundingClientRect();
        const text = element.querySelector('div')!.getBoundingClientRect();
        return { checkboxRight: checkbox.right, checkboxCenter: checkbox.y + checkbox.height / 2, textLeft: text.left, textCenter: text.y + text.height / 2 };
      });
      expect(layout.checkboxRight).toBeLessThan(layout.textLeft);
      expect(Math.abs(layout.checkboxCenter - layout.textCenter)).toBeLessThan(2);
    }
    await page.locator('.discount-form-panel').screenshot({ path: testInfo.outputPath(`discount-form-${width}.png`) });
  });
}

test('los códigos de cumpleaños largos terminan en puntos suspensivos y las fechas se leen día/mes/año', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 980, height: 900 });
  const { fixture } = await mockCommerce(page);
  const code = 'CUMPLE-83897F8F1DBD34C6A69B4';
  Object.assign(fixture.reference.discounts[0], {
    code, valid_from: '2026-10-24', valid_until: '2026-11-23',
  });
  await page.goto('/marketing/descuentos');
  const row = page.getByRole('row').filter({ has: page.getByRole('button', { name: code, exact: true }) });
  await expect(row).toBeVisible();
  const button = row.getByRole('button', { name: code, exact: true });
  await expect(button).toHaveAttribute('title', code);
  const codeFit = await button.evaluate(element => ({
    clipped: element.scrollWidth > element.clientWidth,
    right: element.getBoundingClientRect().right,
    nextCellLeft: element.closest('td')!.nextElementSibling!.getBoundingClientRect().left,
    textOverflow: getComputedStyle(element).textOverflow,
  }));
  expect(codeFit.clipped).toBe(true);
  expect(codeFit.textOverflow).toBe('ellipsis');
  expect(codeFit.right).toBeLessThanOrEqual(codeFit.nextCellLeft);
  await expect(row.locator('.discount-period span')).toHaveText(['24/10/2026', '— 23/11/2026']);
  await page.locator('.discount-group').filter({ has: row }).screenshot({ path: testInfo.outputPath('long-code-and-dates.png') });
});

test('beneficio y vigencia permanecen dentro de sus columnas', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1920, height: 1050 });
  const { fixture } = await mockCommerce(page);
  Object.assign(fixture.reference.discounts[0], {
    code: 'BIENVENIDA10', discount_type: 'percentage', value: 10,
    welcome_only: true, valid_from: '2026-10-20', valid_until: '2099-12-31',
  });
  await page.goto('/marketing/descuentos');
  const row = page.getByRole('row').filter({ has: page.getByRole('button', { name: 'BIENVENIDA10', exact: true }) });
  await expect(row).toBeVisible();
  const positions = await row.locator('td').evaluateAll(cells => cells.slice(0, 4).map(cell => {
    const box = cell.getBoundingClientRect();
    const range = document.createRange();
    range.selectNodeContents(cell);
    return { left: box.left, right: box.right, contentRight: range.getBoundingClientRect().right };
  }));
  expect(positions[1].contentRight).toBeLessThanOrEqual(positions[1].right);
  expect(positions[2].contentRight).toBeLessThanOrEqual(positions[2].right);
  expect(positions[1].right).toBeLessThanOrEqual(positions[2].left + 1);
  await page.locator('.discount-group').first().screenshot({ path: testInfo.outputPath('discount-table.png') });
});

test('la tabla de descuentos entra completa sin desplazamiento horizontal', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 980, height: 900 });
  const { fixture } = await mockCommerce(page);
  Object.assign(fixture.reference.discounts[0], {
    code: 'BIENVENIDA10', discount_type: 'percentage', value: 10,
    welcome_only: true, valid_from: '2026-10-20', valid_until: '2099-12-31',
  });
  await page.goto('/marketing/descuentos');
  const group = page.locator('.discount-group').first();
  const row = group.getByRole('row').filter({ has: page.getByRole('button', { name: 'BIENVENIDA10', exact: true }) });
  await expect(row).toBeVisible();
  const sizes = await group.evaluate(section => {
    const wrap = section.querySelector('.table-wrap')!;
    const table = section.querySelector('table')!;
    const cells = section.querySelectorAll('tbody td');
    const dates = cells[2].querySelectorAll('span');
    return {
      overflow: wrap.scrollWidth - wrap.clientWidth,
      tableRight: table.getBoundingClientRect().right,
      groupRight: section.getBoundingClientRect().right,
      statusRight: cells[4].getBoundingClientRect().right,
      actionRight: cells[5].querySelector('button')!.getBoundingClientRect().right,
      dateRowGap: dates[1].getBoundingClientRect().top - dates[0].getBoundingClientRect().top,
    };
  });
  expect(sizes.overflow).toBeLessThanOrEqual(1);
  expect(sizes.tableRight).toBeLessThanOrEqual(sizes.groupRight);
  expect(sizes.actionRight).toBeLessThanOrEqual(sizes.groupRight);
  expect(sizes.statusRight).toBeLessThanOrEqual(sizes.groupRight);
  expect(sizes.dateRowGap).toBeGreaterThan(0);
  await group.screenshot({ path: testInfo.outputPath('discount-table-no-scroll.png') });
});

test('en pantalla angosta cada cupón muestra todos los campos sin desplazamiento horizontal', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const { fixture } = await mockCommerce(page);
  Object.assign(fixture.reference.discounts[0], { welcome_only: true });
  await page.goto('/marketing/descuentos');
  const group = page.locator('.discount-group').first();
  const row = group.locator('tbody tr').first();
  await expect(row.locator('td')).toHaveCount(6);
  const sizes = await group.evaluate(section => ({
    overflow: section.scrollWidth - section.clientWidth,
    actionRight: section.querySelector('.action-column button')!.getBoundingClientRect().right,
    groupRight: section.getBoundingClientRect().right,
  }));
  expect(sizes.overflow).toBeLessThanOrEqual(1);
  expect(sizes.actionRight).toBeLessThanOrEqual(sizes.groupRight);
  await group.screenshot({ path: testInfo.outputPath('discount-table-mobile.png') });
});

for (const viewport of [{ width: 1440, height: 1100 }, { width: 390, height: 844 }]) {
  test(`las categorías no se superponen y los botones quedan visibles a ${viewport.width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    const { fixture } = await mockCommerce(page, { writable: true });
    fixture.reference.categories.splice(0, fixture.reference.categories.length, ...[
      'Billeteras', 'Tarjetero', 'Bombillas', 'Limpia Bombillas', 'Mates', 'Materas', 'Termos', 'Personalizados',
    ].map((label_es, index) => ({ code: `category-${index}`, label_es, active: true })));
    await page.goto('/marketing/descuentos');
    await page.getByRole('button', { name: 'Productos del descuento', exact: true }).click();
    const picker = page.getByRole('dialog', { name: 'Productos del descuento', exact: true });
    await expect(picker).toBeVisible();
    const rows = await picker.locator('label').evaluateAll(labels => labels.map(label => {
      const input = label.querySelector('input')!.getBoundingClientRect();
      const text = label.querySelector('span')!.getBoundingClientRect();
      const row = label.getBoundingClientRect();
      return { inputRight: input.right, inputCenter: input.y + input.height / 2, textLeft: text.left, textCenter: text.y + text.height / 2, top: row.top, bottom: row.bottom };
    }));
    rows.forEach((row, index) => {
      expect(row.inputRight).toBeLessThan(row.textLeft);
      expect(Math.abs(row.inputCenter - row.textCenter)).toBeLessThan(2);
      if (index) expect(row.top).toBeGreaterThanOrEqual(rows[index - 1].bottom);
    });
    const box = (await picker.boundingBox())!;
    const save = (await picker.getByRole('button', { name: 'Guardar', exact: true }).boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
    expect(save.y + save.height).toBeLessThanOrEqual(viewport.height);
    await picker.screenshot({ path: testInfo.outputPath('selector.png') });
    await picker.getByLabel('Mates Personalizados', { exact: true }).check();
    await picker.getByRole('button', { name: 'Guardar', exact: true }).click();
    await expect(picker).toHaveCount(0);
  });
}

test('descuentos: selección por categorías, Todos, cancelar y persistencia', async ({ page }) => {
  const { fixture, writes } = await mockCommerce(page, { writable: true });
  fixture.reference.categories.push({ code: 'personalizados', label_es: 'Personalizados', active: true }, { code: 'bombillas', label_es: 'Bombillas', active: true });
  Object.assign(fixture.reference.discounts[0], { applicability: 'all_items', category_codes: [], include_design_items: false });
  await page.goto('/marketing/descuentos');
  const row = page.getByRole('row').filter({ has: page.getByRole('button', { name: 'CODIGO', exact: true }) });
  await expect(row.getByRole('button', { name: 'Productos de CODIGO', exact: true })).toHaveText(/Todos/);
  await row.getByRole('button', { name: 'Productos de CODIGO', exact: true }).click();
  let picker = page.getByRole('dialog', { name: 'Productos de CODIGO', exact: true });
  await picker.getByLabel('Todos', { exact: true }).uncheck();
  await expect(picker.getByRole('button', { name: 'Guardar', exact: true })).toBeDisabled();
  await picker.getByLabel('Personalizados', { exact: true }).check();
  await expect(picker.getByLabel('Mates Personalizados', { exact: true })).not.toBeChecked();
  await picker.getByRole('button', { name: 'Cancelar' }).click();
  expect(writes.filter(write => write.table === 'commerce_discounts')).toHaveLength(0);
  await expect(row.getByRole('button', { name: 'Productos de CODIGO', exact: true })).toHaveText(/Todos/);
  await row.getByRole('button', { name: 'Productos de CODIGO', exact: true }).click();
  picker = page.getByRole('dialog', { name: 'Productos de CODIGO', exact: true });
  await picker.getByLabel('Mates', { exact: true }).check();
  await picker.getByLabel('Mates Personalizados', { exact: true }).check();
  await picker.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(picker).toHaveCount(0);
  expect(writes.find(write => write.table === 'commerce_discounts')?.body).toMatchObject({ applicability: 'categories', category_codes: ['mates'], include_design_items: true });
  await page.reload();
  await expect(row.getByRole('button', { name: 'Productos de CODIGO', exact: true })).toHaveText(/Mates, Mates Personalizados/);
  await row.getByRole('button', { name: 'Productos de CODIGO', exact: true }).click();
  picker = page.getByRole('dialog', { name: 'Productos de CODIGO', exact: true });
  await picker.getByLabel('Todos', { exact: true }).check();
  await expect(picker.getByLabel('Mates', { exact: true })).not.toBeChecked();
  await expect(picker.getByLabel('Mates Personalizados', { exact: true })).not.toBeChecked();
  await picker.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(row.getByRole('button', { name: 'Productos de CODIGO', exact: true })).toHaveText(/Todos/);
});

test('nuevo cupón y cupón de cumpleaños mantienen separados catálogo y personalizador', async ({ page }) => {
  const { fixture, writes } = await mockCommerce(page, { writable: true });
  fixture.reference.categories.push({ code: 'personalizados', label_es: 'Personalizados', active: true });
  Object.assign(fixture.reference.discounts[0], { code: 'CUMPLE-TEST', applicability: 'design_items', category_codes: [], include_design_items: false });
  await page.goto('/marketing/descuentos');
  await expect(page.getByRole('button', { name: 'Productos de CUMPLE-TEST', exact: true })).toHaveText(/Mates Personalizados/);
  await page.getByLabel('Código', { exact: true }).fill('CATEGORIA15');
  await page.getByLabel('Porcentaje', { exact: true }).fill('15');
  await page.getByRole('button', { name: 'Productos del descuento', exact: true }).click();
  const picker = page.getByRole('dialog', { name: 'Productos del descuento', exact: true });
  await picker.getByLabel('Personalizados', { exact: true }).check();
  await picker.getByRole('button', { name: 'Guardar', exact: true }).click();
  await page.getByRole('button', { name: 'Crear descuento', exact: true }).click();
  await expect(page.getByRole('button', { name: 'CATEGORIA15', exact: true })).toBeVisible();
  expect(writes.find(write => write.table === 'commerce_discounts')?.body).toMatchObject({ applicability: 'categories', category_codes: ['personalizados'], include_design_items: false });
});

test('un error al guardar conserva el alcance anterior y la selección para reintentar', async ({ page }) => {
  await mockCommerce(page, { writable: true, failWrite: 'commerce_discounts' });
  await page.goto('/marketing/descuentos');
  await page.getByRole('button', { name: 'Productos de CODIGO', exact: true }).click();
  const picker = page.getByRole('dialog', { name: 'Productos de CODIGO', exact: true });
  await picker.getByLabel('Mates', { exact: true }).check();
  await picker.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(picker.getByRole('alert')).toContainText('No se pudieron guardar');
  await expect(picker.getByLabel('Mates', { exact: true })).toBeChecked();
  await expect(page.getByRole('button', { name: 'Productos de CODIGO', exact: true })).toHaveText(/Todos/);
});
