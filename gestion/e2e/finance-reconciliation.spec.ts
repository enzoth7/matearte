import { test, expect } from "@playwright/test";
import { mockCommerce } from "./commerce-fixture";

test("muestra las cuentas en columnas y los KPI sin bordes", async ({ page }) => {
  const { tables } = await mockCommerce(page);
  tables.finance_accounts.push(
    { id: "uy-bank", name: "Banco Uruguay", kind: "bank", currency: "UYU" },
    { id: "ar-bank", name: "Banco Argentina", kind: "bank", currency: "ARS" },
    { id: "cash", name: "Efectivo", kind: "cash", currency: "UYU" },
  );
  await page.goto("/finanzas/conciliacion");
  const table = page.locator(".finance-close-account-table");
  await expect(table.getByRole("columnheader")).toHaveText(["Nombre", "Moneda", "Dinero"]);
  await expect(table.getByRole("row").filter({ hasText: "Banco Uruguay" })).toContainText("UYU");
  await expect(table.getByRole("row").filter({ hasText: "Banco Argentina" })).toContainText("ARS");
  await expect(table.getByRole("row").filter({ hasText: "Efectivo" })).toContainText("UYU");
  await expect(page.locator(".finance-close-kpi").first()).toHaveCSS("border-top-width", "0px");
  await expect(page.locator(".finance-close-kpi").first()).toHaveCSS("border-left-width", "0px");
  await expect(page.locator(".finance-close-panel--flow")).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await expect(page.locator(".finance-close-panel--accounts")).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await expect(page.getByLabel("Dinero en Banco Uruguay, UYU")).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await expect(page.getByLabel("Dinero en Banco Uruguay, UYU")).toHaveCSS("border-top-color", "rgb(217, 207, 195)");
  await expect(page.getByText(/movimientos incluidos/)).toHaveCount(0);
  await expect(page.locator(".finance-close-panel--rates")).toBeVisible();
  await expect(page.getByText("Convertí los saldos en moneda extranjera")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Agregar cuenta" })).toHaveCount(0);
  await expect(page.getByLabel("Nombre de la cuenta")).toHaveCount(0);
  const rateTitle = await page.locator(".finance-close-panel--rates h2").boundingBox();
  const rateInput = await page.locator(".finance-close-panel--rates input").first().boundingBox();
  expect(rateTitle && rateInput).toBeTruthy();
  expect(Math.abs(rateTitle!.y + rateTitle!.height / 2 - (rateInput!.y + rateInput!.height / 2))).toBeLessThan(4);
});

test("el ajuste de conciliación aparece en la fila Ajuste del resumen", async ({ page }) => {
  const { tables, writes } = await mockCommerce(page, { writable: true });
  tables.finance_accounts.push({ id: "bank-1", name: "Banco Uruguay", kind: "bank", currency: "UYU" });
  await page.goto("/finanzas/conciliacion");
  await page.getByLabel("Mes").fill("2026-11");
  await page.getByLabel("Importe del ajuste en UYU").fill("-150");
  await page.getByRole("button", { name: "Guardar ajuste" }).click();
  await expect.poll(() => writes.some((write) => write.table === "finance_monthly_adjustments" && write.body.amount_minor === -15000)).toBe(true);
  await expect(page.locator(".finance-close-breakdown")).toContainText("Ajuste");
  await page.goto("/finanzas/resumen");
  await expect(page.locator(".finance-amount.manual-adjustment").first()).toContainText("150");
});

test("Richard prepara un borrador con saldos y no puede finalizar antes de fin de mes", async ({ page }) => {
  const { tables, writes } = await mockCommerce(page, { writable: true });
  tables.finance_accounts.push({ id: "bank-1", name: "Banco", kind: "bank", currency: "UYU" });
  await page.goto("/finanzas/conciliacion");
  await page.getByLabel("Mes").fill("2026-11");
  await expect(page.getByText("Noviembre de 2026 comienza con saldo inicial cero.")).toHaveCount(0);
  await page.getByLabel("Dinero en Banco, UYU").fill("5000");
  await expect(page.locator(".finance-close-kpi--actual").getByText(/5\.000/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Finalizar mes" })).toBeDisabled();
  await page.getByRole("button", { name: "Guardar borrador" }).click();
  await expect.poll(() => writes.some((write) => write.table === "finance_monthly_closes" && write.method === "POST")).toBe(true);
  const draft = tables.finance_monthly_closes[0];
  expect(draft.status).toBe("draft");
  expect(draft.balances).toMatchObject([{ id: "bank-1", amount_minor: 500000 }]);
});

test("un usuario de Finanzas puede ver la conciliación sin editarla", async ({ page }) => {
  const { tables } = await mockCommerce(page, {
    accessUserId: "t2", allowedPaths: ["/finanzas/conciliacion", "/finanzas/egresos"],
  });
  tables.finance_accounts.push({ id: "bank-1", name: "Banco", kind: "bank", currency: "UYU" });
  await page.goto("/finanzas/conciliacion");
  await expect(page.getByRole("heading", { name: "Conciliación", level: 1 })).toBeVisible();
  await expect(page.getByRole("button", { name: "Guardar borrador" })).toHaveCount(0);
  await expect(page.getByLabel("Dinero en Banco, UYU")).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("Richard finaliza noviembre y conserva ambas versiones al corregirlo", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-12-01T03:00:00Z") });
  const { tables } = await mockCommerce(page, { writable: true, sessionHours: 24 * 365 });
  tables.finance_accounts.push({ id: "bank-1", name: "Banco", kind: "bank", currency: "UYU" });
  await page.goto("/finanzas/conciliacion");
  await page.getByLabel("Mes").fill("2026-11");
  await page.getByLabel("Dinero en Banco, UYU").fill("5000");
  await page.getByRole("button", { name: "Finalizar mes" }).click();
  await expect(page.getByText("Cerrado, versión 1")).toBeVisible();
  expect(tables.finance_monthly_closes).toHaveLength(1);
  expect(tables.finance_monthly_closes[0]).toMatchObject({ status: "closed", revision: 1 });
  await page.getByRole("button", { name: "Preparar corrección" }).click();
  await page.getByLabel("Dinero en Banco, UYU").fill("5200");
  await page.getByLabel("Motivo de la corrección").fill("Saldo bancario corregido");
  await page.getByRole("button", { name: "Finalizar mes" }).click();
  await expect(page.getByText("Cerrado, versión 2")).toBeVisible();
  expect(tables.finance_monthly_closes).toHaveLength(2);
  expect(tables.finance_monthly_closes.map((row: { revision: number }) => row.revision)).toEqual([1, 2]);
  expect(tables.finance_monthly_closes[0].balances[0].amount_minor).toBe(500000);
  expect(tables.finance_monthly_closes[1].balances[0].amount_minor).toBe(520000);
  await page.getByRole("button", { name: /Versión 1,/ }).click();
  await expect(page.getByText("Cerrado, versión 1")).toBeVisible();
});
