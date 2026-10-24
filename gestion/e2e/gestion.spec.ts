import { test, expect } from "@playwright/test";
import { paths } from "../src/navigation";
import { mockCommerce } from "./commerce-fixture";
test.beforeEach(async ({ page }) => { await mockCommerce(page); });
test("registro minorista y mayorista tienen rutas y permisos independientes", async ({ page }) => {
  await page.goto("/comercial/registrar-min");
  await expect(page.getByRole("button", { name: "Guardar venta" })).toBeVisible();

  await page.goto("/comercial/registrar-may");
  await expect(page.getByRole("button", { name: "Crear pedido mayorista" })).toBeVisible();

  await page.goto("/administracion/usuarios");
  await page.getByRole("tab", { name: "Permisos" }).click();
  await expect(page.getByRole("checkbox", { name: "Mostrar Registrar venta min. a Florencia Costa" })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: "Mostrar Registrar venta may. a Florencia Costa" })).not.toBeChecked();
});
test("usuarios y permisos están separados en pestañas", async ({ page }) => {
  await page.goto("/administracion/usuarios");
  await expect(page.getByRole("tab", { name: "Usuarios" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByLabel("Usuario de ingreso")).toHaveValue("richard");
  await page.getByRole("button", { name: "Florencia Pizzorno" }).click();
  await page.getByLabel("Usuario de ingreso").fill("florencia.pizzorno");
  await page.getByLabel("Nueva contraseña", { exact: true }).fill("segura-2026");
  await page.getByLabel("Confirmar contraseña").fill("segura-2026");
  await page.getByRole("button", { name: "Guardar usuario" }).click();
  await expect(page.getByText("Usuario de ingreso guardado.")).toBeVisible();
  await page.getByRole("tab", { name: "Permisos" }).click();
  await expect(page.getByRole("checkbox", { name: "Mostrar Registrar venta may. a Florencia Costa" })).toBeVisible();
  await page.setViewportSize({ width: 375, height: 900 });
  await page.getByRole("tab", { name: "Usuarios" }).click();
  await expect(page.getByRole("button", { name: "Guardar usuario" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test("el usuario de Marketing muestra sus accesos y permite administrarlos", async ({ page }) => {
  await page.goto("/administracion/usuarios");
  await page.getByRole("button", { name: /^Betiana/ }).click();
  await expect(page.getByRole("heading", { name: "Betiana" })).toBeVisible();

  await page.getByRole("tab", { name: "Permisos" }).click();
  await page.getByRole("button", { name: "Betiana Marketing" }).click();
  await expect(page.getByRole("checkbox", { name: "Mostrar Sorteo a Betiana" })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: "Mostrar toda el área Marketing a Betiana" })).toBeVisible();
});
test("los permisos se guardan en el backend", async ({ page }) => {
  await page.goto("/administracion/usuarios");
  await page.getByRole("tab", { name: "Permisos" }).click();
  const request = page.waitForRequest((candidate) => {
    if (!candidate.url().endsWith("/functions/v1/gestion-users")) return false;
    try { return candidate.postDataJSON()?.action === "savePermissions"; } catch { return false; }
  });
  await page.getByRole("checkbox", { name: "Mostrar Resumen general a Florencia Costa" }).uncheck();
  const body = (await request).postDataJSON();
  expect(body.accessUserId).toBe("t2");
  expect(body.allowedPaths).not.toContain("/inicio/resumen");
  await expect(page.getByText("Permisos guardados en la base de datos.")).toBeVisible();
});
test("canales y columnas de clientes tienen identidad y datos separados", async ({ page }) => {
  await page.goto("/comercial/pedidos");
  await expect(page.locator(".badge.channel-web").first()).toHaveText("Web");
  await expect(page.locator(".badge.channel-web").first()).toHaveCSS("color", "rgb(35, 107, 145)");
  await expect(page.locator(".tabs button.channel-mayorista")).toHaveCount(0);
  await expect(page.locator(".tabs button.channel-whatsapp")).toHaveCSS("color", "rgb(23, 108, 58)");
  await expect(page.locator(".tabs button.channel-local")).toHaveCSS("color", "rgb(121, 76, 50)");
  await expect(page.locator(".tabs button.channel-web.active")).toHaveCount(0);
  await page.getByRole("button", { name: "Web", exact: true }).click();
  await expect(page.locator(".tabs button.channel-web.active")).toHaveCount(1);
  await page.goto("/clientes/base");
  for (const heading of ["Mail", "Celular", "Fecha de nacimiento", "Ciudad", "País"]) {
    await expect(page.getByRole("columnheader", { name: heading })).toBeVisible();
  }
  await expect(page.getByRole("columnheader", { name: "Última categoría comprada" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Último producto comprado" })).toHaveCount(0);
  const customerRow = page.getByRole("row").filter({ hasText: "Cliente de prueba" });
  await expect(customerRow).toContainText("Mates");
  await page.getByLabel("Buscar en la tabla").fill("Mates");
  await expect(customerRow).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Contacto" })).toHaveCount(0);
  await expect(page.getByRole("cell", { name: "05/04/1993" })).toBeVisible();
  await expect(page.getByRole("link", { name: "test@example.invalid" })).toHaveAttribute("href", "mailto:test@example.invalid");
});
test("fecha de alta, categoría comprada y KPI filtran la base en conjunto", async ({ page }) => {
  const { tables } = await mockCommerce(page);
  tables.local_sales_customers.push(
    { id: "local-antiguo", full_name: "Cliente antiguo", email: null, phone: null, country: "Uruguay", created_at: "2026-10-01T12:00:00Z", agenda_inferred_category: "Mates" },
    { id: "local-saldo", full_name: "Cliente con saldo", email: null, phone: null, country: "Uruguay", created_at: "2026-10-05T12:00:00Z" },
  );
  tables.commerce_products.push({
    id: "product-bombilla", name: "Bombilla de catálogo", editorial_slug: "bombilla", category: "bombillas", category_code: "bombillas", published: true, sale_mode: "stock", peso: 50, attributes: {}, commerce_product_images: [],
    commerce_variants: [{ id: "variant-bombilla", sku: "SKU-B", name: "Única", price_minor: 100000, base_price_minor: 100000, active: true, option_values: {} }],
  });
  tables.local_sales.push({
    id: "sale-saldo", sale_number: 21, customer_id: "local-saldo", customer_name: "Cliente con saldo", sold_on: "2026-10-15", payment_method: "Seña", total_minor: 10000, currency: "UYU", created_at: "2026-10-15T12:00:00Z",
    local_sale_items: [{ id: "item-bombilla", variant_id: "variant-bombilla", sku: "SKU-B", product_name: "Bombilla de catálogo", variant_name: "Única", quantity: 1, unit_price_minor: 100000, line_total_minor: 100000 }],
  });

  await page.goto("/clientes/base");
  await expect(page.getByRole("columnheader", { name: "Total pedidos" })).toHaveCount(0);
  const category = page.locator('.customers-table thead select[aria-label="Filtrar por última categoría comprada"]');
  await expect(category.locator("option")).toHaveText(["Última categoría comprada", "Bombillas", "Mates"]);
  const balanceKpi = page.getByRole("button", { name: /Clientes con saldo/ });
  const ordersKpi = page.getByRole("button", { name: /Con pedidos/ });
  await category.selectOption("Bombillas");
  await expect(page.getByRole("row").filter({ hasText: "Cliente con saldo" })).toBeVisible();
  await expect(page.getByRole("row").filter({ hasText: "Cliente antiguo" })).toHaveCount(0);
  await balanceKpi.click();
  await expect(balanceKpi).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("row").filter({ hasText: "Cliente con saldo" })).toBeVisible();
  await category.selectOption("Mates");
  await expect(page.locator(".customers-table tbody tr")).toHaveCount(0);
  await ordersKpi.click();
  await expect(ordersKpi).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("row").filter({ hasText: "Cliente de prueba" })).toBeVisible();
  await expect(page.getByRole("row").filter({ hasText: "Cliente antiguo" })).toHaveCount(0);
  await page.getByRole("button", { name: "Quitar filtros" }).click();
  await page.getByRole("button", { name: "Ordenar fecha de alta de más antigua a más nueva" }).last().click();
  await expect(page.locator(".customers-table tbody tr").first()).toContainText(/Cliente antiguo/i);
  await expect(page.getByRole("row").filter({ hasText: /Cliente con saldo/i })).toContainText("05/10/2026");
  await page.setViewportSize({ width: 390, height: 844 });
  const mobileCategory = page.locator('.customers-mobile-filters select[aria-label="Filtrar por última categoría comprada"]');
  await expect(mobileCategory).toBeVisible();
  await mobileCategory.selectOption("Bombillas");
  await expect(page.locator(".customers-table tbody tr")).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test("Tipo filtra minoristas y mayoristas desde el encabezado", async ({ page }) => {
  const { tables } = await mockCommerce(page);
  tables.web_leads.push(
    { source_kind: "account", source_id: "00000000-0000-4000-8000-000000000021", full_name: "Cliente Minorista", email: "minorista@example.com", phone: null, city: null, country_code: null, birth_date: null, company: null, origin_channel: "Web", customer_type: "Minorista", created_at: "2026-10-10T12:00:00Z" },
    { source_kind: "account", source_id: "00000000-0000-4000-8000-000000000022", full_name: "Cliente Mayorista", email: "mayorista@example.com", phone: null, city: null, country_code: null, birth_date: null, company: null, origin_channel: "Web", customer_type: "Mayorista", created_at: "2026-10-11T12:00:00Z" },
  );
  await page.goto("/clientes/base");
  const type = page.locator('.customers-table thead select[aria-label="Filtrar por tipo de cliente"]');
  await expect(type.locator("option")).toHaveText(["Tipo", "Minorista", "Mayorista"]);
  await type.selectOption("Mayorista");
  await expect(page.getByRole("row").filter({ hasText: "Cliente Mayorista" })).toBeVisible();
  await expect(page.getByRole("row").filter({ hasText: "Cliente Minorista" })).toHaveCount(0);
  await type.selectOption("Minorista");
  await expect(page.getByRole("row").filter({ hasText: "Cliente Minorista" })).toBeVisible();
  await expect(page.getByRole("row").filter({ hasText: "Cliente Mayorista" })).toHaveCount(0);
});
test("los KPI y el Excel de clientes respetan los filtros y se pueden restablecer", async ({ page }) => {
  const { tables } = await mockCommerce(page);
  tables.web_leads.push(
    { source_kind: "account", source_id: "00000000-0000-4000-8000-000000000041", full_name: "Cliente Minorista Filtro", email: "minorista-filtro@example.com", phone: null, city: "Montevideo", country_code: "UY", birth_date: null, company: null, origin_channel: "Web", customer_type: "Minorista", created_at: "2026-10-10T12:00:00Z" },
    { source_kind: "account", source_id: "00000000-0000-4000-8000-000000000042", full_name: "Cliente Mayorista Filtro", email: "mayorista-filtro@example.com", phone: null, city: "Buenos Aires", country_code: "AR", birth_date: null, company: null, origin_channel: "WhatsApp", customer_type: "Mayorista", created_at: "2026-10-11T12:00:00Z" },
  );
  await page.goto("/clientes/base");
  const customerCount = page.locator(".stat").filter({ hasText: "Clientes en esta vista" }).locator("strong");
  await expect(customerCount).toHaveText("3");

  const type = page.locator('.customers-table thead select[aria-label="Filtrar por tipo de cliente"]');
  await type.selectOption("Mayorista");
  await expect(customerCount).toHaveText("1");
  await expect(page.getByRole("row").filter({ hasText: "Cliente Mayorista Filtro" })).toBeVisible();
  await expect(page.getByRole("row").filter({ hasText: "Cliente Minorista Filtro" })).toHaveCount(0);

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exportar Excel" }).click();
  expect((await downloadPromise).suggestedFilename()).toMatch(/^matearte-clientes-\d{4}-\d{2}-\d{2}\.xlsx$/);

  await page.getByLabel("Buscar en la tabla").fill("sin coincidencias");
  await expect(customerCount).toHaveText("0");
  await expect(page.getByRole("button", { name: "Exportar Excel" })).toBeDisabled();
  await page.getByRole("button", { name: "Quitar filtros" }).click();
  await expect(type).toHaveValue("");
  await expect(page.getByLabel("Buscar en la tabla")).toHaveValue("");
  await expect(customerCount).toHaveText("3");
});
test("una cuenta Web sin pedidos aparece en Clientes y permite editar su ficha", async ({ page }) => {
  const { tables } = await mockCommerce(page, { writable: true });
  tables.web_leads.push({ source_kind: "account", source_id: "00000000-0000-4000-8000-000000000001", full_name: "Ana Web", email: "ana@example.com", phone: "099123456", city: "Paysandú", country_code: "UY", birth_date: null, company: null, origin_channel: "Web", customer_type: "Minorista", created_at: "2026-10-10T12:00:00Z" });
  await page.goto("/clientes/base");
  const row = page.locator(".customers-table tbody tr").filter({ hasText: "Ana Web" });
  await expect(row).toContainText("Web");
  await expect(row).toContainText("Minorista");
  await row.getByRole("button", { name: "Editar Ana Web" }).click();
  await page.getByRole("dialog").getByRole("textbox", { name: "Nombre completo", exact: true }).fill("Ana Pérez");
  await page.getByRole("dialog").getByRole("button", { name: "Guardar contacto" }).click();
  await expect.poll(() => tables.web_leads[0].full_name).toBe("Ana Pérez");
});

test("Clientes muestra el nombre de Suscripciones si la cuenta Web no tenía nombre", async ({ page }) => {
  const { tables } = await mockCommerce(page);
  tables.web_leads.push(
    { source_kind: "account", source_id: "00000000-0000-4000-8000-000000000013", full_name: null, email: "persona@example.com", phone: null, city: null, country_code: null, birth_date: null, company: null, origin_channel: "Web", customer_type: "Minorista", created_at: "2026-10-10T12:00:00Z" },
    { source_kind: "newsletter", source_id: "00000000-0000-4000-8000-000000000014", full_name: "Nombre Apellido", email: "persona@example.com", phone: null, city: null, country_code: null, birth_date: null, company: null, origin_channel: "Suscripción con desc.", customer_type: "Minorista", created_at: "2026-10-10T12:00:01Z" },
  );
  await page.goto("/clientes/base");
  for (const width of [1440, 375]) {
    await page.setViewportSize({ width, height: 900 });
    const row = page.locator(".customers-table tbody tr").filter({ hasText: "persona@example.com" });
    await expect(row.getByRole("button", { name: "Ver ficha de Nombre Apellido" })).toBeVisible();
    await expect(row).toContainText("Suscripción con desc.");
  }
});
test("una cuenta Web y un suscriptor sin compras se pueden borrar desde Clientes", async ({ page }) => {
  const { tables, writes } = await mockCommerce(page, { writable: true });
  tables.web_leads.push(
    { source_kind: "account", source_id: "00000000-0000-4000-8000-000000000011", full_name: "Ana Web", email: "ana-web@example.com", phone: null, city: null, country_code: null, birth_date: null, company: null, origin_channel: "Web", customer_type: "Minorista", created_at: "2026-10-10T12:00:00Z" },
    { source_kind: "newsletter", source_id: "00000000-0000-4000-8000-000000000012", full_name: "Luz Suscriptora", email: "luz@example.com", phone: null, city: null, country_code: null, birth_date: null, company: null, origin_channel: "Web", customer_type: "Minorista", created_at: "2026-10-11T12:00:00Z" },
  );
  page.on("dialog", (dialog) => void dialog.accept());
  await page.goto("/clientes/base");
  for (const name of ["Ana Web", "Luz Suscriptora"]) {
    await page.getByRole("row").filter({ hasText: name }).getByRole("button", { name: `Editar ${name}` }).click();
    await page.getByRole("dialog").getByRole("button", { name: `Eliminar ${name}` }).click();
    await expect.poll(() => tables.web_leads.some((lead: any) => lead.full_name === name)).toBe(false);
  }
  expect(writes.filter((write) => write.table === "gestion_delete_unpurchased_web_lead").map((write) => write.body.p_source_kind)).toEqual(["account", "newsletter"]);
});
test("un contacto Web con pedidos conserva su ficha y su historial", async ({ page }) => {
  const { writes } = await mockCommerce(page, { writable: true });
  await page.goto("/clientes/base");
  await page.getByRole("row").filter({ hasText: "Cliente de prueba" }).getByRole("button", { name: "Editar Cliente de prueba" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Eliminar Cliente de prueba" }).click();
  await expect(page.getByRole("alert")).toContainText("pedido vinculado");
  expect(writes.some((write) => write.table === "gestion_delete_unpurchased_web_lead")).toBe(false);
});
test("clientes usa un lápiz accesible y la tabla no necesita desplazamiento horizontal", async ({ page }) => {
  await page.goto("/clientes/base");
  const editButton = page.locator(".customers-table tbody tr").first().getByRole("button", { name: /^Editar / });
  await expect(editButton.locator("svg")).toHaveCount(1);
  await expect(editButton).toHaveText("");
  await expect(page.locator(".customers-table tbody td").first()).toHaveCSS("font-size", "12px");
  await expect(page.locator(".customers-table tbody .text-button").first()).toHaveCSS("font-size", "12px");
  await expect(page.locator(".customers-table tbody .customer-contact-link").first()).toHaveCSS("font-size", "12px");
  for (const width of [1440, 1200, 1101, 375]) {
    await page.setViewportSize({ width, height: 900 });
    await expect.poll(() => page.locator(".customers-table .table-scroll").evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
  }
  await expect(page.locator(".customers-table tbody td").first()).toHaveCSS("font-size", "14px");
});
test("un participante del sorteo muestra sus datos y se puede editar", async ({ page }) => {
  const { tables, writes } = await mockCommerce(page, { writable: true });
  tables.rural_raffle_entries.push({
    id: "raffle-1", full_name: "Ana Pérez", email: "ana@example.invalid", phone: "+59899123456",
    city: "Paysandú", country: "Uruguay", birth_date: "1995-04-12", product_interest: "carteras",
    created_at: "2026-10-15T12:00:00Z",
  });
  await page.goto("/clientes/base");
  const row = page.getByRole("row").filter({ hasText: "Ana Pérez" });
  await expect(row).toContainText("Paysandú");
  await expect(row).toContainText("12/04/1995");
  await expect(row.locator(".badge.channel-sorteo")).toHaveText("Sorteo");
  await row.getByRole("button", { name: "Editar" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nombre completo").fill("Ana García");
  await dialog.getByLabel("Ciudad", { exact: true }).fill("Montevideo");
  await dialog.locator('select[name="country"]').selectOption("Argentina");
  await dialog.locator('select[name="department"]').selectOption("Buenos Aires");
  await dialog.getByRole("button", { name: "Guardar cambios" }).click();
  await expect.poll(() => writes.find((write) => write.table === "rural_raffle_entries" && write.method === "PATCH")?.body.full_name).toBe("Ana García");
  expect(writes.find((write) => write.table === "rural_raffle_entries" && write.method === "PATCH")?.body.department).toBe("Buenos Aires");
  await expect(page.getByRole("row").filter({ hasText: "Ana García" })).toContainText("Montevideo");
});
test("todos los orígenes comparten campos y provincia depende del país", async ({ page }) => {
  const { tables } = await mockCommerce(page, { writable: true });
  tables.customers.push({ full_name: "Mayorista Ejemplo", first_name: "Mayorista", last_name: "Ejemplo", phone: "", email: "", address: "", notes: "", country: "Uruguay" });
  tables.local_sales_customers.push({ id: "local-unificado", full_name: "Local Ejemplo", email: null, phone: null, country: "Uruguay", origin_channel: "Local", customer_type: "Minorista", created_at: "2026-10-10T12:00:00Z" });
  tables.web_leads.push({ source_kind: "newsletter", source_id: "00000000-0000-4000-8000-000000000031", full_name: "Web Ejemplo", email: "web-unificado@example.com", phone: null, city: null, country_code: "UY", birth_date: null, company: null, origin_channel: "Web", customer_type: "Minorista", created_at: "2026-10-10T12:00:00Z" });
  tables.rural_raffle_entries.push({ id: "sorteo-unificado", full_name: "Sorteo Ejemplo", email: "sorteo-unificado@example.com", phone: "+59899123456", city: "Paysandú", country: "Uruguay", product_interest: "mates", created_at: "2026-10-10T12:00:00Z" });
  await page.goto("/clientes/base");
  for (const name of ["Mayorista Ejemplo", "Local Ejemplo", "Web Ejemplo", "Sorteo Ejemplo"]) {
    await page.getByRole("row").filter({ hasText: name }).getByRole("button", { name: `Editar ${name}` }).click();
    const dialog = page.getByRole("dialog");
    for (const field of ["name", "company", "email", "originChannel", "customerType", "prefix", "phone", "birthDate", "city", "country", "department", "postalCode", "address", "additionalPhones", "inferredCategory", "productInterest", "notes"]) {
      await expect(dialog.locator(`[name="${field}"]`)).toHaveCount(1);
    }
    await expect(dialog.locator('select[name="country"]')).toHaveValue("Uruguay");
    await expect(dialog.locator('select[name="department"] option[value="Canelones"]')).toHaveCount(1);
    await dialog.locator('select[name="country"]').selectOption("Argentina");
    await expect(dialog.locator('select[name="department"]')).toHaveValue("");
    await expect(dialog.locator('select[name="department"] option[value="Buenos Aires"]')).toHaveCount(1);
    await dialog.getByRole("button", { name: "Cerrar" }).click();
  }
});
test("ventas resume categorías y deja los datos del artículo dentro del detalle", async ({ page }) => {
  const { fixture } = await mockCommerce(page);
  fixture.products[0].name = "Mate Imperial Fleje Pampa";
  fixture.products[0].commerce_variants[0].name = "Marrón";
  fixture.products[0].commerce_variants[0].option_values = { color: "marron", tamano: "todos" };
  fixture.orders[0].order_items[0].title = "Mate Imperial Fleje Pampa — Marrón · Tamaño Todos los tamaños";
  fixture.orders[0].order_items[0].immutable_snapshot = {
    product: { name: "Mate Imperial Fleje Pampa", category_code: "mates", peso: 400 },
    variant: { name: "Marrón", option_values: { color: "marron", tamano: "todos" } },
  };

  await page.goto("/comercial/pedidos");
  for (const heading of ["Cliente", "Productos", "Producción", "Envío", "Detalles"]) await expect(page.getByRole("columnheader", { name: heading })).toBeVisible();
  const row = page.getByRole("row").filter({ hasText: "#9001" });
  await expect(row.getByRole("cell", { name: "Mates", exact: true })).toBeVisible();
  await expect(row.getByRole("cell", { name: "No enviado", exact: true })).toBeVisible();
  await expect(row).not.toContainText("Mate Imperial Fleje Pampa");
  await row.getByRole("button", { name: "Ver detalle del pedido #9001" }).click();
  await expect(page.getByRole("dialog")).toHaveClass(/order-detail-modal/);
  const item = page.getByRole("dialog").locator(".order-detail-items li").filter({ hasText: "Mate Imperial Fleje Pampa" }).first();
  await expect(page.getByRole("dialog").getByRole("region", { name: "Artículos del pedido" }).locator(".order-detail-columns")).toHaveText("ProductoSKUColorTamañoPesoCantidadImporte");
  await expect(page.getByRole("dialog").getByRole("region", { name: "Artículos del pedido" })).not.toContainText(/\d+ productos?(?: · \d+ g)?/);
  await expect(item.locator(".order-detail-item-meta").first()).toContainText("SKU-1");
  await expect(item.locator(".order-detail-item-meta").nth(1)).toContainText("Marrón");
  await expect(item.locator(".order-detail-item-meta").nth(2)).toContainText("Todos los tamaños");
  await expect(item.locator(".order-detail-item-meta").nth(3)).toContainText("400 g");
  await expect(item.locator(".order-detail-item-meta").nth(4)).toContainText("2");
  await expect(item.locator(".order-detail-item-meta").nth(5)).toContainText("2.001");
  await expect(item.locator(".order-detail-item-extra")).toHaveCount(0);
  const columnPositions = await item.evaluate(element => [".order-detail-item-copy", ".order-detail-item-meta:nth-child(2)", ".order-detail-item-meta:nth-child(3)"].map(selector => {
    const bounds = element.querySelector(selector)!.getBoundingClientRect();
    return { x: bounds.x, y: bounds.y };
  }));
  expect(columnPositions[0].x).toBeLessThan(columnPositions[1].x);
  expect(columnPositions[1].x).toBeLessThan(columnPositions[2].x);
  expect(Math.max(...columnPositions.map(position => position.y)) - Math.min(...columnPositions.map(position => position.y))).toBeLessThan(2);
  await expect(page.getByRole("dialog").getByRole("region", { name: "Totales del pedido" })).not.toContainText("Artículos");
  await item.getByRole("button", { name: "SKU-1" }).click();
  await expect(page).toHaveURL(/\/productos\/catalogo\?producto=product-1&variante=variant-1$/);
});
test("los detalles web y local comparten estructura y ancho sin perder datos de entrega", async ({ page }) => {
  const { fixture, tables } = await mockCommerce(page);
  fixture.orders[0].customer_snapshot = { ...fixture.orders[0].customer_snapshot, address: "25 de mayo 626", city: "Maldonado", country: "Uruguay" };
  tables.local_sales_customers.push({ id: "customer-layout", full_name: "Comprador local", email: null, phone: "+59899123456",
    city: "Montevideo", country: "Uruguay", birth_date: null, first_purchase_date: "2026-10-12", last_purchase_date: "2026-10-12", source_user_id: null, notes: "" });
  tables.local_sales.push({ id: "sale-layout", sale_number: 18, customer_id: "customer-layout",
    customer_name: "Comprador local", sold_on: "2026-10-12", payment_method: "Efectivo", total_minor: 200000,
    currency: "UYU", created_at: "2026-10-12T13:00:00Z", local_sale_items: [{ id: "item-layout", variant_id: "variant-2",
      sku: "SKU-2", product_name: "Mate de catálogo", variant_name: "Marrón", quantity: 1,
      unit_price_minor: 200000, line_total_minor: 200000 }] });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/comercial/pedidos");
  await page.getByRole("row").filter({ hasText: "#9001" }).getByRole("button", { name: "Ver detalle del pedido #9001" }).click();
  const web = page.getByRole("dialog", { name: "Detalle del pedido" });
  await expect(web).toHaveClass(/unified-order-modal/);
  for (const section of ["Identificación del pedido", "Resumen del pedido", "Datos de entrega", "Totales del pedido"]) {
    await expect(web.getByRole("region", { name: section })).toBeVisible();
  }
  await expect(web.getByText("25 de mayo 626")).toBeVisible();
  await expect(web.getByRole("link", { name: "WhatsApp" })).toBeVisible();
  await expect(web.locator(".order-contact-phone__prefix")).toHaveText("+598");
  await expect(web.getByRole("button", { name: "Marcar enviado" })).toBeVisible();
  const webActionStyle = await web.getByRole("button", { name: "Ver ficha del cliente" }).evaluate(element => ({ height: getComputedStyle(element).height, radius: getComputedStyle(element).borderRadius, color: getComputedStyle(element).color }));
  const webWidth = (await web.boundingBox())!.width;
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await web.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  await page.setViewportSize({ width: 1440, height: 900 });
  await web.getByRole("button", { name: "Cerrar", exact: true }).click();

  await page.getByRole("row").filter({ hasText: "Comprador local" }).getByRole("button", { name: /Ver detalle del pedido/ }).click();
  const local = page.getByRole("dialog", { name: "Detalle del pedido" });
  await expect(local).toHaveClass(/unified-order-modal/);
  await expect(local.getByRole("region", { name: "Identificación del pedido" })).toBeVisible();
  await expect(local.getByRole("region", { name: "Resumen del pedido" })).toBeVisible();
  await expect(local.getByRole("region", { name: "Entrega y contacto" })).toBeVisible();
  await expect(local.getByRole("region", { name: "Entrega y contacto" })).toContainText("Medio de pagoEfectivo");
  await expect(local.getByRole("link", { name: "WhatsApp" })).toHaveAttribute("href", "https://wa.me/59899123456");
  await expect(local.locator(".order-contact-phone__prefix")).toHaveText("+598");
  await expect(local.locator(".order-contact-phone__number")).toContainText("Uruguay");
  await expect(local.getByRole("region", { name: "Totales del pedido" })).toBeVisible();
  await expect(local.getByRole("region", { name: "Totales del pedido" })).toHaveText(/^Total\s*\$\s*2\.000$/);
  const localActionStyle = await local.getByRole("button", { name: "Ver ficha del cliente" }).evaluate(element => ({ height: getComputedStyle(element).height, radius: getComputedStyle(element).borderRadius, color: getComputedStyle(element).color }));
  expect(localActionStyle).toEqual(webActionStyle);
  expect(Math.abs((await local.boundingBox())!.width - webWidth)).toBeLessThan(16);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await local.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
});
test("todos los canales de venta muestran el mismo detalle de pedido", async ({ page }) => {
  const { tables } = await mockCommerce(page);
  const channels = ["Local", "WhatsApp", "Feria", "Instagram", "Facebook"];
  tables.local_sales_customers.push({ id: "customer-all-channels", full_name: "Cliente multicanal", email: "cliente@example.invalid", phone: "099123456",
    city: "Montevideo", country: "Uruguay", birth_date: null, first_purchase_date: "2026-10-12", last_purchase_date: "2026-10-12", source_user_id: null, notes: "" });
  channels.forEach((channel, index) => tables.local_sales.push({
    id: `sale-channel-${index}`, sale_number: 120 + index, reference_code: `#TEST-${index}`, channel, customer_id: "customer-all-channels",
    customer_name: "Cliente multicanal", sold_on: "2026-10-12", payment_method: "Efectivo", total_minor: 200000,
    currency: "UYU", created_at: "2026-10-12T13:00:00Z", local_sale_items: [{ id: `item-channel-${index}`, variant_id: "variant-2",
      sku: "SKU-2", product_name: "Mate de catálogo", variant_name: "Marrón", quantity: 1, unit_price_minor: 200000, line_total_minor: 200000 }],
  }));
  await page.goto("/comercial/pedidos");
  await page.getByRole("row").filter({ hasText: "#9001" }).getByRole("button", { name: "Ver detalle del pedido #9001" }).click();
  const webDialog = page.getByRole("dialog", { name: "Detalle del pedido" });
  await expect(webDialog).toHaveClass(/unified-order-modal/);
  await expect(webDialog.locator(".order-detail-columns")).toContainText("SKU");
  await expect(webDialog.locator(".order-contact-phone__prefix")).toHaveText("+598");
  await expect(webDialog.getByRole("button", { name: "Ver ficha del cliente" })).toHaveClass(/unified-order-action/);
  await webDialog.getByRole("button", { name: "Cerrar", exact: true }).click();
  for (const [index, channel] of channels.entries()) {
    const reference = `#TEST-${index}`;
    await page.getByRole("row").filter({ hasText: reference }).getByRole("button", { name: `Ver detalle del pedido ${reference}` }).click();
    const dialog = page.getByRole("dialog", { name: "Detalle del pedido" });
    await expect(dialog).toHaveClass(/unified-order-modal/);
    await expect(dialog.getByRole("region", { name: "Identificación del pedido" })).toContainText(channel);
    await expect(dialog.locator(".order-detail-item-meta").first()).toContainText("SKU-2");
    await expect(dialog.locator(".order-detail-item-meta").nth(1)).toContainText("Marrón");
    await expect(dialog.locator(".order-detail-item-meta").nth(3)).toContainText("260 g");
    await expect(dialog.locator(".order-detail-item-meta").nth(4)).toContainText("1");
    await expect(dialog.locator(".order-contact-phone__prefix")).toHaveText("+598");
    await expect(dialog.getByRole("region", { name: "Totales del pedido" })).toHaveText(/^Total\s*\$\s*2\.000$/);
    await expect(dialog.getByRole("button", { name: "Ver ficha del cliente" })).toHaveClass(/unified-order-action/);
    await dialog.getByRole("button", { name: "Cerrar", exact: true }).last().click();
  }
});
test("la columna Detalles queda visible en la lista de pedidos", async ({ page }) => {
  await page.setViewportSize({ width: 2048, height: 1100 });
  await page.goto("/comercial/pedidos");
  const table = page.locator(".sales-orders-table table");
  await expect(table.getByRole("columnheader", { name: "Detalles" })).toBeVisible();
  await expect(table.getByRole("columnheader", { name: "Origen" })).toBeVisible();
  const bounds = await table.evaluate((element) => {
    const product = element.querySelectorAll("th")[3].getBoundingClientRect();
    const details = element.querySelectorAll("th")[10].getBoundingClientRect();
    const viewport = element.parentElement!.getBoundingClientRect();
    return { overflows: element.parentElement!.scrollWidth > element.parentElement!.clientWidth, productWidth: product.width, tableWidth: element.getBoundingClientRect().width, detailsRight: details.right, viewportRight: viewport.right };
  });
  expect(bounds.overflows).toBe(false);
  expect(bounds.productWidth).toBeLessThan(bounds.tableWidth * 0.14);
  expect(bounds.detailsRight).toBeLessThanOrEqual(bounds.viewportRight + 1);
  await expect(page.locator(".sales-orders-table .order-details-button").first()).toBeInViewport();
});
test("la búsqueda acompaña a Exportar y el detalle separa sus datos", async ({ page }) => {
  const { tables } = await mockCommerce(page);
  tables.local_sales_customers.push({ id: "layout-customer", full_name: "Comprador del local", email: null, phone: null,
    city: "Montevideo", country: "Uruguay", birth_date: null, first_purchase_date: "2026-10-12", last_purchase_date: "2026-10-12", source_user_id: null, notes: "" });
  tables.local_sales.push({ id: "layout-sale", sale_number: 18, customer_id: "layout-customer",
    customer_name: "Comprador del local", sold_on: "2026-10-12", payment_method: "Efectivo", total_minor: 200000,
    currency: "UYU", created_at: "2026-10-12T13:00:00Z", local_sale_items: [{ id: "layout-item", variant_id: "variant-2",
      sku: "SKU-2", product_name: "Mate de catálogo", variant_name: "Cuero marrón", quantity: 1,
      unit_price_minor: 200000, line_total_minor: 200000 }] });
  await page.goto("/comercial/pedidos");
  const search = page.getByRole("searchbox", { name: "Buscar pedidos" });
  const exportButton = page.getByRole("button", { name: "Exportar", exact: true });
  await expect(search).toBeVisible();
  await expect(page.locator(".sales-orders-table .table-tools")).toBeHidden();
  const searchBox = await search.boundingBox();
  const exportBox = await exportButton.boundingBox();
  expect(searchBox && exportBox && searchBox.x + searchBox.width <= exportBox.x && Math.abs(searchBox.y + searchBox.height / 2 - exportBox.y - exportBox.height / 2) < 12, JSON.stringify({ searchBox, exportBox })).toBeTruthy();
  await search.fill("Comprador del local");
  const row = page.locator(".sales-orders-table tbody tr").filter({ hasText: "Comprador del local" }).first();
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: /Ver detalle del pedido/ }).click();
  const dialog = page.getByRole("dialog", { name: "Detalle del pedido" });
  await expect(dialog.locator(".unified-order-identity")).toHaveCSS("display", "grid");
  await expect(dialog.getByRole("heading", { name: "Resumen" })).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "Artículos" })).toBeVisible();
  await expect(dialog.locator(".unified-order-breakdown")).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  await expect(dialog.getByRole("button", { name: "Cerrar" }).last()).toBeVisible();
});
test("pedido real integrado en ventas, cliente, producción y cobros", async ({ page }) => {
  await page.goto("/comercial/pedidos");
  await expect(page.locator("table thead th").first()).toHaveText("Pedido");
  await expect(page.locator("table thead th").nth(1)).toHaveText("Fecha");
  const orderRow = page.getByRole("row").filter({ hasText: "#9001" });
  await expect(orderRow.getByRole("cell").nth(1)).toHaveText("12/10/2026");
  await orderRow.getByRole("button", { name: "Ver detalle del pedido #9001" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Mate negro", {exact: true})).toBeVisible();
  await expect(dialog.getByText("Mate marrón", {exact: true})).toBeVisible();
  await expect(dialog.getByText("$ 4.101", { exact: true }).first()).toBeVisible();
  await dialog.getByRole("button", { name: "Ver ficha del cliente" }).click();
  await expect(page.getByRole("dialog").getByRole("heading", { name: "Cliente de prueba" })).toBeVisible();
  await expect(page.getByRole("dialog").getByRole("row").filter({ hasText: "#9001" })).toBeVisible();
  await page.goto("/produccion/resumen");
  await expect(page.getByRole("row").filter({ hasText: "#9001" })).toBeVisible();
  await page.goto("/finanzas/cobros");
  await expect(page.getByText("payment-1", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Ver comprobante" })).toHaveCount(0);
});

test("Producción muestra los personalizados Web y Local también en el trabajo del taller", async ({ page }) => {
  const { fixture, tables } = await mockCommerce(page);
  fixture.orders[0].customer_snapshot.fullName = "CLIENTE DE PRUEBA";
  fixture.orders[0].order_items[1].title = "MATE PERSONALIZADO WEB";
  fixture.orders[0].order_items[1].production_status = "pending";
  fixture.orders.push({ ...fixture.orders[0], id: "order-regular-web", order_number: 9002,
    total_minor: 200100, order_items: [fixture.orders[0].order_items[0]] });
  fixture.products.push({
    id: "product-custom-local", name: "Mate Personalizado Local", editorial_slug: "mate-personalizado-local",
    category: "mates-personalizados", category_code: "mates-personalizados", published: false, sale_mode: "standard",
    peso: 0, updated_at: "2026-10-19T12:00:00Z", attributes: {}, commerce_product_images: [],
    commerce_variants: [{ id: "variant-custom-local", sku: "CUSTOM-LOCAL", name: "Marrón", price_minor: 150000,
      base_price_minor: 150000, active: true, available_local: true, available_web: false, available_wholesale: false,
      weight_grams: 0, rim_type: "Alpaca", leather_type: "Liso", option_values: { color: "marron" } }],
  });
  fixture.products.push({
    id: "product-service-local", name: "Grabado láser", editorial_slug: "grabado-laser",
    category: "servicios", category_code: "servicios", published: false, sale_mode: "standard",
    peso: 0, updated_at: "2026-10-19T12:00:00Z", attributes: {}, commerce_product_images: [],
    commerce_variants: [{ id: "variant-service-local", sku: "SERVICE-LOCAL", name: "Servicio", price_minor: 50000,
      base_price_minor: 50000, active: true, available_local: true, available_web: false, available_wholesale: false,
      weight_grams: 0, rim_type: null, leather_type: null, option_values: {} }],
  });
  tables.local_sales_customers.push({ id: "customer-custom-local", full_name: "CLIENTE LOCAL", email: null, phone: null,
    city: "Paysandú", country: "Uruguay", birth_date: null, first_purchase_date: "2026-10-19", last_purchase_date: "2026-10-19",
    source_user_id: null, notes: "" });
  tables.local_sales.push({ id: "sale-custom-local", sale_number: 25, reference_code: "#L007", channel: "Local",
    customer_id: "customer-custom-local", customer_name: "CLIENTE LOCAL", sold_on: "2026-10-19", payment_method: "Efectivo",
    total_minor: 150000, currency: "UYU", created_at: "2026-10-19T15:00:00Z",
    local_sale_items: [{ id: "sale-custom-item", variant_id: "variant-custom-local", sku: "CUSTOM-LOCAL",
      product_name: "MATE PERSONALIZADO LOCAL", variant_name: "MARRÓN", quantity: 1, unit_price_minor: 150000, line_total_minor: 150000,
      customization: { kind: "mate" } }],
  });
  tables.local_sales.push({ id: "sale-service-local", sale_number: 26, reference_code: "#L008", channel: "Local",
    customer_id: "customer-custom-local", customer_name: "CLIENTE LOCAL", sold_on: "2026-10-19", payment_method: "Efectivo",
    total_minor: 50000, currency: "UYU", created_at: "2026-10-19T16:00:00Z",
    local_sale_items: [{ id: "sale-service-item", variant_id: "variant-service-local", sku: "SERVICE-LOCAL",
      product_name: "Grabado láser", variant_name: "Servicio", quantity: 1, unit_price_minor: 50000, line_total_minor: 50000 }],
  });

  await page.goto("/produccion/personalizados");
  await expect(page.getByRole("heading", { name: "Pedidos personalizados", level: 1 })).toBeVisible();
  const webRow = page.getByRole("row").filter({ hasText: "#9001" });
  await expect(webRow).toContainText("Cliente de Prueba");
  await expect(webRow.getByRole("cell", { name: "Web", exact: true })).toBeVisible();
  const localRow = page.getByRole("row").filter({ hasText: "#L007" });
  await expect(localRow).toContainText("Cliente Local");
  await expect(localRow.getByRole("cell", { name: "Local", exact: true })).toBeVisible();
  await localRow.getByRole("button", { name: "Ver detalle del pedido #L007" }).click();
  await expect(page.getByRole("dialog").getByRole("heading", { name: "Mate Personalizado Local" })).toBeVisible();

  await page.goto("/produccion/minorista");
  const workshopRows = page.locator(".workshop-orders-table tbody tr");
  await expect(workshopRows.filter({ hasText: "#9001" })).toBeVisible();
  await expect(workshopRows.filter({ hasText: "#L007" })).toBeVisible();
  await expect(workshopRows.filter({ hasText: "#L008" })).toContainText("Servicios");
  await expect(workshopRows.filter({ hasText: "#9002" })).toHaveCount(0);
  await expect(workshopRows.filter({ hasText: "#9001" })).toContainText("Personalizados");
  await expect(workshopRows.filter({ hasText: "#9001" })).not.toContainText("Mates");
  await expect(workshopRows.filter({ hasText: "#L007" })).toContainText("Personalizados");
  for (const width of [390, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 1100 });
    const fits = await page.locator(".workshop-orders-table .table-scroll").evaluate((element) => element.scrollWidth <= element.clientWidth + 1);
    expect(fits).toBe(true);
  }
  await workshopRows.filter({ hasText: "#L007" }).getByRole("button", { name: "Ver detalle del pedido #L007" }).click();
  await expect(page.getByRole("dialog").getByText("Pendiente", { exact: true })).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Cerrar" }).last().click();
  await page.goto("/produccion/resumen");
  await expect(page.locator(".workshop-orders-table tbody tr").filter({ hasText: "#L007" })).toBeVisible();
});

test("Producción mayorista muestra pedidos y resúmenes sin desplazamiento horizontal", async ({ page }) => {
  const { tables } = await mockCommerce(page);
  tables.products.push({ id: "wholesale-product-1", model: "Torpedo", variant: "Cuero crudo con virola de alpaca cincelada",
    rim_type: "Alpaca", leather_type: "Cuero crudo", price_arg: 30000, price_uyu: 810, category_code: "mates" });
  tables.order_lines.push({ line_id: "wholesale-line-1", order_id: "PED-001", created_at: "2026-10-20T12:00:00Z",
    completed_at: null, customer: "Cliente mayorista de prueba", model: "Torpedo",
    variant: "Cuero crudo con virola de alpaca cincelada", quantity: 12, status: "Pendiente", order_type: "mayorista",
    unit_price_arg: 30000, unit_price_uyu: 810, exchange_rate: 0.027, total_arg: 360000, total_uyu: 9720 });
  await page.goto("/produccion/mayorista");
  await expect(page.locator(".wholesale-production-orders-table tbody tr")).toContainText("PED-001");
  for (const group of ["Pedidos", "Modelo", "Variante", "Virolas", "Cuero Torpedo"]) {
    await page.getByRole("button", { name: group, exact: true }).click();
    for (const width of [390, 1024, 1440, 1920]) {
      await page.setViewportSize({ width, height: 1100 });
      const fits = await page.locator(".wholesale-production-table .table-scroll").evaluate((element) => element.scrollWidth <= element.clientWidth + 1);
      expect(fits, `${group} se desborda a ${width}px`).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${group} ensancha la página a ${width}px`).toBe(true);
      if (width === 390) {
        await page.locator(".wholesale-compact-filters summary").click();
        await expect(page.getByLabel("Filtrar cliente en vista compacta")).toBeVisible();
        await expect(page.getByLabel("Ordenar en vista compacta")).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
        await page.locator(".wholesale-compact-filters summary").click();
      }
    }
  }
});

test("ventas muestra referencias nuevas de web y mayorista sin cambiar pedidos anteriores", async ({ page }) => {
  const { fixture } = await mockCommerce(page);
  fixture.orders[0].reference_code = "#W001";
  fixture.orders.push({ ...fixture.orders[0], id: "order-wholesale", order_number: 9002,
    reference_code: "#M001", customer_snapshot: { ...fixture.orders[0].customer_snapshot, purchaseFlow: "wholesale_bank_transfer" } });
  await page.goto("/comercial/pedidos");
  await expect(page.getByRole("row").filter({ hasText: "#W001" })).toBeVisible();
  await expect(page.getByRole("row").filter({ hasText: "#M001" })).toBeVisible();
});
test("catálogo y tarifas muestran datos del origen sin precios inventados", async ({ page }) => {
  await page.goto("/productos/catalogo?vista=lista");
  for (const heading of ["SKU", "Producto", "Variante", "Categoría", "Local", "Web", "Mayorista", "ARS"]) {
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
  await expect(page.getByText("artículos", { exact: true })).toBeVisible();
  await expect(page.getByText("Categorías con descuento al alcanzar el mínimo de artículos", { exact: true })).toBeVisible();
  await expect(page.getByText("Categorías con descuento al alcanzar el mínimo de mates", { exact: true })).toHaveCount(0);
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
  await expect(page.getByRole("row").filter({ hasText: "#9001" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "artifacts/pedidos-integrados-mobile.png", fullPage: true });
  await page.goto("/clientes/base"); await page.goBack();
  await expect(page).toHaveURL(/comercial\/pedidos$/);
  await page.reload();
  await expect(page.getByRole("row").filter({ hasText: "#9001" })).toBeVisible();
});

test("cambiar usuario cierra la sesión real y retira los registros", async ({ page }) => {
  await page.goto("/comercial/pedidos");
  await expect(page.getByRole("row").filter({ hasText: "#9001" })).toBeVisible();
  await page.locator(".user-button").click();
  await page.getByRole("button", { name: "Cambiar usuario", exact: true }).click();
  await expect(page.getByLabel("Usuario o correo")).toBeVisible();
  await expect(page.locator("table")).toHaveCount(0);
});
