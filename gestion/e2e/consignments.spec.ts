import { test, expect } from "@playwright/test";
import { mockCommerce } from "./commerce-fixture";

test("Consignaciones vincula un pedido mayorista existente sin elegir productos", async ({ page }) => {
  const { tables } = await mockCommerce(page);
  tables.commerce_products[0].commerce_variants[0].available_wholesale = true;
  tables.commerce_products[0].commerce_variants[0].wholesale_price_arg = 12500;
  tables.contacts.push({ id: "contact-wholesale", wholesale_name: "Cliente mayorista" });
  tables.customers.push({ full_name: "Cliente mayorista" });
  tables.order_lines.push({ line_id: "line-existing", order_id: "#M200", created_at: "2026-11-03T12:00:00Z",
    customer: "Cliente mayorista", model: "Mate de catálogo", variant: "Cuero negro", quantity: 2,
    status: "Pendiente", order_type: "normal", unit_price_arg: 12500, unit_price_uyu: 375,
    exchange_rate: 0.03, total_arg: 25000, total_uyu: 750 });
  tables.wholesale_order_records.push({ id: "order-wholesale", reference_code: "#M200", customer_name: "Cliente mayorista", wholesale_currency: "ARS",
    contact_id: "contact-wholesale", total_minor: 75000, status: "internal_open", paid_at: null, shipped_at: null, delivered_at: null });

  await page.goto("/finanzas/consignaciones");
  await expect(page.getByRole("heading", { name: "Consignaciones", level: 1 })).toBeVisible();
  await page.getByRole("button", { name: "Nueva consignación" }).click();
  await page.getByLabel("Buscar pedido mayorista").fill("M200");
  const orderOption = page.getByRole("button", { name: /#M200 Cliente mayorista ARS 25\.000 2 unidades/ });
  await orderOption.click();
  await expect(page.getByRole("dialog")).toContainText("Mate de catálogo");
  await expect(page.getByRole("dialog")).toContainText("ARS 25.000");
  await expect(page.getByRole("dialog")).toContainText("Moneda pactadaARS");
  await expect(page.getByLabel("Buscar producto existente")).toHaveCount(0);
  await expect(page.getByText("El precio ARS pactado queda fijo")).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("la consignación hereda UYU de un pedido mayorista uruguayo", async ({ page }) => {
  const { tables } = await mockCommerce(page);
  tables.commerce_products[0].commerce_variants[0].available_wholesale = true;
  tables.commerce_products[0].commerce_variants[0].wholesale_price_arg = 12500;
  tables.contacts.push({ id: "contact-uyu", wholesale_name: "Cliente UYU" });
  tables.customers.push({ full_name: "Cliente UYU" });
  tables.order_lines.push({ line_id: "line-uyu", order_id: "#M201", created_at: "2026-11-03T12:00:00Z",
    customer: "Cliente UYU", model: "Mate de catálogo", variant: "Cuero negro", quantity: 2,
    status: "Pendiente", order_type: "normal", unit_price_arg: 12500, unit_price_uyu: 375,
    exchange_rate: 0.03, total_arg: 25000, total_uyu: 750 });
  tables.wholesale_order_records.push({ id: "order-uyu", reference_code: "#M201", customer_name: "Cliente UYU", wholesale_currency: "UYU",
    contact_id: "contact-uyu", total_minor: 75000, status: "internal_open", paid_at: null, shipped_at: null, delivered_at: null });
  await page.goto("/consignaciones/resumen");
  await page.getByRole("button", { name: "Nueva consignación" }).click();
  await page.getByLabel("Buscar pedido mayorista").fill("M201");
  await expect(page.getByRole("button", { name: /#M201 Cliente UYU/ })).toContainText("$ 750");
  await page.getByRole("button", { name: /#M201 Cliente UYU/ }).click();
  await expect(page.getByRole("dialog")).toContainText("Moneda pactadaUYU");
});

test("el detalle separa enviadas, devueltas, conservadas y pagos ARS", async ({ page }) => {
  const { tables } = await mockCommerce(page);
  tables.contacts.push({ id: "contact-wholesale", wholesale_name: "Cliente mayorista" });
  tables.customers.push({ full_name: "Cliente mayorista" });
  tables.wholesale_consignments.push({ id: "consignment-1", order_id: "order-wholesale", contact_id: "contact-wholesale", currency: "ARS", exchange_rate: 0.03, created_at: "2026-11-01T12:00:00Z" });
  tables.wholesale_consignment_lines.push({ id: "consignment-line-1", consignment_id: "consignment-1", order_item_id: "item-wholesale", variant_id: "variant-1", sku: "SKU-1", title: "Mate de catálogo", quantity: 100, unit_price_minor: 100000 });
  for (const [id, kind, quantity] of [["sent", "dispatch", 100], ["returned", "return", 20], ["kept", "kept", 80]] as const) {
    tables.wholesale_consignment_movements.push({ id, line_id: "consignment-line-1", kind, quantity, occurred_on: "2026-11-03", carrier: null, tracking: null, note: null, created_at: "2026-11-03T12:00:00Z" });
  }
  tables.customer_account_receipts.push({ id: "receipt-1", contact_id: "contact-wholesale", amount_minor: 150000, source_amount_minor: 5000000, currency: "ARS", uyu_per_ars: 0.03, payment_method: "Transferencia", paid_on: "2026-11-04", note: "Pago semanal" });
  tables.wholesale_consignment_allocations.push({ id: "allocation-1", consignment_id: "consignment-1", receipt_id: "receipt-1", source_amount_minor: 5000000, allocated_at: "2026-11-04T12:00:00Z" });

  await page.goto("/finanzas/consignaciones");
  const list = page.locator(".consignments-list");
  await expect(list.getByRole("columnheader", { name: "Conservadas" })).toBeVisible();
  await expect(list.getByRole("columnheader", { name: "En poder" })).toHaveCount(0);
  await expect(page.getByText("Unidades enviadas", { exact: true })).toBeVisible();
  await expect(list.locator(".badge.red")).toHaveText("Por cobrar");
  for (const width of [390, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await list.locator(".table-scroll").evaluate((node) => node.scrollWidth <= node.clientWidth + 1), `Consignaciones se desborda a ${width}px`).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `La página se desborda a ${width}px`).toBe(true);
  }
  await list.getByRole("button", { name: "Ver detalle de Pedido mayorista" }).click();
  const detail = page.getByRole("dialog", { name: /Consignación/ });
  await expect(detail.getByText("Enviadas", { exact: true }).first()).toBeVisible();
  await expect(detail.getByText("Conservadas", { exact: true }).first()).toBeVisible();
  await expect(detail.getByText("En poder del cliente", { exact: true })).toHaveCount(0);
  await expect(detail.getByText("Mercadería en su poder", { exact: true })).toHaveCount(0);
  await expect(detail.locator(".stats .stat")).toHaveCount(6);
  await expect(detail.locator(".consignment-products-table th")).toHaveCount(6);
  await expect(detail.locator(".consignment-products-table").getByRole("columnheader", { name: "Acciones" })).toHaveCount(0);
  await expect(detail.getByRole("button", { name: "Registrar conservadas" })).toBeDisabled();
  await page.setViewportSize({ width: 390, height: 900 });
  expect(await detail.locator(".table-scroll").evaluateAll((nodes) => nodes.every((node) => node.scrollWidth <= node.clientWidth + 1))).toBe(true);
  await detail.evaluate((node) => { node.scrollTop = node.scrollHeight; });
  const footerBottom = await detail.locator(".consignment-detail-actions").evaluate((node) => node.getBoundingClientRect().bottom);
  const dialogBottom = await detail.evaluate((node) => node.getBoundingClientRect().bottom);
  expect(Math.abs(footerBottom - dialogBottom)).toBeLessThan(35);
  await expect(detail.getByText("ARS 80.000").first()).toBeVisible();
  await expect(detail.getByText("ARS 50.000").first()).toBeVisible();
  await expect(detail.getByText("ARS 30.000").first()).toBeVisible();
  await expect(detail.getByRole("tab", { name: "Productos y unidades" })).toHaveAttribute("aria-selected", "true");
  await expect(detail.getByRole("button", { name: "Registrar devolución" })).toBeDisabled();
  await detail.getByRole("tab", { name: "Movimientos" }).click();
  await expect(detail.getByRole("tabpanel", { name: "Movimientos" })).toContainText("Pago aplicado");
  await expect(detail.getByText("Productos y unidades", { exact: true })).toHaveCount(1);
  await detail.getByRole("tab", { name: "Entregas" }).click();
  await expect(detail.getByRole("tabpanel", { name: "Entregas" })).toContainText("Pago semanal");
  await expect(detail.getByText("Pago semanal")).toBeVisible();
});

test("registrar devolución desde el pie permite elegir el producto con unidades disponibles", async ({ page }) => {
  const { tables } = await mockCommerce(page);
  tables.wholesale_consignments.push({ id: "consignment-return", order_id: "order-return", contact_id: "contact-return", currency: "UYU", exchange_rate: 1, created_at: "2026-11-01T12:00:00Z" });
  for (const id of ["mate-a", "mate-b"]) {
    tables.wholesale_consignment_lines.push({ id, consignment_id: "consignment-return", order_item_id: `item-${id}`, variant_id: `variant-${id}`, sku: id, title: `Producto ${id}`, quantity: 10, unit_price_minor: 63000 });
    tables.wholesale_consignment_movements.push({ id: `sent-${id}`, line_id: id, kind: "dispatch", quantity: 5, occurred_on: "2026-11-03", carrier: null, tracking: null, note: null, created_at: "2026-11-03T12:00:00Z" });
  }
  await page.goto("/consignaciones/resumen");
  await page.getByRole("button", { name: "Ver detalle de Pedido mayorista" }).click();
  const detail = page.getByRole("dialog", { name: /Consignación/ });
  await detail.getByRole("button", { name: "Registrar devolución" }).click();
  const picker = page.getByRole("dialog", { name: "Elegir producto para la devolución" });
  await picker.getByRole("button", { name: /Producto mate-b/ }).click();
  const form = page.getByRole("dialog", { name: "Registrar devolución" });
  await expect(form.getByText("Producto mate-b, SKU mate-b")).toBeVisible();
  await expect(form.getByLabel("Unidades")).toHaveValue("5");
  await form.getByRole("button", { name: "Cancelar" }).click();
  await detail.getByRole("button", { name: "Registrar conservadas" }).click();
  const keepPicker = page.getByRole("dialog", { name: "Elegir producto para registrar conservadas" });
  await keepPicker.getByRole("button", { name: /Producto mate-a/ }).click();
  const keepForm = page.getByRole("dialog", { name: "Confirmar que se queda" });
  await expect(keepForm.getByText("Producto mate-a, SKU mate-a")).toBeVisible();
});
