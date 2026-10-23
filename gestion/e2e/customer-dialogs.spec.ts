import { expect, test } from "@playwright/test";
import { mockCommerce } from "./commerce-fixture";

test("la ficha del cliente se abre desde Pedidos, Base y Contactos", async ({ page }) => {
  await mockCommerce(page);
  await page.route("https://*.supabase.co/functions/v1/marketing-workspace", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
      contacts: [{ id: "email:test@example.invalid", name: "Cliente de prueba", email: "test@example.invalid", phone: "099000000", source: "Web", created_at: "2026-10-12T15:00:00Z", has_account: true, subscription_status: "none" }],
      count: 1, summary: { total: 1, origins: [{ source: "Web", contacts: 1 }] },
    }) });
  });

  for (const path of ["/comercial/pedidos", "/clientes/base", "/marketing/contactos"]) {
    await page.goto(path);
    await page.getByRole("button", { name: "Ver ficha de Cliente de prueba" }).first().click();
    const dialog = page.getByRole("dialog", { name: "Cliente de prueba" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("Datos del cliente")).toBeVisible();
    await expect(dialog.getByText("05/04/1993")).toBeVisible();
    await expect(dialog.getByText("Uruguay")).toBeVisible();
    await expect(dialog.getByText("Montevideo")).toBeVisible();
    await expect(dialog.getByText("099000000")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/marketing/contactos");
  await page.getByRole("button", { name: "Ver ficha de Cliente de prueba" }).click();
  const bounds = await page.getByRole("dialog", { name: "Cliente de prueba" }).boundingBox();
  expect(bounds?.width).toBeLessThanOrEqual(390);
});
