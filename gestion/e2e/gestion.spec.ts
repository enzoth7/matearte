import { test, expect } from "@playwright/test";
import { paths } from "../src/navigation";
import { mockCommerce } from "./commerce-fixture";
test.beforeEach(async ({ page }) => { await mockCommerce(page); });
test("canales y columnas de clientes tienen identidad y datos separados", async ({ page }) => {
  await page.goto("/comercial/pedidos");
  await expect(page.locator(".badge.channel-web").first()).toHaveText("Web");
  await expect(page.locator(".badge.channel-web").first()).toHaveCSS("color", "rgb(35, 107, 145)");
  await expect(page.locator(".tabs button.channel-mayorista")).toHaveCSS("color", "rgb(36, 95, 63)");
  await expect(page.locator(".tabs button.channel-local")).toHaveCSS("color", "rgb(121, 76, 50)");
  await expect(page.locator(".tabs button.channel-web.active")).toHaveCount(0);
  await page.getByRole("button", { name: "Web", exact: true }).click();
  await expect(page.locator(".tabs button.channel-web.active")).toHaveCount(1);
  await page.goto("/clientes/base");
  for (const heading of ["Mail", "Celular", "Fecha de nacimiento", "Ciudad", "País"]) {
    await expect(page.getByRole("columnheader", { name: heading })).toBeVisible();
  }
  await expect(page.getByRole("columnheader", { name: "Contacto" })).toHaveCount(0);
  await expect(page.getByRole("cell", { name: "05/04/1993" })).toBeVisible();
  await expect(page.getByRole("link", { name: "test@example.invalid" })).toHaveAttribute("href", "mailto:test@example.invalid");
});
test("pedido real integrado en ventas, cliente, producción y cobros", async ({ page }) => {
  await page.goto("/comercial/pedidos");
  await expect(page.locator("table thead th").first()).toHaveText("Pedido");
  await expect(page.locator("table thead th").nth(1)).toHaveText("Fecha");
  await expect(page.getByRole("row").filter({ has: page.getByRole("button", { name: "#9001", exact: true }) }).getByRole("cell").nth(1)).toHaveText("12/10/2026");
  await page.getByRole("button", { name: "#9001", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Mate negro", {exact: true})).toBeVisible();
  await expect(dialog.getByText("Mate marrón", {exact: true})).toBeVisible();
  await expect(dialog.getByText("$ 4.101", { exact: true }).first()).toBeVisible();
  await dialog.getByRole("button", { name: "Ver ficha del cliente" }).click();
  await expect(page.getByRole("dialog").getByRole("heading", { name: "Cliente de prueba" })).toBeVisible();
  await expect(page.getByRole("dialog").getByRole("button", { name: "#9001", exact: true })).toBeVisible();
  await page.goto("/produccion/resumen");
  await expect(page.getByRole("button", { name: "#9001", exact: true })).toBeVisible();
  await page.goto("/finanzas/cobros");
  await expect(page.getByText("payment-1", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Ver comprobante" })).toHaveCount(0);
});

test("ventas muestra referencias nuevas de web y mayorista sin cambiar pedidos anteriores", async ({ page }) => {
  const { fixture } = await mockCommerce(page);
  fixture.orders[0].reference_code = "#W001";
  fixture.orders.push({ ...fixture.orders[0], id: "order-wholesale", order_number: 9002,
    reference_code: "#M001", customer_snapshot: { ...fixture.orders[0].customer_snapshot, purchaseFlow: "wholesale_bank_transfer" } });
  await page.goto("/comercial/pedidos");
  await expect(page.getByRole("button", { name: "#W001", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "#M001", exact: true })).toBeVisible();
});
test("catálogo y tarifas muestran datos del origen sin precios inventados", async ({ page }) => {
  await page.goto("/productos/catalogo?vista=lista");
  for (const heading of ["SKU", "Producto", "Variante", "Categoría", "Local", "Web", "Mayorista", "Publicado"]) {
    await expect(page.getByRole("columnheader", { name: heading })).toBeVisible();
  }
  await expect(page.locator(".catalog-general-list thead th").first()).toHaveText("SKU");
  await expect(page.locator(".catalog-general-list tbody tr").first().locator("td").nth(4)).toHaveText("$ 1.000,5");
  await expect(page.locator(".catalog-general-list tbody tr").first().locator("td").nth(6)).toHaveText("—");
  await page.getByRole("combobox", { name: "Ordenar" }).selectOption("sku-desc");
  await expect(page.locator(".catalog-general-list tbody tr").first().locator("td").first()).toHaveText("SKU-2");
  await page.getByRole("combobox", { name: "Ordenar" }).selectOption("sku-asc");
  const tableFits = await page.locator(".catalog-general-list .table-scroll").evaluate((node) => node.scrollWidth <= node.clientWidth);
  expect(tableFits).toBe(true);
  await page.screenshot({ path: "artifacts/catalogo-lista.png", fullPage: true });
  await expect(page.getByText("$ 1.000,5", { exact: true }).first()).toBeVisible();
  await expect(page.locator("tbody tr")).toHaveCount(2);
  await expect(page.getByText("SKU-1", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Imprimir lista" })).toBeVisible();
  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".catalog-print-heading")).toBeVisible();
  await expect(page.locator(".area-rail")).toBeHidden();
  await page.emulateMedia({ media: "screen" });
  await expect(page.getByRole("link", { name: "Ajustes y mayoristas" })).toBeVisible();
  await page.goto("/productos/ajustes");
  for (const label of ["Aplicar ajuste", "Aplicar descuento"]) {
    const row = page.getByText(label, { exact: true }).locator("..");
    const checkbox = await row.locator('input[type="checkbox"]').boundingBox();
    const text = await row.locator("strong").boundingBox();
    expect(checkbox && text && Math.abs((checkbox.y + checkbox.height / 2) - (text.y + text.height / 2))).toBeLessThan(3);
  }
  await expect(page.getByText("Se calcula sobre el precio base")).toHaveCount(0);
  await page.screenshot({ path: "artifacts/ajustes-mayoristas.png", fullPage: true });
  await page.goto("/entregas/tarifas");
  await expect(page.locator(".quote-total strong")).toHaveText("$ 700");
  await page.getByLabel("Peso en gramos").fill("501");
  await expect(page.getByText("Fuera del tarifario")).toBeVisible();
});
test("sin egresos ni historial suficiente no inventa ganancia ni proyecciones", async ({ page }) => {
  await page.goto("/finanzas/resumen");
  await expect(page.locator(".finance-highlight.expense strong")).toHaveText("—");
  await expect(page.locator(".finance-highlight.result strong")).toHaveText("—");
  await expect(page.getByText(/Se necesitan al menos seis/)).toBeVisible();
  await expect(page.locator(".finance-amount.opening").first()).toHaveText("—");
  const scroll = page.getByLabel("Desplazar tabla de meses horizontalmente");
  await scroll.focus(); await page.keyboard.press("End");
  expect(await page.locator(".finance-matrix-window").evaluate((el) => el.scrollLeft)).toBeGreaterThan(100);
  await page.screenshot({ path: "artifacts/finanzas-integradas.png", fullPage: true });
});
test("todas las rutas existentes cargan con datos compartidos y sin errores", async ({ page }) => {
  test.setTimeout(120000);
  const errors: string[] = []; page.on("pageerror", (error) => errors.push(error.message));
  for (const path of paths) {
    await page.goto(path);
    await expect(page.getByRole("button", { name: "Actualizar", exact: true })).toBeVisible();
    await expect(page.locator("main")).not.toContainText("Cargando datos…");
    await expect(page.locator("body")).not.toContainText("NaN");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), path).toBe(true);
  }
  expect(errors).toEqual([]);
});
test("la ruta paralela redirige a ventas y funciona en móvil", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/administracion/comercio");
  await expect(page).toHaveURL(/comercial\/pedidos$/);
  await expect(page.getByRole("button", { name: "#9001", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "artifacts/pedidos-integrados-mobile.png", fullPage: true });
  await page.goto("/clientes/base"); await page.goBack();
  await expect(page).toHaveURL(/comercial\/pedidos$/);
  await page.reload();
  await expect(page.getByRole("button", { name: "#9001", exact: true })).toBeVisible();
});

test("cambiar usuario cierra la sesión real y retira los registros", async ({ page }) => {
  await page.goto("/comercial/pedidos");
  await expect(page.getByRole("button", { name: "#9001", exact: true })).toBeVisible();
  await page.locator(".user-button").click();
  await page.getByRole("button", { name: "Cambiar usuario", exact: true }).click();
  await expect(page.getByLabel("Usuario o correo")).toBeVisible();
  await expect(page.locator("table")).toHaveCount(0);
});
