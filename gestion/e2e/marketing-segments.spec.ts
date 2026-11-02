import { expect, test } from "@playwright/test";
import { mockCommerce } from "./commerce-fixture";

type Body = { action: string; id?: string; name?: string; filters?: Record<string, unknown> };

test("Segmentos combina criterios, cuenta en vivo y guarda sin desborde", async ({ page }) => {
  await mockCommerce(page);
  const sent: Body[] = [];
  await page.route("https://*.supabase.co/functions/v1/marketing-workspace", async (route) => {
    const body = route.request().postDataJSON() as Body;
    sent.push(body);
    const never = body.filters?.purchase === "never";
    const results: Record<string, unknown> = {
      segments: { segments: [{ id: "seg-1", name: "Nunca compraron", filters: { purchase: "never" }, updated_at: "2026-11-02T12:00:00Z" }], total: 165, options: { sources: ["Sorteo", "Web"], countries: ["UY", "AR"], channels: ["Local", "Web"] } },
      segmentPreview: { count: never ? 133 : 165, sample: [{ email: "ana@example.com", name: "Ana", source: "Web", country: "UY", channel: null, purchase_count: never ? 0 : 2, last_purchase_at: never ? null : "2026-10-20T12:00:00Z" }] },
      saveSegment: { id: "seg-2" },
      deleteSegment: { ok: true },
    };
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(results[body.action] || {}) });
  });

  await page.goto("/marketing/segmentos");
  await expect(page.getByRole("heading", { name: "Segmentos", level: 2 })).toBeVisible();
  await expect(page.getByText("165 personas con correo pueden recibir campañas.")).toBeVisible();
  await expect(page.getByText("de 165")).toBeVisible();

  await page.getByRole("button", { name: /Nunca compraron/ }).click();
  await expect(page.getByLabel("Compras", { exact: true })).toHaveValue("never");
  await expect(page.getByRole("region", { name: "Resultado del segmento" }).locator(".marketing-segment-count strong")).toHaveText("133");
  await expect(page.getByLabel("Compras o más")).toHaveCount(0);

  await page.getByLabel("Compras", { exact: true }).selectOption("bought");
  await page.getByLabel("Última compra hace más de (días)").fill("90");
  await page.getByLabel("Sorteo").check();
  await page.getByLabel("Uruguay").check();
  await page.getByRole("textbox", { name: "Nombre" }).fill("Compraron hace mucho");
  await expect.poll(() => sent.some((item) => item.action === "segmentPreview" && JSON.stringify(item.filters) === JSON.stringify({ purchase: "bought", lastPurchaseOlderThanDays: 90, sources: ["Sorteo"], countries: ["UY"] }))).toBe(true);

  await page.getByRole("button", { name: "Guardar segmento" }).click();
  await expect.poll(() => sent.some((item) => item.action === "saveSegment")).toBe(true);
  const saved = sent.find((item) => item.action === "saveSegment");
  expect(saved?.name).toBe("Compraron hace mucho");
  expect(saved?.id).toBe("seg-1");
  expect(saved?.filters).toEqual({ purchase: "bought", lastPurchaseOlderThanDays: 90, sources: ["Sorteo"], countries: ["UY"] });

  await page.getByRole("button", { name: "Nuevo", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Nuevo segmento" })).toBeVisible();
  await expect(page.getByLabel("Compras", { exact: true })).toHaveValue("any");

  await page.screenshot({ path: "artifacts/marketing-segments-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  await page.screenshot({ path: "artifacts/marketing-segments-mobile.png", fullPage: true });
});
