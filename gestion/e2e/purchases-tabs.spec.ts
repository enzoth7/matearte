import { test, expect } from "@playwright/test";
import { mockCommerce } from "./commerce-fixture";

test("egresos usa vistas contiguas y gastos fijos vive en Finanzas", async ({ page }) => {
  await mockCommerce(page);
  await page.goto("/finanzas/egresos");
  const tabs = page.getByRole("tablist", { name: "Estado de los egresos" });
  await expect(tabs.getByRole("tab", { name: "Realizados" })).toHaveAttribute("aria-selected", "true");
  await tabs.getByRole("tab", { name: "Próximos" }).click();
  await expect(tabs.getByRole("tab", { name: "Próximos" })).toHaveAttribute("aria-selected", "true");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.goto("/finanzas/gastos-fijos");
  await expect(page.getByRole("heading", { name: "Gastos fijos", level: 1 })).toBeVisible();
});

test("las direcciones anteriores abren la vista nueva", async ({ page }) => {
  await mockCommerce(page);
  await page.goto("/inventario/compras");
  await expect(page.getByRole("tablist", { name: "Estado de los egresos" })).toBeVisible();
  await page.goto("/finanzas/por-pagar");
  await expect(page.getByRole("tab", { name: "Próximos" })).toHaveAttribute("aria-selected", "true");
});

test("un pendiente pagado pasa a Realizados en el mes de pago", async ({ page }) => {
  const { tables, writes } = await mockCommerce(page, { writable: true });
  tables.purchases.push({
    id: "pendiente-test", purchased_on: "2026-10-30", due_on: "2026-11-15", paid_on: null,
    supplier: "Proveedor", description: "Insumos pendientes", category: "Insumos",
    amount_minor: 15000, currency: "UYU", payment_method: null, status: "pendiente", invoice_number: null, notes: null,
  });
  await page.goto("/finanzas/egresos");
  await page.getByLabel("Mes").fill("2026-11");
  await page.getByRole("tab", { name: "Próximos" }).click();
  const pending = page.getByRole("row").filter({ hasText: "Insumos pendientes" });
  await expect(pending).toBeVisible();
  await pending.getByRole("button", { name: "Marcar pagado" }).click();
  await page.getByLabel("Fecha de pago").fill("2026-11-09");
  await page.getByRole("button", { name: "Registrar pago" }).click();
  await expect(pending).toHaveCount(0);
  await page.getByRole("tab", { name: "Realizados" }).click();
  await expect(page.getByRole("row").filter({ hasText: "Insumos pendientes" })).toBeVisible();
  expect(writes.some((write) => write.table === "purchases" && write.method === "PATCH" && write.body.status === "pagada")).toBe(true);
});
