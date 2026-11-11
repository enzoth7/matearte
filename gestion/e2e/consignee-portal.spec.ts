import { test, expect } from "@playwright/test";
import { mockCommerce } from "./commerce-fixture";
import type { ConsigneeDashboard } from "../src/consigneePortalSource";

function dashboard(name: string, reference: string): ConsigneeDashboard {
  return { name, consignments: [{ id: reference, reference, currency: "UYU", createdAt: "2026-11-01T12:00:00Z",
    lines: [{ id: `${reference}-line`, sku: "MATE-1", title: `Mate de ${name}`, quantity: 20,
      unitPriceMinor: 40_000, dispatched: 10, held: 4, returned: 2, kept: 4 }],
    totals: { dispatched: 10, held: 4, returned: 2, kept: 4, heldValueMinor: 160_000,
      confirmedMinor: 160_000, paidMinor: 60_000, creditMinor: 20_000, balanceMinor: 100_000 },
    events: [{ id: `${reference}-sent`, date: "2026-11-02", kind: "dispatch", detail: `Mate de ${name}`,
      quantity: 10, amountMinor: 0 }] }] };
}

test("dos consignatarios ven sus paneles sin cargar datos internos por una URL ajena", async ({ page, context }) => {
  const other = await context.newPage();
  const firstRequests: string[] = [];
  const secondRequests: string[] = [];
  page.on("request", (request) => { if (request.url().includes("supabase.co/rest/v1/")) firstRequests.push(new URL(request.url()).pathname); });
  other.on("request", (request) => { if (request.url().includes("supabase.co/rest/v1/")) secondRequests.push(new URL(request.url()).pathname); });
  await mockCommerce(page, { denied: true, userId: "consignee-a", portalDashboard: dashboard("Local A", "#M201") });
  await mockCommerce(other, { denied: true, userId: "consignee-b", portalDashboard: dashboard("Local B", "#M202") });

  await page.goto("/finanzas/ingresos");
  await other.goto("/clientes/base");
  await expect(page).toHaveURL(/\/consignaciones\/resumen$/);
  await expect(other).toHaveURL(/\/consignaciones\/resumen$/);
  await expect(page.getByRole("heading", { name: "#M201" })).toBeVisible();
  await expect(other.getByRole("heading", { name: "#M202" })).toBeVisible();
  await expect(page.getByText("Mate de Local B")).toHaveCount(0);
  await expect(other.getByText("Mate de Local A")).toHaveCount(0);
  await expect(page.getByText(/UYU\s*1\.000,00 por pagar/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Ver historial" })).toBeVisible();
  expect(new Set(firstRequests)).toEqual(new Set(["/rest/v1/commerce_admin_users"]));
  expect(new Set(secondRequests)).toEqual(new Set(["/rest/v1/commerce_admin_users"]));
});

test("una cuenta pausada no recibe panel", async ({ page }) => {
  await mockCommerce(page, { denied: true, userId: "consignee-paused", portalStatus: 403 });
  await page.goto("/consignaciones/resumen");
  await expect(page.getByRole("alert")).toHaveText("Esta cuenta no tiene acceso a Gestión.");
  await expect(page.getByRole("heading", { name: "Consignaciones" })).toHaveCount(0);
});
