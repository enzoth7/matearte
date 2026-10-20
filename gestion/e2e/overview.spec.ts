import { expect, test } from "@playwright/test";
import { mockCommerce } from "./commerce-fixture";

test("inicio compara las ventas minoristas y mayoristas", async ({ page }) => {
  const { tables } = await mockCommerce(page, { writable: true });
  tables.customers.push({ full_name: "Mayorista Inicio", first_name: "Mayorista", last_name: "Inicio", phone: "", email: "", address: "", notes: "", customer_type: "Mayorista" });
  tables.order_lines.push({ line_id: "line-overview", order_id: "PED-OVERVIEW", created_at: "2026-10-18T12:00:00Z",
    completed_at: null, customer: "Mayorista Inicio", model: "Criollo", variant: "Marrón", quantity: 2,
    status: "Pendiente", order_type: "normal", unit_price_arg: 10000, unit_price_uyu: 1000,
    exchange_rate: 0.1, total_arg: 20000, total_uyu: 2000 });

  await page.goto("/inicio/resumen");
  const card = page.locator(".card").filter({ has: page.getByRole("heading", { name: "Ventas por tipo de cliente" }) });
  await expect(card).toContainText("Minorista");
  await expect(card).toContainText("Mayorista");
  await expect(card).toContainText("venta");
  await expect(page.getByRole("heading", { name: "Pendientes", exact: true })).toHaveCount(0);
});
