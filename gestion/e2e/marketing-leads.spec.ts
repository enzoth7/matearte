import { expect, test } from "@playwright/test";
import { mockCommerce } from "./commerce-fixture";

test("Leads oculta datos de contacto y compara registros con compras por período", async ({ page }) => {
  await mockCommerce(page);
  await page.route("https://*.supabase.co/functions/v1/marketing-workspace", async (route) => {
    const body = route.request().postDataJSON();
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Montevideo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    const result = body.action === "registrationTrend"
      ? { today, days: Number(body.days), trend: [{ registered_on: today, registered: 5, purchased: 2 }] }
      : { contacts: [{ id: "email:test@example.invalid", name: "Lead Prueba", email: "test@example.invalid", phone: "099000000", source: "Instagram", channel: "Web", country: "UY", created_at: `${today}T15:00:00Z`, has_account: true, subscription_status: "none" }], count: 1, summary: { total: 1, origins: [{ source: "Instagram", contacts: 1 }] } };
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(result) });
  });

  await page.goto("/marketing/contactos");
  await expect(page.getByRole("heading", { name: "Leads" })).toBeVisible();
  const table = page.locator(".marketing-directory-table");
  await expect(table.getByRole("columnheader")).toHaveText(["Cliente", "Origen", "Canal", "País", "Suscripción", "Cuenta", "Alta"]);
  const row = table.getByRole("row").filter({ hasText: "Lead Prueba" });
  await expect(row).toContainText("Instagram");
  await expect(row).toContainText("Web");
  await expect(row).toContainText("Uruguay");
  await expect(row.getByRole("button")).toHaveCount(0);
  await expect(table).not.toContainText("test@example.invalid");
  await expect(table).not.toContainText("099000000");
  await expect(page.getByRole("heading", { name: "Registros y compras" })).toBeVisible();
  await expect(page.locator(".marketing-trend-key")).toHaveText("RegistradosCon compra");
  await page.screenshot({ path: "artifacts/marketing-leads-desktop.png", fullPage: true });

  for (const days of [7, 14]) {
    const request = page.waitForRequest((candidate) => candidate.url().endsWith("/functions/v1/marketing-workspace") && candidate.postDataJSON()?.action === "registrationTrend" && candidate.postDataJSON()?.days === days);
    await page.getByRole("combobox", { name: "Período del gráfico" }).selectOption(String(days));
    await request;
    await expect(page.getByRole("combobox", { name: "Período del gráfico" })).toHaveValue(String(days));
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  await expect.poll(() => page.locator(".marketing-trend-scroll").evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
  await page.screenshot({ path: "artifacts/marketing-leads-mobile.png", fullPage: true });
});
