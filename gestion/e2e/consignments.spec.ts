import { test, expect } from "@playwright/test";
import { mockCommerce } from "./commerce-fixture";

test("Finanzas muestra consignaciones y propone el precio mayorista del catálogo", async ({ page }) => {
  const { tables } = await mockCommerce(page);
  tables.commerce_products[0].commerce_variants[0].available_wholesale = true;
  tables.commerce_products[0].commerce_variants[0].wholesale_price_arg = 12500;
  tables.contacts.push({ id: "contact-wholesale", wholesale_name: "Cliente mayorista" });
  tables.customers.push({ full_name: "Cliente mayorista" });

  await page.goto("/finanzas/consignaciones");
  await expect(page.getByRole("heading", { name: "Consignaciones", level: 1 })).toBeVisible();
  await page.getByRole("button", { name: "Nueva consignación" }).click();
  await page.getByLabel("Cliente mayorista").selectOption("contact-wholesale");
  await page.getByLabel("Buscar producto existente").fill("SKU-1");
  await page.getByRole("button", { name: /Mate de catálogo, Cuero negro/ }).click();
  await expect(page.getByLabel("Precio pactado ARS")).toHaveValue("12500");
  await expect(page.getByText("SKU SKU-1").last()).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("el detalle separa enviadas, devueltas, conservadas y pagos ARS", async ({ page }) => {
  const { tables } = await mockCommerce(page);
  tables.contacts.push({ id: "contact-wholesale", wholesale_name: "Cliente mayorista" });
  tables.customers.push({ full_name: "Cliente mayorista" });
  tables.wholesale_consignments.push({ id: "consignment-1", order_id: "order-wholesale", contact_id: "contact-wholesale", exchange_rate: 0.03, created_at: "2026-11-01T12:00:00Z" });
  tables.wholesale_consignment_lines.push({ id: "consignment-line-1", consignment_id: "consignment-1", order_item_id: "item-wholesale", variant_id: "variant-1", sku: "SKU-1", title: "Mate de catálogo", quantity: 100, unit_price_arg_minor: 100000 });
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
