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
  tables.wholesale_order_records.push({ id: "order-wholesale", reference_code: "#M200", customer_name: "Cliente mayorista",
    contact_id: "contact-wholesale", total_minor: 75000, status: "internal_open", paid_at: null, shipped_at: null, delivered_at: null });

  await page.goto("/finanzas/consignaciones");
  await expect(page.getByRole("heading", { name: "Consignaciones", level: 1 })).toBeVisible();
  await page.getByRole("button", { name: "Nueva consignación" }).click();
  await page.getByLabel("Moneda pactada").selectOption("ARS");
  await page.getByLabel("Buscar pedido mayorista").fill("M200");
  const orderOption = page.getByRole("button", { name: /#M200 Cliente mayorista ARS 25\.000 2 unidades/ });
  await orderOption.click();
  await expect(page.getByRole("dialog")).toContainText("Mate de catálogo");
  await expect(page.getByRole("dialog")).toContainText("ARS 25.000");
  await expect(page.getByLabel("Buscar producto existente")).toHaveCount(0);
  await expect(page.getByText("El precio ARS pactado queda fijo")).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
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
  await page.getByRole("button", { name: "Ver detalle" }).click();
  const detail = page.getByRole("dialog", { name: /Consignación/ });
  await expect(detail.getByText("Enviadas", { exact: true }).first()).toBeVisible();
  await expect(detail.getByText("En poder del cliente", { exact: true })).toBeVisible();
  await expect(detail.getByText("ARS 80.000").first()).toBeVisible();
  await expect(detail.getByText("ARS 50.000").first()).toBeVisible();
  await expect(detail.getByText("ARS 30.000").first()).toBeVisible();
  await expect(detail.getByText("Pago semanal")).toBeVisible();
});
