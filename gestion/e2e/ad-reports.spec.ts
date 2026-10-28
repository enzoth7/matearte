import { test, expect, type Page } from "@playwright/test";
import { mockCommerce } from "./commerce-fixture";

async function fillCampaign(page: Page, position: number, name: string, conversations: string, cost: string, total: string) {
  await page.getByLabel(`Nombre de la campaña ${position}`).fill(name);
  await page.getByLabel(`Conversaciones de la campaña ${position}`).fill(conversations);
  await page.getByLabel(`Costo por conversación de la campaña ${position}`).fill(cost);
  await page.getByLabel(`Total de la campaña ${position}`).fill(total);
}

test("Informes de pauta: se carga el informe del 19 al 26 de octubre, calcula las cuentas y arrastra el saldo", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const { tables } = await mockCommerce(page, { writable: true });
  await page.goto("/marketing/pauta");
  await expect(page.getByText("Todavía no cargaste informes de pauta")).toBeVisible();

  await page.getByRole("button", { name: "Nuevo informe" }).click();
  const form = page.getByRole("dialog");
  // Sin nombre de campaña no se puede guardar.
  await form.getByLabel("Desde").fill("2026-10-19");
  await form.getByLabel("Hasta").fill("2026-10-26");
  await form.getByLabel("Total de la campaña 1").fill("100");
  await form.getByRole("button", { name: "Guardar informe" }).click();
  await expect(form.getByRole("alert")).toContainText("necesita un nombre");

  await fillCampaign(page, 1, "Botas Iguazú", "66", "20,10", "1.388");
  await form.getByRole("button", { name: "Agregar campaña" }).click();
  await fillCampaign(page, 2, "Mates Personalizados", "121", "31,40", "3.890");
  await form.getByRole("button", { name: "Agregar campaña" }).click();
  await fillCampaign(page, 3, "Matera paso atrás", "103", "38,44", "3.959");
  await form.getByLabel("Depósito realizado").fill("10.000");
  await form.getByLabel("Fecha del depósito").fill("2026-10-19");
  await form.getByLabel("Saldo anterior", { exact: true }).fill("3.780");
  await form.getByLabel("Importante (notas)").fill("Se reemplazan 2 conjuntos de anuncios en la campaña de las botas.");

  const accounts = form.getByLabel("Cuentas del informe");
  await expect(accounts).toContainText("UYU 9.237,00");
  await expect(accounts).toContainText("UYU 6.220,00");
  await expect(accounts).toContainText("3.017,00");
  await form.getByRole("button", { name: "Guardar informe" }).click();

  // En la tabla queda lo principal; el detalle completo se abre con el botón +.
  const row = page.getByRole("row").filter({ hasText: "19 al 26 de octubre de 2026" });
  await expect(row).toBeVisible();
  await expect(row).toContainText("3 campañas");
  await expect(row).toContainText("Botas Iguazú · Mates Personalizados · Matera paso atrás");
  await expect(row).toContainText("290");
  await expect(row).toContainText("UYU 31,85");
  await expect(row).toContainText("UYU 9.237,00");
  await expect(row).toContainText("UYU 10.000,00");
  await expect(row.locator(".ad-balance.is-debt")).toContainText("3.017,00");
  await expect(page.getByLabel("Informe del 19 al 26 de octubre de 2026", { exact: true })).toHaveCount(0);
  await row.getByRole("button", { name: /Ver detalle/ }).click();
  const detail = page.getByRole("dialog");
  await expect(detail.getByRole("heading", { name: "Detalle del informe de pauta" })).toBeVisible();
  const card = detail.getByLabel("Informe del 19 al 26 de octubre de 2026", { exact: true });
  await expect(card).toBeVisible();
  await expect(card.getByRole("heading")).toHaveText("19 al 26 de octubre de 2026");
  await expect(card.getByLabel("Campañas del informe")).toContainText("Mates Personalizados");
  await expect(card.getByLabel("Campañas del informe")).toContainText("UYU 38,44");
  await expect(card.getByLabel("Disponibilidad de fondos")).toContainText("Saldo pendiente anterior");
  await expect(card.getByLabel("Disponibilidad de fondos")).toContainText("UYU 6.220,00");
  await expect(card.getByLabel("Disponibilidad de fondos").locator(".is-debt")).toContainText("3.017,00");
  await expect(card).toContainText("Se reemplazan 2 conjuntos");

  expect(tables.ad_reports).toHaveLength(1);
  expect(tables.ad_reports[0]).toMatchObject({ period_start: "2026-10-19", period_end: "2026-10-26", platform: "Meta", currency: "UYU", deposit_minor: 1000000, deposit_on: "2026-10-19", previous_balance_minor: -378000 });
  expect(tables.ad_reports[0].campaigns).toEqual([
    { name: "Botas Iguazú", conversations: 66, cost_per_conversation_minor: 2010, total_minor: 138800 },
    { name: "Mates Personalizados", conversations: 121, cost_per_conversation_minor: 3140, total_minor: 389000 },
    { name: "Matera paso atrás", conversations: 103, cost_per_conversation_minor: 3844, total_minor: 395900 },
  ]);

  const stats = page.locator(".stats");
  await expect(stats).toContainText("UYU 9.237,00");
  await expect(stats).toContainText("290");
  await expect(stats.locator(".tone-red")).toContainText("3.017,00");

  await card.getByRole("button", { name: "Copiar informe" }).click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toContain("TOTAL GENERAL: UYU 9.237,00");
  await detail.getByRole("button", { name: /cerrar/i }).first().click();

  // El próximo informe arranca con el saldo pendiente que quedó.
  await page.getByRole("button", { name: "Nuevo informe" }).click();
  const next = page.getByRole("dialog");
  await expect(next.getByLabel("Saldo anterior", { exact: true })).toHaveValue("3017");
  await expect(next.getByLabel("Tipo de saldo anterior")).toHaveValue("pending");
  await next.getByRole("button", { name: "Cancelar" }).click();

  // Edición y eliminación, siempre desde el detalle.
  await row.getByRole("button", { name: /Ver detalle/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Editar" }).click();
  await expect(page.getByRole("dialog").getByRole("heading", { name: "Editar informe de pauta" })).toBeVisible();
  await page.getByRole("dialog").getByLabel("Importante (notas)").fill("Nota corregida.");
  await page.getByRole("dialog").getByRole("button", { name: "Guardar informe" }).click();
  await expect.poll(() => tables.ad_reports[0].notes).toBe("Nota corregida.");
  await row.getByRole("button", { name: /Ver detalle/ }).click();
  await expect(page.getByRole("dialog").getByLabel("Informe del 19 al 26 de octubre de 2026", { exact: true })).toContainText("Nota corregida.");

  page.on("dialog", (dialog) => void dialog.accept());
  await page.getByRole("dialog").getByRole("button", { name: "Eliminar" }).click();
  await expect(page.getByText("Todavía no cargaste informes de pauta")).toBeVisible();
  expect(tables.ad_reports).toHaveLength(0);
});
