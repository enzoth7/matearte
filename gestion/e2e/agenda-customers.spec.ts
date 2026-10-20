import { test, expect } from "@playwright/test";
import { mockCommerce } from "./commerce-fixture";

test("la base de clientes pagina la agenda y ordena desde los encabezados", async ({ page }) => {
  await page.setViewportSize({ width: 2064, height: 964 });
  const { tables } = await mockCommerce(page);
  for (let number = 1; number <= 160; number++) tables.local_sales_customers.push({
    id: `agenda-${number}`, full_name: `Agenda ${String(number).padStart(3, "0")}${number === 159 ? " Imperial" : ""}`,
    company_name: number === 159 ? "Panz" : null,
    phone: `+59899${String(number).padStart(6, "0")}`, email: null, city: null, country: "Uruguay",
    birth_date: null, first_purchase_date: null, last_purchase_date: null, source_user_id: null,
    notes: "", agenda_import_key: `key-${number}`, agenda_additional_phones: [],
    agenda_inferred_category: number === 159 ? "Mates" : null, updated_at: "2026-10-15T12:00:00Z",
  });
  await page.goto("/clientes/base");
  await expect.poll(() => page.locator("main.customers-page").evaluate((element) => Math.round(element.getBoundingClientRect().width))).toBeGreaterThan(1660);
  await expect(page.locator(".customers-table tbody tr")).toHaveCount(75);
  await expect(page.locator(".customers-table .table-pagination")).toContainText("Página 1 de 3");
  await expect(page.getByRole("columnheader", { name: "Pedidos actuales" })).toHaveCount(0);
  await expect(page.locator(".customers-table thead th").nth(1)).toHaveText("Empresa");
  await page.getByLabel("Buscar en la tabla").fill("Agenda 159");
  const row = page.locator(".customers-table tbody tr");
  await expect(row).toHaveCount(1);
  await expect(row).toContainText("Mates");
  await expect(row.locator('td[data-label="Empresa"]')).toHaveText("Panz");
  await expect(row).toContainText("Agenda");
  await expect(row).toContainText("—");
  await expect(row.locator('td[data-label="Prefijo"]')).toHaveText("+598");
  await expect(row.locator('td[data-label="Celular"]')).toHaveText("099000159");
  await expect(row.locator('td[data-label="Celular"] a')).toHaveAttribute("href", "tel:+59899000159");
  await page.getByLabel("Buscar en la tabla").fill("");
  await page.locator(".customers-table thead").getByLabel("Filtrar por canal").selectOption("Agenda");
  await expect(page.locator(".customers-table .table-pagination")).toContainText("160 registros");
  await page.getByRole("button", { name: "Ordenar clientes de A a Z" }).click();
  await expect(page.locator(".customers-table tbody tr").first()).toContainText("Agenda 001");
  await page.getByRole("button", { name: "Ordenar clientes de Z a A" }).click();
  await expect(page.locator(".customers-table tbody tr").first()).toContainText("Agenda 160");
  await page.locator(".customers-table thead").getByLabel("Filtrar por canal").selectOption("");
  await page.getByRole("button", { name: "Ordenar última compra de más antigua a más nueva" }).click();
  await expect(page.getByRole("button", { name: "Ordenar última compra de más antigua a más nueva" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".customers-table tbody tr").first()).toContainText("Cliente de Prueba");
  await page.getByRole("button", { name: "Ordenar última compra de más nueva a más antigua" }).click();
  await expect(page.locator(".customers-table tbody tr").first()).toContainText("Cliente de Prueba");
  await page.locator(".customers-table .table-pagination").getByRole("button", { name: "Siguiente" }).click();
  await expect(page.locator(".customers-table .table-pagination")).toContainText("Página 2 de 3");
});

test("una venta nueva reemplaza la inferencia y conserva Agenda como origen", async ({ page }) => {
  const { tables } = await mockCommerce(page, { writable: true });
  tables.local_sales_customers.push({ id: "agenda-1", full_name: "Ana Imperial", phone: "+59899123456", email: null,
    city: null, country: "Uruguay", birth_date: null, first_purchase_date: null, last_purchase_date: null,
    source_user_id: null, notes: "", agenda_import_key: "agenda-key", agenda_additional_phones: ["+59899234567"],
    agenda_inferred_category: "Mates", updated_at: "2026-10-15T12:00:00Z" });
  await page.goto("/clientes/base");
  const before = page.locator(".customers-table tbody tr").filter({ hasText: "Ana Imperial" });
  await expect(before).toContainText("Mates");
  await expect(before).toContainText("Agenda");
  await before.getByRole("button", { name: "Ver ficha de Ana Imperial" }).click();
  await expect(page.getByRole("dialog")).toContainText("+59899234567");
  await page.getByRole("dialog").getByRole("button", { name: "Cerrar" }).click();
  await page.goto("/comercial/registrar-min");
  await page.getByLabel("Buscar producto").fill("SKU-1");
  await page.getByRole("button", { name: /SKU-1 · Mate de catálogo/ }).click();
  await page.getByLabel("Buscar cliente").fill("Ana Imperial");
  await page.getByRole("button", { name: /Ana Imperial/ }).click();
  await page.getByRole("button", { name: "Guardar venta" }).click();
  await expect.poll(() => tables.local_sales.length).toBe(1);
  await page.goto("/clientes/base");
  const after = page.locator(".customers-table tbody tr").filter({ hasText: "Ana Imperial" });
  await expect(after.locator("td[data-label='Origen']")).toHaveText("Agenda");
  const saleDate = tables.local_sales[0].sold_on as string;
  await expect(after).toContainText(`${saleDate.slice(8, 10)}/${saleDate.slice(5, 7)}/${saleDate.slice(0, 4)}`);
  expect(tables.local_sales_customers[0].agenda_import_key).toBe("agenda-key");
});

test("Agenda muestra todos los campos de perfil y permite borrar solo sin historial", async ({ page }) => {
  const { tables } = await mockCommerce(page, { writable: true });
  tables.local_sales_customers.push({ id: "editable-1", full_name: "Ana Prueba", company_name: "Panz", address: "Calle 1", phone: "+59899123456", email: "ana@example.com",
    city: "Paysandú", country: "Uruguay", birth_date: "1990-01-02", first_purchase_date: null, last_purchase_date: null,
    source_user_id: null, notes: "Nota", agenda_import_key: "agenda-edit", agenda_additional_phones: ["+59899234567"],
    agenda_inferred_category: "Mates", updated_at: "2026-10-15T12:00:00Z" });
  await page.goto("/clientes/base");
  await page.getByRole("button", { name: "Editar Ana Prueba" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Empresa o institución")).toHaveValue("Panz");
  await expect(dialog.getByLabel("Prefijo")).toHaveValue("+598");
  await expect(dialog.getByLabel("Celular", { exact: true })).toHaveValue("099123456");
  await expect(dialog.getByLabel("Dirección")).toHaveValue("Calle 1");
  await expect(dialog.getByLabel("Otros celulares")).toHaveValue("+59899234567");
  await expect(dialog.getByLabel("Notas")).toHaveValue("Nota");
  page.once("dialog", (confirmation) => confirmation.accept());
  await dialog.getByRole("button", { name: "Eliminar Ana Prueba" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Editar Ana Prueba" })).toHaveCount(0);
  expect(tables.local_sales_customers.find((entry: { id: string }) => entry.id === "editable-1")).toBeUndefined();
});

test("Sorteo permite editar el perfil completo y borrar una ficha sin pedidos", async ({ page }) => {
  const { tables } = await mockCommerce(page, { writable: true });
  tables.rural_raffle_entries.push({ id: "raffle-1", full_name: "Rosa Test", company_name: "YPF", address: "Ruta 3", notes: "Llamar",
    email: "rosa@example.com", phone: "+59899111222", city: "Salto", country: "Uruguay", birth_date: null,
    product_interest: "mates", created_at: "2026-10-15T12:00:00Z" });
  await page.goto("/clientes/base");
  await page.getByRole("button", { name: "Editar Rosa Test" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Empresa o institución")).toHaveValue("YPF");
  await expect(dialog.getByLabel("Dirección")).toHaveValue("Ruta 3");
  await expect(dialog.getByLabel("Notas")).toHaveValue("Llamar");
  await dialog.getByLabel("Ciudad").fill("Montevideo");
  await dialog.getByRole("button", { name: "Guardar cambios" }).click();
  await expect.poll(() => tables.rural_raffle_entries[0]?.city).toBe("Montevideo");
  await page.getByRole("button", { name: "Editar Rosa Test" }).click();
  page.once("dialog", (confirmation) => confirmation.accept());
  await page.getByRole("dialog").getByRole("button", { name: "Eliminar Rosa Test" }).click();
  await expect(page.getByRole("button", { name: "Editar Rosa Test" })).toHaveCount(0);
});

test("Argentina muestra +54 como prefijo y conserva el 9 móvil en el número", async ({ page }) => {
  const { tables } = await mockCommerce(page, { writable: true });
  tables.local_sales_customers.push({ id: "argentina-1", full_name: "Ana Argentina", company_name: null, address: null,
    phone: "+5491123456789", email: null, city: "Buenos Aires", country: "Argentina", birth_date: null,
    first_purchase_date: null, last_purchase_date: null, source_user_id: null, notes: "", agenda_import_key: "argentina-key",
    agenda_additional_phones: [], agenda_inferred_category: null, updated_at: "2026-10-15T12:00:00Z" });
  await page.goto("/clientes/base");
  const row = page.locator(".customers-table tbody tr").filter({ hasText: "Ana Argentina" });
  await expect(row.locator('td[data-label="Prefijo"]')).toHaveText("+54");
  await expect(row.locator('td[data-label="Celular"]')).toHaveText("91123456789");
  await expect(row.locator('td[data-label="Celular"] a')).toHaveAttribute("href", "tel:+5491123456789");
  await row.getByRole("button", { name: "Editar Ana Argentina" }).click();
  await expect(page.getByRole("dialog").getByLabel("Prefijo")).toHaveValue("+54");
  await expect(page.getByRole("dialog").getByLabel("Celular", { exact: true })).toHaveValue("91123456789");
  await page.getByRole("dialog").getByRole("button", { name: "Guardar cambios" }).click();
  await expect.poll(() => tables.local_sales_customers[0]?.phone).toBe("+5491123456789");
});

test("China y otros países ISO muestran bandera y nombre en Clientes", async ({ page }) => {
  const { tables } = await mockCommerce(page);
  tables.local_sales_customers.push({ id: "china-1", full_name: "Xinhe Tube Box", company_name: null, address: null,
    phone: "+8613713260280", email: null, city: null, country: "CN", birth_date: null,
    first_purchase_date: null, last_purchase_date: null, source_user_id: null, notes: "", agenda_import_key: "china-key",
    agenda_additional_phones: [], agenda_inferred_category: null, updated_at: "2026-10-15T12:00:00Z" });
  await page.goto("/clientes/base");
  const row = page.locator(".customers-table tbody tr").filter({ hasText: "Xinhe Tube Box" });
  await expect(row.locator('td[data-label="País"]')).toContainText("China");
  await expect(row.locator('td[data-label="País"] .fi-cn')).toHaveCount(1);
  await expect(row.locator('td[data-label="Prefijo"]')).toHaveText("+86");
});

test("País y Canal se filtran juntos desde encabezados con flecha visible", async ({ page }) => {
  const { tables } = await mockCommerce(page);
  for (const [id, name, country] of [["china-1", "Ana China", "CN"], ["argentina-1", "Beto Argentina", "Argentina"]]) {
    tables.local_sales_customers.push({ id, full_name: name, company_name: null, address: null, phone: country === "CN" ? "+8613713260280" : "+5491123456789",
      email: null, city: null, country, birth_date: null, first_purchase_date: null, last_purchase_date: null,
      source_user_id: null, notes: "", agenda_import_key: id, agenda_additional_phones: [], agenda_inferred_category: null,
      updated_at: "2026-10-15T12:00:00Z" });
  }
  await page.goto("/clientes/base");
  const header = page.locator(".customers-table thead");
  await expect(header.getByLabel("Filtrar por país")).toContainText("China");
  await expect(header.locator(".customer-filter-heading svg")).toHaveCount(2);
  await header.getByLabel("Filtrar por país").selectOption("China");
  await expect(page.locator(".customers-table tbody tr")).toHaveCount(1);
  await expect(page.locator(".customers-table tbody tr")).toContainText("Ana China");
  await header.getByLabel("Filtrar por canal").selectOption("Web");
  await expect(page.locator(".customers-table tbody tr")).toHaveCount(0);
  await header.getByLabel("Filtrar por canal").selectOption("Agenda");
  await expect(page.locator(".customers-table tbody tr")).toHaveCount(1);
  await page.setViewportSize({ width: 375, height: 812 });
  await expect(page.locator(".customers-mobile-filters").getByLabel("Filtrar por país")).toBeVisible();
  await expect(page.locator(".customers-mobile-filters").locator(".customer-filter-heading svg")).toHaveCount(2);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("siete mil contactos se consultan por páginas sin renderizar siete mil filas", async ({ page }) => {
  const { tables } = await mockCommerce(page);
  for (let number = 1; number <= 7000; number++) tables.local_sales_customers.push({
    id: `large-${number}`, full_name: `Cliente agenda ${number}`, phone: `+59899${String(number).padStart(6, "0")}`,
    email: null, city: null, country: "Uruguay", birth_date: null, first_purchase_date: null,
    last_purchase_date: null, source_user_id: null, notes: "", agenda_import_key: `key-${number}`,
    agenda_additional_phones: [], agenda_inferred_category: null, updated_at: "2026-10-15T12:00:00Z",
  });
  await page.goto("/clientes/base");
  await expect(page.locator(".customers-table .table-pagination")).toContainText("7.001 registros");
  await expect(page.locator(".customers-table tbody tr")).toHaveCount(75);
  await page.getByLabel("Buscar en la tabla").fill("Cliente agenda 6999");
  await expect(page.locator(".customers-table tbody tr")).toHaveCount(1);
});
