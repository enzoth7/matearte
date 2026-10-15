import { test, expect } from "@playwright/test";
import { mockCommerce } from "./commerce-fixture";

test("ARS comparte la tabla de cotizaciones y actualiza el catálogo mayorista", async ({ page }) => {
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
  await expect.poll(() => tables.products[0].price_uyu).toBe(280);
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
  await page.goto("/clientes/base");
  await expect(page.getByRole("button", { name: "Almacén Sur" })).toBeVisible();
  await page.goto("/productos/catalogo?vista=lista");
  await expect(page.locator(".catalog-general-list")).toContainText("Torpedo");
  await page.goto("/produccion/historico");
  await expect(page.locator(".wholesale-production")).toContainText("PED-123456");
});
