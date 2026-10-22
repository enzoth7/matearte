import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { mockCommerce } from "./commerce-fixture";

test("un pedido mayorista nuevo conserva el canal de venta elegido", async ({ page }) => {
  const { tables } = await mockCommerce(page, { writable: true });
  tables.products.push({ id: "7", model: "Torpedo", variant: "Negro", rim_type: "Acero", leather_type: "Negro", price_arg: 10000, price_uyu: 270 });
  tables.customers.push({ full_name: "Almacén Sur", first_name: "Almacén", last_name: "Sur", phone: "", email: "", address: "", notes: "" });
  await page.goto("/comercial/registrar-may");
  await page.getByRole("combobox", { name: "Cliente", exact: true }).selectOption("Almacén Sur");
  await page.getByRole("combobox", { name: "Canal de venta" }).selectOption("Feria");
  await page.getByRole("combobox", { name: "Categoría 1" }).selectOption("mates");
  await page.getByRole("combobox", { name: "Tipo 1" }).selectOption("Torpedo");
  await page.getByRole("combobox", { name: "Nombre y variante 1" }).selectOption("7");
  await page.getByRole("button", { name: "Crear pedido mayorista" }).click();
  await expect.poll(() => tables.order_lines[0]?.sale_channel).toBe("Feria");
  expect(tables.order_lines[0].total_arg).toBe(10000);
  expect(tables.order_lines[0].total_uyu).toBe(270);
});

test("el formulario mayorista busca y alinea los artículos con importes en ARS", async ({ page }) => {
  const { tables } = await mockCommerce(page, { writable: true });
  tables.products.push(
    { id: "7", model: "Torpedo", variant: "Negro", category_code: "mates", price_arg: 10000, price_uyu: 270 },
    { id: "8", model: "Torpedo", variant: "Marrón", category_code: "mates", price_arg: 12000, price_uyu: 324 },
    { id: "9", model: "Matera Ovalada", variant: "Negro", category_code: "materas", price_arg: 5000, price_uyu: 135 },
    { id: "10", model: "Bombillón", variant: "Alpaca", category_code: "bombillas", catalog_attributes: { "tipo-bombilla": "bombillon" }, price_arg: 1000, price_uyu: 27 },
    { id: "11", model: "Bombilla lisa", variant: "Acero", category_code: "bombillas", catalog_attributes: { "tipo-bombilla": "clasica" }, price_arg: 800, price_uyu: 22 },
    { id: "12", model: "Bombilla inválida", variant: "Apaga", category_code: "bombillas", catalog_attributes: { "tipo-bombilla": "apaga" }, price_arg: 800, price_uyu: 22 },
  );
  tables.customers.push({ full_name: "Almacén Sur", first_name: "Almacén", last_name: "Sur", phone: "", email: "", address: "", notes: "" });
  await page.goto("/comercial/registrar-may");
  await page.getByRole("searchbox", { name: "Buscar cliente" }).fill("Almacén");
  await expect(page.getByRole("combobox", { name: "Cliente", exact: true }).locator("option")).toHaveCount(2);
  await page.getByRole("button", { name: "Almacén Sur" }).click();
  await expect(page.getByRole("combobox", { name: "Cliente", exact: true })).toHaveValue("Almacén Sur");
  await page.getByRole("searchbox", { name: "Buscar producto" }).fill("Torpedo");
  await expect(page.getByRole("button", { name: /Torpedo · Negro/ })).toBeVisible();
  await page.getByRole("button", { name: /Torpedo · Negro/ }).click();
  await expect(page.getByRole("combobox", { name: "Categoría 1" })).toHaveValue("mates");
  await expect(page.getByRole("combobox", { name: "Tipo 1" })).toHaveValue("Torpedo");
  await expect(page.getByRole("combobox", { name: "Nombre y variante 1" })).toHaveValue("7");
  await expect(page.getByRole("combobox", { name: "Nombre y variante 1" }).locator("option", { hasText: "Torpedo · Negro" })).toHaveCount(1);
  await expect(page.locator(".wholesale-sale-line-head")).toContainText("Cantidad");
  await expect(page.locator(".wholesale-sale-line-head")).toContainText("Precio ARS");
  await expect(page.locator(".wholesale-sale-line").first()).toContainText("ARS 10.000");
  await expect(page.locator(".wholesale-sale-footer")).toContainText("ARS 10.000");
  await page.getByRole("button", { name: "Agregar artículo" }).click();
  await expect(page.getByRole("combobox", { name: "Categoría 2" })).toBeVisible();
  await page.getByRole("combobox", { name: "Categoría 2" }).selectOption("materas");
  await expect(page.getByRole("combobox", { name: "Tipo 2" }).locator("option")).toHaveCount(2);
  const remove = page.getByRole("button", { name: "Eliminar artículo 2" });
  await expect(remove.locator("svg")).toBeVisible();
  await remove.click();
  await expect(page.getByRole("combobox", { name: "Categoría 2" })).toHaveCount(0);
  await page.getByRole("button", { name: "Agregar artículo" }).click();
  await page.getByRole("combobox", { name: "Categoría 2" }).selectOption("bombillones");
  await expect(page.getByRole("combobox", { name: "Tipo 2" })).toContainText("Bombillón");
  await page.getByRole("combobox", { name: "Tipo 2" }).selectOption("Bombillón");
  await expect(page.getByRole("combobox", { name: "Nombre y variante 2" })).toContainText("Bombillón · Alpaca");
  await page.getByRole("combobox", { name: "Categoría 2" }).selectOption("bombillas");
  await expect(page.getByRole("combobox", { name: "Tipo 2" })).toContainText("Clásica");
  await expect(page.getByRole("combobox", { name: "Tipo 2" })).not.toContainText("Bombillón");
  await expect(page.getByRole("combobox", { name: "Tipo 2" })).not.toContainText("Apaga");
  await page.getByRole("combobox", { name: "Tipo 2" }).selectOption("Clásica");
  await expect(page.getByRole("combobox", { name: "Nombre y variante 2" })).toContainText("Bombilla lisa · Acero");
  await page.getByRole("button", { name: "Eliminar artículo 2" }).click();
  await page.getByRole("searchbox", { name: "Buscar producto" }).fill("Bombillón");
  await page.getByRole("button", { name: /Bombillón · Alpaca/ }).click();
  await expect(page.getByRole("combobox", { name: "Categoría 2" })).toHaveValue("bombillones");
  await expect(page.getByRole("combobox", { name: "Tipo 2" })).toHaveValue("Bombillón");
  await expect(page.getByRole("combobox", { name: "Nombre y variante 2" })).toHaveValue("10");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("producción usa los nombres de Clientes y Catálogo aunque el histórico esté en mayúsculas", async ({ page }) => {
  const { tables } = await mockCommerce(page);
  tables.products.push({ id: "legacy-linked", model: "Mate de catálogo", variant: "Cuero negro", rim_type: "Acero",
    leather_type: "Liso", price_arg: 10000, price_uyu: 270 });
  tables.customers.push({ full_name: "CLIENTE NORTE", first_name: "CLIENTE", last_name: "NORTE", phone: "", email: "", address: "", notes: "" });
  tables.order_lines.push({ line_id: "legacy-line", order_id: "PED-LEGACY", created_at: "2026-10-19T12:00:00Z",
    completed_at: null, customer: "CLIENTE NORTE", model: "MATE DE CATÁLOGO", variant: "CUERO NEGRO", quantity: 1,
    status: "Pendiente", order_type: "normal", unit_price_arg: null, unit_price_uyu: null,
    exchange_rate: null, total_arg: null, total_uyu: null });

  await page.goto("/produccion/mayorista");
  const row = page.getByRole("row").filter({ hasText: "PED-LEGACY" });
  await expect(row).toContainText("Cliente Norte");
  await expect(row).toContainText("Mate de catálogo");
  await expect(row).toContainText("Cuero negro");
  await expect(row).not.toContainText("MATE DE CATÁLOGO");
});

test("la búsqueda de producción mayorista comparte fila con las pestañas y filtra ambas vistas", async ({ page }) => {
  const { tables } = await mockCommerce(page);
  const base = { created_at: "2026-10-19T12:00:00Z", completed_at: null, customer: "Cliente", quantity: 1,
    status: "Pendiente", order_type: "normal", unit_price_arg: null, unit_price_uyu: null,
    exchange_rate: null, total_arg: null, total_uyu: null };
  tables.order_lines.push(
    { ...base, line_id: "line-torpedo", order_id: "PED-111111", model: "Torpedo", variant: "Negro" },
    { ...base, line_id: "line-imperial", order_id: "PED-222222", model: "Imperial", variant: "Marrón" },
  );
  await page.goto("/produccion/mayorista");
  const bar = page.locator(".wholesale-production-viewbar");
  const tabs = bar.getByRole("button", { name: "Pedidos" });
  const search = bar.getByRole("textbox", { name: "Buscar en producción mayorista" });
  await expect(tabs).toBeVisible();
  await expect(search).toBeVisible();
  const tabBox = await tabs.boundingBox();
  const searchBox = await search.boundingBox();
  expect(Math.abs((tabBox?.y || 0) - (searchBox?.y || 0))).toBeLessThan(40);
  await search.fill("Torpedo");
  await expect(page.locator(".wholesale-production-table tbody tr")).toHaveCount(1);
  await expect(page.locator(".wholesale-production-table tbody tr")).toContainText("Torpedo");
  await bar.getByRole("button", { name: "Modelo" }).click();
  await expect(search).toHaveValue("Torpedo");
  await expect(page.locator(".wholesale-production-table tbody tr")).toHaveCount(1);
  await search.fill("Imperial");
  await expect(page.locator(".wholesale-production-table tbody tr")).toContainText("Imperial");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(search).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("mayorista ordena en encabezados, filtra cliente y modelo y cambia importes/exportación de moneda", async ({ page }) => {
  const { tables } = await mockCommerce(page);
  const base = { completed_at: null, variant: "Negro", order_type: "normal", exchange_rate: 0.03 };
  tables.order_lines.push(
    { ...base, line_id: "line-blue", order_id: "PED-100001", created_at: "2026-10-18T12:00:00Z", customer: "Cliente Uno", model: "Torpedo", quantity: 2, status: "En producción", unit_price_arg: 1000, unit_price_uyu: 30, total_arg: 2000, total_uyu: 60 },
    { ...base, line_id: "line-other", order_id: "PED-100002", created_at: "2026-10-19T12:00:00Z", customer: "Cliente Dos", model: "Imperial", quantity: 1, status: "Pendiente", unit_price_arg: 5000, unit_price_uyu: 150, total_arg: 5000, total_uyu: 150 },
    { ...base, line_id: "line-green", order_id: "PED-100003", created_at: "2026-10-17T12:00:00Z", completed_at: "2026-10-20T12:00:00Z", customer: "Cliente Tres", model: "Criollo", quantity: 1, status: "Completado", unit_price_arg: 3000, unit_price_uyu: 90, total_arg: 3000, total_uyu: 90 },
  );
  await page.goto("/produccion/mayorista");
  const table = page.locator(".wholesale-production-table");
  await expect(page.locator(".wholesale-production-actions")).toBeVisible();
  await expect(page.locator(".wholesale-production .inline-label")).toHaveCount(0);
  await expect(table.locator("tbody tr")).toHaveCount(2);
  await expect(table.locator("tbody tr").first()).toContainText("PED-100002");
  await expect(table.locator("tbody tr").filter({ hasText: "PED-100001" }).locator(".badge.blue")).toHaveText("En producción");
  await expect(table.locator("thead .wholesale-column-filter select")).toHaveCount(2);
  await expect(table.locator("thead .wholesale-column-filter span").first()).toHaveText("Cliente");
  await expect(table.locator("thead .wholesale-column-filter select").first()).toHaveCSS("opacity", "0");
  const labelBox = await table.locator("thead .wholesale-column-filter span").first().boundingBox();
  const arrowBox = await table.locator("thead .wholesale-column-filter svg").first().boundingBox();
  expect(arrowBox!.x).toBeGreaterThan(labelBox!.x + labelBox!.width);
  expect(Math.abs(arrowBox!.y + arrowBox!.height / 2 - labelBox!.y - labelBox!.height / 2)).toBeLessThan(8);
  await expect(table.getByRole("button", { name: "Ver / editar" })).toHaveCount(0);
  const firstRow = table.locator("tbody tr").filter({ hasText: "PED-100001" });
  await expect(firstRow.getByRole("button", { name: "Completar PED-100001" })).toBeVisible();
  await expect(firstRow.getByRole("button", { name: "Editar PED-100001" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Moneda mayorista" })).toHaveValue("ARS");
  await page.getByRole("combobox", { name: "Moneda mayorista" }).selectOption("UYU");
  await expect(table.locator("tbody tr").filter({ hasText: "PED-100002" })).toContainText("UYU 150");
  await page.getByRole("combobox", { name: "Moneda mayorista" }).selectOption("ARS");
  await expect(table.locator("tbody tr").filter({ hasText: "PED-100002" })).toContainText("ARS 5.000");
  await expect(page.getByRole("button", { name: "Excel" })).toHaveCSS("background-color", "rgb(121, 76, 50)");
  await table.getByRole("button", { name: /Ordenar cantidad/ }).click();
  await expect(table.locator("tbody tr").first()).toContainText("PED-100001");
  await table.getByRole("button", { name: /Ordenar total/ }).click();
  await expect(table.locator("tbody tr").first()).toContainText("PED-100002");
  await table.getByRole("button", { name: /Ordenar total/ }).click();
  await expect(table.locator("tbody tr").first()).toContainText("PED-100001");
  await table.getByRole("button", { name: /Ordenar fecha/ }).click();
  await expect(table.locator("tbody tr").first()).toContainText("PED-100002");
  await table.getByRole("button", { name: /Ordenar fecha/ }).click();
  await expect(table.locator("tbody tr").first()).toContainText("PED-100001");
  await table.getByRole("combobox", { name: "Filtrar cliente" }).selectOption("Cliente Uno");
  await expect(table.locator("tbody tr")).toHaveCount(1);
  await table.getByRole("combobox", { name: "Filtrar cliente" }).selectOption("");
  await table.getByRole("combobox", { name: "Filtrar modelo" }).selectOption("Imperial");
  await expect(table.locator("tbody tr")).toHaveCount(1);
  const reset = page.getByRole("button", { name: "Quitar filtros" });
  const resetBox = await reset.boundingBox();
  const searchBox = await page.getByRole("textbox", { name: "Buscar en producción mayorista" }).boundingBox();
  expect(resetBox!.x + resetBox!.width).toBeLessThan(searchBox!.x);
  await reset.click();
  await expect(table.getByRole("combobox", { name: "Filtrar modelo" })).toHaveValue("");
  await expect(table.locator("tbody tr")).toHaveCount(2);
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "CSV" }).click();
  const csv = await readFile(await (await downloaded).path(), "utf8");
  expect(csv).toContain("Total ARS");
  expect(csv).not.toContain("Total UYU");
  await table.getByRole("button", { name: "PED-100001", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("ARS 2.000");
  await page.getByRole("dialog").getByRole("button", { name: /cerrar/i }).first().click();
  await page.goto("/produccion/historico");
  await expect(page.locator(".wholesale-production .badge.green")).toHaveText("Completado");
});

test("Modelo muestra solo unidades y Variante separa modelo y variante en columnas", async ({ page }) => {
  const { tables } = await mockCommerce(page);
  const base = { order_id: "PED-222222", created_at: "2026-10-19T12:00:00Z", completed_at: null,
    customer: "Cliente Uno", model: "Camionero", order_type: "normal", unit_price_arg: 1000,
    unit_price_uyu: 30, exchange_rate: 0.03, total_arg: 1000, total_uyu: 30 };
  tables.order_lines.push(
    { ...base, line_id: "line-acero", variant: "Acero Liso", quantity: 5, status: "Pendiente" },
    { ...base, line_id: "line-alpaca", variant: "Alpaca Cincelada", quantity: 2, status: "En producción" },
  );
  await page.goto("/produccion/mayorista");
  await page.locator(".wholesale-production-viewbar").getByRole("button", { name: "Modelo" }).click();
  let table = page.locator(".wholesale-production-table");
  await expect(table.locator("thead th")).toHaveCount(4);
  await expect(table.locator("thead")).not.toContainText("Fecha");
  await expect(table.locator("thead")).not.toContainText("Total");
  await expect(table.locator("tbody tr")).toHaveCount(1);
  await expect(table.locator("tbody tr td").last()).toHaveText("7");

  await page.locator(".wholesale-production-viewbar").getByRole("button", { name: "Variante" }).click();
  table = page.locator(".wholesale-variant-summary-table");
  await expect(table.locator("thead th")).toHaveCount(5);
  await expect(table.locator("thead th").nth(1)).toHaveText("Variante");
  await expect(table.locator("thead th").nth(2)).toHaveText("Pendiente");
  await expect(table.locator("thead th").nth(3)).toHaveText("En producción");
  await expect(table.locator("thead th").nth(4)).toContainText("Total");
  const rows = table.locator("tbody tr");
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0).locator("td").nth(0)).toHaveText("Camionero");
  await expect(rows.nth(0).locator("td").nth(1)).toHaveText("Acero Liso");
  await expect(rows.nth(0).locator("td").nth(2)).toHaveText("5");
  await expect(rows.nth(0).locator("td").nth(4)).toHaveText("5");
  await expect(rows.nth(1).locator("td").nth(1)).toHaveText("Alpaca Cincelada");
  await expect(rows.nth(1).locator("td").nth(3)).toHaveText("2");
});

test("Cuero Torpedo cuenta solo Torpedos y Virolas omite productos sin tipo registrado", async ({ page }) => {
  const { tables } = await mockCommerce(page);
  tables.products.push(
    { id: "torpedo", model: "Torpedo", variant: "Natural", rim_type: "", leather_type: "", price_arg: 1000, price_uyu: 30 },
    { id: "imperial", model: "Imperial", variant: "Premium", rim_type: "Acero", leather_type: "", price_arg: 2000, price_uyu: 60 },
    { id: "matera", model: "MATERA", variant: "Cuadrada", rim_type: "", leather_type: "MARRON", price_arg: 1000, price_uyu: 30 },
  );
  const base = { order_id: "PED-222222", created_at: "2026-10-19T12:00:00Z", completed_at: null,
    customer: "Cliente Uno", order_type: "normal", unit_price_arg: 1000, unit_price_uyu: 30,
    exchange_rate: 0.03, total_arg: 1000, total_uyu: 30 };
  tables.order_lines.push(
    { ...base, line_id: "torpedo-pending", model: "TORPEDO", variant: "NATURAL", quantity: 5, status: "Pendiente" },
    { ...base, line_id: "torpedo-progress", model: "Torpedo", variant: "Natural", quantity: 2, status: "En producción" },
    { ...base, line_id: "imperial-pending", model: "Imperial", variant: "Premium", quantity: 3, status: "Pendiente" },
    { ...base, line_id: "matera-progress", model: "MATERA", variant: "Cuadrada", quantity: 10, status: "En producción" },
  );
  await page.goto("/produccion/mayorista");
  const tabs = page.locator(".wholesale-production-viewbar");
  const stats = page.locator(".wholesale-production .stats");
  await tabs.getByRole("button", { name: "Cuero Torpedo" }).click();
  const leatherTable = page.locator(".wholesale-production-table");
  await expect(leatherTable.locator("thead th")).toHaveCount(4);
  await expect(leatherTable.locator("tbody tr")).toHaveCount(1);
  await expect(leatherTable.locator("tbody tr td").first()).toHaveText("Sin especificar");
  await expect(leatherTable.locator("tbody tr td").nth(1)).toHaveText("5");
  await expect(leatherTable.locator("tbody tr td").nth(2)).toHaveText("2");
  await expect(leatherTable.locator("tbody tr td").nth(3)).toHaveText("7");
  await expect(leatherTable).not.toContainText("Marron");
  await expect(stats).toContainText("7");

  await tabs.getByRole("button", { name: "Virolas" }).click();
  const rimTable = page.locator(".wholesale-production-table");
  await expect(rimTable.locator("tbody tr")).toHaveCount(1);
  await expect(rimTable.locator("tbody tr td").first()).toHaveText("Acero");
  await expect(rimTable.locator("tbody tr td").last()).toHaveText("3");
  await expect(rimTable).not.toContainText("Sin virola");
});

test("las acciones mayoristas abren edición y completan desde la tabla", async ({ page }) => {
  const { tables } = await mockCommerce(page, { writable: true });
  tables.order_lines.push({ line_id: "line-action", order_id: "PED-999999", created_at: "2026-10-19T12:00:00Z", completed_at: null,
    customer: "Cliente Uno", model: "Torpedo", variant: "Negro", quantity: 1, status: "Pendiente", order_type: "normal",
    unit_price_arg: 1000, unit_price_uyu: 30, exchange_rate: 0.03, total_arg: 1000, total_uyu: 30 });
  await page.goto("/produccion/mayorista");
  const row = page.locator(".wholesale-production-table tbody tr").filter({ hasText: "PED-999999" });
  await row.getByRole("button", { name: "Editar PED-999999" }).click();
  await expect(page.getByRole("dialog").getByRole("button", { name: "Guardar" })).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: /cerrar/i }).first().click();
  await row.getByRole("button", { name: "Completar PED-999999" }).click();
  await expect.poll(() => tables.order_lines.find((line) => line.line_id === "line-action")?.status).toBe("Completado");
  await expect(row).toHaveCount(0);
});

test("el editor mayorista muestra y guarda todos los datos de perfil", async ({ page }) => {
  const { tables } = await mockCommerce(page, { writable: true });
  tables.customers.push({ full_name: "ROBERT GIMENEZ", first_name: "ROBERT", last_name: "GIMENEZ",
    phone: "+59899123456", email: "robert@example.invalid", address: "Artigas 100", notes: "Cliente habitual",
    company_name: "Distribuidora Norte", birth_date: "1984-06-12", city: "Paysandú", country: "Uruguay" });

  await page.goto("/clientes/base");
  await page.getByRole("button", { name: "Editar Robert Gimenez" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("textbox", { name: "Nombre completo" })).toHaveValue("ROBERT GIMENEZ");
  await expect(dialog.getByRole("textbox", { name: "Empresa o institución" })).toHaveValue("Distribuidora Norte");
  await expect(dialog.getByRole("textbox", { name: "Prefijo" })).toHaveValue("+598");
  await expect(dialog.getByRole("textbox", { name: "Celular", exact: true })).toHaveValue("099123456");
  await expect(dialog.getByLabel("Fecha de nacimiento")).toHaveValue("1984-06-12");
  await expect(dialog.getByRole("textbox", { name: "Ciudad", exact: true })).toHaveValue("Paysandú");
  await expect(dialog.getByRole("combobox", { name: "País" })).toHaveValue("Uruguay");
  await expect(dialog.getByRole("textbox", { name: "Dirección" })).toHaveValue("Artigas 100");
  await expect(dialog.getByRole("textbox", { name: "Notas" })).toHaveValue("Cliente habitual");
  await dialog.getByRole("textbox", { name: "Empresa o institución" }).fill("Distribuidora Litoral");
  await dialog.getByRole("textbox", { name: "Celular", exact: true }).fill("099765432");
  await dialog.getByRole("combobox", { name: "Departamento o provincia" }).selectOption("Paysandú");
  await dialog.getByRole("button", { name: "Guardar cliente" }).click();
  await expect(dialog).not.toBeVisible();
  await expect.poll(() => tables.customers[0].company_name).toBe("Distribuidora Litoral");
  expect(tables.customers[0].phone).toBe("+59899765432");
  expect(tables.customers[0].department).toBe("Paysandú");
  await expect(page.locator(".customers-table")).toContainText("Distribuidora Litoral");
});

test("solo elimina fichas mayoristas sin pedidos, después de confirmar", async ({ page }) => {
  const { tables } = await mockCommerce(page, { writable: true });
  tables.customers.push(
    { full_name: "Cliente Con Pedidos", first_name: "Cliente", last_name: "Con Pedidos", phone: "", email: "", address: "", notes: "" },
    { full_name: "Cliente Sin Pedidos", first_name: "Cliente", last_name: "Sin Pedidos", phone: "", email: "", address: "", notes: "" },
  );
  tables.order_lines.push({ line_id: "line-existing", order_id: "PED-555555", created_at: "2026-10-01T12:00:00Z",
    completed_at: null, customer: "Cliente Con Pedidos", model: "Torpedo", variant: "Negro", quantity: 1,
    status: "Pendiente", order_type: "normal", unit_price_arg: null, unit_price_uyu: null,
    exchange_rate: null, total_arg: null, total_uyu: null });
  let confirmations = 0;
  let accept = false;
  page.on("dialog", async (dialog) => {
    confirmations++;
    if (accept) await dialog.accept(); else await dialog.dismiss();
  });

  await page.goto("/clientes/base");
  await page.getByRole("button", { name: "Editar Cliente Con Pedidos" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Eliminar Cliente Con Pedidos" }).click();
  await expect(page.getByRole("alert")).toContainText("1 línea de pedido vinculada");
  expect(confirmations).toBe(0);
  expect(tables.customers).toHaveLength(2);
  await page.getByRole("dialog").getByRole("button", { name: "Cerrar" }).click();

  await page.getByRole("button", { name: "Editar Cliente Sin Pedidos" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Eliminar Cliente Sin Pedidos" }).click();
  await expect.poll(() => confirmations).toBe(1);
  expect(tables.customers).toHaveLength(2);
  accept = true;
  await page.getByRole("dialog").getByRole("button", { name: "Eliminar Cliente Sin Pedidos" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect.poll(() => tables.customers.length).toBe(1);
  expect(tables.order_lines).toHaveLength(1);
  await expect(page.getByRole("button", { name: "Editar Cliente Sin Pedidos" })).not.toBeVisible();
});

test("ARS comparte la tabla de cotizaciones", async ({ page }) => {
  const { tables } = await mockCommerce(page, { writable: true });
  tables.products.push({ id: "1", model: "Torpedo", variant: "Negro", rim_type: "", leather_type: "", price_arg: 10000, price_uyu: 270 });

  await page.goto("/finanzas/monedas");
  const table = page.locator(".commerce-section .data-table table");
  await expect(table).toBeVisible();
  await expect(table.locator("tbody tr")).toHaveCount(3);
  const ars = table.locator("tbody tr").filter({ hasText: "ARS" });
  await expect(ars.getByRole("spinbutton", { name: "Cotización ARS en UYU" })).toHaveValue("0.027");
  await ars.getByRole("spinbutton", { name: "Cotización ARS en UYU" }).fill("0.028");
  await ars.getByRole("button", { name: "Guardar" }).click();
  await expect.poll(() => tables.settings.exchange_rate).toBe(0.028);
  await expect(ars.getByRole("spinbutton", { name: "Cotización ARS en UYU" })).toHaveValue("0.028");
});

test("pedidos históricos mayoristas aparecen en las secciones existentes", async ({ page }) => {
  const { tables } = await mockCommerce(page);
  tables.products.push({ id: "7", model: "Torpedo", variant: "Negro", rim_type: "Acero", leather_type: "Negro", price_arg: 10000, price_uyu: 270 });
  tables.customers.push({ full_name: "Almacén Sur", first_name: "Almacén", last_name: "Sur", phone: "", email: "", address: "", notes: "" });
  const base = { order_id: "PED-123456", created_at: "2026-10-01T12:00:00Z", completed_at: null, customer: "Almacén Sur", model: "Torpedo", variant: "Negro", quantity: 2, status: "Pendiente", order_type: "normal", unit_price_arg: null, unit_price_uyu: null, exchange_rate: null, total_arg: null, total_uyu: null };
  tables.order_lines.push({ ...base, line_id: "line-1" }, { ...base, line_id: "line-2", status: "Completado", completed_at: "2026-10-10T12:00:00Z", total_arg: 16000, total_uyu: 432, unit_price_arg: 8000, unit_price_uyu: 216 });

  await page.goto("/produccion/mayorista");
  await expect(page.locator(".wholesale-production")).toContainText("PED-123456");
  const excelDownload = page.waitForEvent("download");
  await page.locator(".wholesale-production").getByRole("button", { name: "Excel" }).click();
  await expect((await excelDownload).suggestedFilename()).toMatch(/\.xlsx$/);
  await page.locator(".wholesale-production").getByRole("button", { name: "PED-123456" }).first().click();
  await expect(page.getByRole("dialog")).toContainText("Almacén Sur");
  await page.getByRole("dialog").getByRole("button", { name: /cerrar/i }).first().click();
  await page.goto("/comercial/pedidos");
  await expect(page.getByRole("button", { name: "PED-123456" })).toBeVisible();
  await page.goto("/produccion/resumen");
  const summary = page.locator(".wholesale-summary");
  await expect(summary).toContainText("Valor activo UYU");
  await expect(summary).toContainText("Valor activo ARS");
  await expect(summary).toContainText("Clientes activos");
  await expect(summary.getByRole("heading", { name: "Carga por estado" })).toBeVisible();
  await expect(summary.getByRole("heading", { name: "Unidades por cliente" })).toBeVisible();
  await page.goto("/clientes/base");
  await expect(page.getByRole("button", { name: "Ordenar última compra de más nueva a más antigua" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Ver ficha de Almacén Sur" })).toBeVisible();
  await page.getByRole("button", { name: "Ver ficha de Almacén Sur" }).click();
  const customerDialog = page.getByRole("dialog");
  await expect(customerDialog.getByRole("tab", { name: "Por tipo de mate" })).toHaveAttribute("aria-selected", "true");
  await expect(customerDialog).toContainText("Torpedo");
  await customerDialog.getByRole("tab", { name: "Por pedido" }).click();
  await expect(customerDialog).toContainText("PED-123456");
  await customerDialog.getByRole("button", { name: /cerrar/i }).first().click();
  await page.goto("/productos/catalogo?vista=lista");
  await expect(page.locator(".catalog-general-list")).toContainText("Torpedo");
  await page.goto("/produccion/historico");
  await expect(page.locator(".wholesale-production")).toContainText("PED-123456");
});
