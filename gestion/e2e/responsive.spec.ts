import { expect, test } from "@playwright/test";
import { paths } from "../src/navigation";
import { mockCommerce } from "./commerce-fixture";

const viewports = [
  { name: "laptop", width: 1707, height: 1067 },
  { name: "desktop", width: 1440, height: 900 },
  { name: "monitor", width: 1366, height: 768 },
  { name: "monitor-scaled", width: 1093, height: 614 },
  { name: "phone", width: 390, height: 844 },
  { name: "small-phone", width: 320, height: 700 },
] as const;

for (const viewport of viewports) {
  test(`las 42 rutas caben en ${viewport.name} (${viewport.width} px)`, async ({ page }) => {
    test.setTimeout(240000);
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await mockCommerce(page, { writable: true });
    const errors: string[] = [];
    const overflows: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    for (const path of paths) {
      await page.goto(path);
      await expect(page.getByRole("button", { name: "Actualizar", exact: true })).toBeVisible();
      await expect(page.locator("main")).not.toContainText("Cargando datos…");
      if (process.env.RESPONSIVE_SNAPSHOTS && [
        "/inicio/resumen", "/comercial/pedidos", "/clientes/base", "/productos/catalogo",
        "/produccion/resumen", "/finanzas/resumen", "/comercial/registrar-min",
        "/comercial/registrar-may", "/marketing/contactos", "/marketing/pauta",
        "/productos/servicios", "/productos/personalizador", "/produccion/mayorista",
        "/inventario/compras", "/entregas/tarifas", "/administracion/origen-canal",
        "/administracion/usuarios",
      ].includes(path)) {
        await page.screenshot({ path: `artifacts/responsive-${process.env.RESPONSIVE_SNAPSHOTS}/${viewport.name}-${path.replaceAll("/", "-")}.png`, fullPage: true });
      }
      const overflow = await page.evaluate(() => ({
        width: document.documentElement.scrollWidth,
        elements: [...document.querySelectorAll("main *")].filter(element => element.getBoundingClientRect().right > innerWidth + 2)
          .slice(0, 5).map(element => `${element.tagName.toLowerCase()}.${String(element.className).replaceAll(" ", ".").slice(0, 80)}`),
      }));
      if (overflow.width > viewport.width + 1) overflows.push(`${path}: ${overflow.width}px (${overflow.elements.join(", ")})`);
    }
    expect(overflows, `Desbordes a ${viewport.width} px`).toEqual([]);
    expect(errors).toEqual([]);
  });
}

test("el menú móvil permite cambiar de área y subárea", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockCommerce(page, { writable: true });
  await page.goto("/comercial/pedidos");
  await page.getByRole("button", { name: "Abrir navegación" }).click();
  const navigation = page.getByRole("navigation", { name: "Navegación móvil" });
  await expect(navigation).toBeVisible();
  await navigation.locator(".mobile-navigation-area-button").filter({ hasText: "Productos" }).click();
  await navigation.getByRole("link", { name: "Catálogo general" }).click();
  await expect(page).toHaveURL(/\/productos\/catalogo$/);
  await expect(navigation).toBeHidden();
  await expect(page.getByRole("heading", { name: "Catálogo general" })).toBeVisible();
  await page.getByRole("button", { name: "Abrir navegación" }).click();
  await page.keyboard.press("Escape");
  await expect(navigation).toBeHidden();
  await page.getByRole("button", { name: "Abrir navegación" }).click();
  await page.setViewportSize({ width: 1024, height: 768 });
  await expect(navigation).toBeHidden();
  expect(await page.evaluate(() => document.body.style.overflow)).toBe("");
});

test("registrar una venta y editar cliente y producto funciona en celular", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const { fixture, tables, writes } = await mockCommerce(page, { writable: true });
  await page.goto("/comercial/registrar-min");
  await page.getByLabel("Buscar producto").fill("SKU-1");
  await page.getByRole("button", { name: /SKU-1 · Mate de catálogo/ }).click();
  await page.getByRole("button", { name: "Agregar nuevo cliente" }).click();
  await page.getByLabel("Nombre", { exact: true }).fill("Cliente desde celular");
  await page.getByLabel("Mail").fill("celular@example.invalid");
  await page.getByRole("button", { name: "Guardar venta" }).click();
  await expect(page.getByRole("button", { name: "#L001" })).toBeVisible();
  expect(writes.filter(write => write.table === "gestion_create_local_sale_with_items")).toHaveLength(1);
  expect(tables.local_sales_customers[0].full_name).toBe("Cliente desde celular");

  await page.goto("/clientes/base");
  await page.getByRole("button", { name: "Editar Cliente desde celular" }).click();
  const customerDialog = page.getByRole("dialog");
  await expect(customerDialog).toBeVisible();
  await customerDialog.getByLabel("Nombre completo", { exact: true }).fill("Cliente editado en celular");
  await customerDialog.getByRole("button", { name: "Guardar cambios" }).click();
  await expect.poll(() => tables.local_sales_customers[0].full_name).toBe("Cliente Editado En Celular");

  await page.goto("/productos/catalogo");
  await page.locator(".product-card").first().click();
  const product = page.locator(".product-details");
  await product.getByRole("textbox", { name: "Nombre", exact: true }).fill("Mate editado en celular");
  await product.getByRole("button", { name: "Guardar cambios", exact: true }).click();
  await expect.poll(() => fixture.products[0].name).toBe("Mate editado en celular");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

for (const width of [390, 320]) {
  test(`las fichas de pedidos usan dos columnas a ${width} px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await mockCommerce(page, { writable: true });
    await page.goto("/comercial/pedidos");
    const row = page.locator(".sales-orders-table tbody tr").first();
    const date = await row.locator('td[data-label="Fecha"]').boundingBox();
    const customer = await row.locator('td[data-label="Cliente"]').boundingBox();
    expect(customer!.x).toBeGreaterThan(date!.x + date!.width);
    expect(Math.abs(customer!.y - date!.y)).toBeLessThan(2);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    if (process.env.RESPONSIVE_SNAPSHOTS) {
      await page.screenshot({ path: `artifacts/responsive-${process.env.RESPONSIVE_SNAPSHOTS}/orders-two-columns-${width}.png`, fullPage: true });
    }
  });
}

for (const viewport of [
  { width: 1366, height: 768 },
  { width: 1093, height: 614 },
  { width: 390, height: 844 },
]) {
  test(`pedidos y clientes muestran sus datos y acciones a ${viewport.width} px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await mockCommerce(page, { writable: true });
    await page.goto("/comercial/pedidos");
    const orders = page.locator(".sales-orders-table");
    await expect(orders.locator("thead")).toBeHidden();
    await expect(orders.locator('td[data-label="Importe"]')).toBeVisible();
    const detail = orders.getByRole("button", { name: "Ver detalle del pedido #9001" });
    await detail.scrollIntoViewIfNeeded();
    await expect(detail).toBeInViewport();
    await detail.click();
    const dialog = page.getByRole("dialog", { name: "Detalle del pedido" });
    await expect(dialog).toBeVisible();
    const bounds = await dialog.boundingBox();
    expect(bounds!.y).toBeGreaterThanOrEqual(0);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height + 1);
    await dialog.getByRole("button", { name: "Cerrar", exact: true }).last().click();
    await page.goto("/clientes/base");
    const customers = page.locator(".customers-table");
    await expect(customers.locator("thead")).toBeHidden();
    await expect(customers.getByRole("link", { name: "test@example.invalid" })).toBeVisible();
    await expect(customers.getByRole("button", { name: "Editar Cliente de Prueba" })).toBeVisible();
  });
}
