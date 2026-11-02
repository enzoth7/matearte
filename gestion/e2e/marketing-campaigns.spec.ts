import { expect, test } from "@playwright/test";
import { mockCommerce } from "./commerce-fixture";

test("Campañas permite redactar, elegir destinatarios, previsualizar y consultar envíos sin desborde", async ({ page }) => {
  await mockCommerce(page);
  const sent: { action: string; selectedEmails?: string[]; headline?: string; buttonLabel?: string }[] = [];
  await page.route("https://*.supabase.co/functions/v1/marketing-workspace", async (route) => {
    const body = route.request().postDataJSON() as { action: string; selectedEmails?: string[]; headline?: string; buttonLabel?: string };
    sent.push(body);
    const results: Record<string, unknown> = {
      campaigns: { campaigns: [{ id: "draft-1", subject: "Borrador previo", body: "Texto anterior", image_url: null, target_url: null, mode: "message", audience_mode: "all", selected_emails: [], recipient_count: null, resend_broadcast_id: null, status: "draft", created_at: "2026-11-01T12:00:00Z", sent_at: null }] },
      campaignAudience: { contacts: [{ email: "ana@example.com", name: "Ana", subscription_status: "none" }, { email: "bea@example.com", name: "Bea", subscription_status: "active" }], count: 2, total: 3 },
      saveCampaign: { id: "draft-1" },
      prepareCampaign: { processed: 1, remaining: 0, ready: 1, excluded: 0, done: true },
      sendCampaign: { ok: true, status: "sending", id: "broadcast-1" },
      sentCampaigns: { count: 1, campaigns: [{ id: "old-broadcast", broadcast_id: "old-broadcast", subject: "Campaña anterior", sent_at: "2026-10-28T12:00:00Z", audience_mode: "external", recipient_count: 24, status: "sent", source: "resend" }] },
      campaignDetail: { subject: "Campaña anterior", html: "<!doctype html><html><body><p>Correo anterior</p></body></html>" },
    };
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(results[body.action] || {}) });
  });

  await page.goto("/marketing/campanas");
  await expect(page.getByRole("tab", { name: "Mensaje" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Solo imagen" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Campañas enviadas" })).toBeVisible();
  await page.getByRole("textbox", { name: "Asunto" }).fill("Oferta de prueba");
  await page.getByRole("textbox", { name: "Título" }).fill("Oferta para vos");
  await page.getByRole("textbox", { name: "Descripción" }).fill("Hola Ana\n\nMirá la promoción.");
  await page.getByRole("textbox", { name: "Enlace opcional" }).fill("https://www.matearteuruguay.com/promocion");
  await page.getByRole("textbox", { name: "Texto del botón" }).fill("Ver promoción");
  await expect(page.frameLocator('iframe[title="Vista previa de la campaña"]').locator("body")).toContainText("Mirá la promoción.");
  await expect(page.frameLocator('iframe[title="Vista previa de la campaña"]').locator("h1")).toHaveText("Oferta para vos");
  await expect(page.frameLocator('iframe[title="Vista previa de la campaña"]').getByRole("link", { name: "VER PROMOCIÓN" })).toBeVisible();
  await page.screenshot({ path: "artifacts/marketing-campaign-message-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  await page.screenshot({ path: "artifacts/marketing-campaign-message-mobile.png", fullPage: true });
  await page.setViewportSize({ width: 1280, height: 720 });
  await expect(page.getByText("Todos (3)")).toBeVisible();
  await page.getByText("Elegir personas (0)").click();
  await page.getByRole("checkbox").first().check();
  await expect(page.getByText("Elegir personas (1)")).toBeVisible();
  await page.getByRole("button", { name: "Guardar borrador" }).click();
  await expect.poll(() => sent.some((item) => item.action === "saveCampaign" && item.selectedEmails?.includes("ana@example.com"))).toBe(true);
  expect(sent.find((item) => item.action === "saveCampaign")?.headline).toBe("Oferta para vos");
  expect(sent.find((item) => item.action === "saveCampaign")?.buttonLabel).toBe("Ver promoción");
  let confirmation = "";
  page.on("dialog", async (dialog) => { confirmation = dialog.message(); await dialog.accept(); });
  await page.getByRole("button", { name: "Enviar campaña" }).click();
  await expect.poll(() => sent.some((item) => item.action === "sendCampaign")).toBe(true);
  expect(confirmation).toContain("1 persona");

  await page.getByRole("tab", { name: "Solo imagen" }).click();
  await page.locator('input[type="file"]').setInputFiles({ name: "promo.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lXcAAAAASUVORK5CYII=", "base64") });
  await expect(page.frameLocator('iframe[title="Vista previa de la campaña"]').locator("img")).toHaveCount(1);
  await expect(page.frameLocator('iframe[title="Vista previa de la campaña"]').locator("h2")).toHaveCount(0);

  await page.getByRole("tab", { name: "Campañas enviadas" }).click();
  await expect(page.getByRole("heading", { name: "Campañas enviadas (1)" })).toBeVisible();
  await page.getByRole("button", { name: /Campaña anterior/ }).click();
  await expect(page.frameLocator('iframe[title="Correo enviado: Campaña anterior"]').locator("body")).toContainText("Correo anterior");
  await page.screenshot({ path: "artifacts/marketing-campaigns-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  await page.getByRole("tab", { name: "Solo imagen" }).click();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  await page.screenshot({ path: "artifacts/marketing-campaigns-mobile.png", fullPage: true });
});

test("Campañas divide un segmento en tandas, comparte el descuento y avisa el cupo del día", async ({ page }) => {
  await mockCommerce(page);
  type Body = { action: string; id?: string; segmentId?: string; batchSize?: number; discountCode?: string; audienceMode?: string };
  const sent: Body[] = [];
  let split = false;
  const draft = (id: string, number: number | null) => ({
    id, subject: "Cyberlunes", headline: "Cyberlunes", body: "Descuentos todo el día", button_label: null, image_url: null, target_url: "https://www.matearteuruguay.com/catalogo",
    mode: "message", audience_mode: number ? "selected" : "all", selected_emails: number ? ["ana@example.com"] : [], recipient_count: null, resend_broadcast_id: null,
    status: "draft", created_at: "2026-11-02T12:00:00Z", sent_at: null,
    batch_group_id: number ? "group-1" : null, batch_number: number, batch_total: number ? 3 : null, segment_name: number ? "Nunca compraron" : null,
    discount_code: "CYBER20", utm_campaign: "cyberlunes-20261102",
  });
  await page.route("https://*.supabase.co/functions/v1/marketing-workspace", async (route) => {
    const body = route.request().postDataJSON() as Body;
    sent.push(body);
    const results: Record<string, unknown> = {
      campaigns: { campaigns: split ? [draft("draft-2", 1), draft("draft-3", 2), draft("draft-4", 3)] : [draft("draft-2", null)] },
      campaignAudience: { contacts: [], count: 0, total: 165 },
      segments: { segments: [{ id: "seg-1", name: "Nunca compraron", filters: { purchase: "never" }, updated_at: "2026-11-02T12:00:00Z" }], total: 165, options: { sources: [], countries: [], channels: [] } },
      segmentPreview: { count: 165, sample: [] },
      campaignDiscounts: { discounts: [{ code: "CYBER20", discount_type: "percentage", value: 20, valid_from: "2026-11-01", valid_until: "2026-12-01" }] },
      campaignQuota: { sentToday: 16 },
      saveCampaign: { id: "draft-2" },
      createBatches: (split = true, { groupId: "group-1", total: 165, batches: [80, 80, 5] }),
      prepareCampaign: { processed: 90, remaining: 0, ready: 90, excluded: 0, done: true },
      sendCampaign: { ok: true, status: "sending", id: "broadcast-1" },
    };
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(results[body.action] || {}) });
  });

  await page.goto("/marketing/campanas");
  await page.getByRole("textbox", { name: "Asunto" }).fill("Cyberlunes");
  await page.getByRole("textbox", { name: "Título" }).fill("Cyberlunes");
  await page.getByRole("textbox", { name: "Descripción" }).fill("Descuentos todo el día");
  await page.getByLabel("Descuento opcional").selectOption("CYBER20");
  await expect(page.frameLocator('iframe[title="Vista previa de la campaña"]').locator("body")).toContainText("CYBER20");

  await page.getByText("Un segmento (1)").click();
  await page.getByLabel("Segmento", { exact: true }).selectOption("seg-1");
  await expect(page.getByText("Nunca compraron · 165 personas")).toBeVisible();
  await expect(page.getByText(/165 personas → 3 tandas/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Dividir en tandas" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Enviar campaña" })).toHaveCount(0);

  await page.getByRole("button", { name: "Guardar borrador" }).click();
  await expect.poll(() => sent.some((item) => item.action === "saveCampaign" && item.discountCode === "CYBER20" && item.audienceMode === "all")).toBe(true);
  await expect(page.getByText("Hoy salieron 16 correos de campañas.")).toBeVisible();
  await page.getByRole("button", { name: "Dividir en tandas" }).click();
  await expect.poll(() => sent.some((item) => item.action === "createBatches" && item.id === "draft-2" && item.segmentId === "seg-1" && item.batchSize === 80)).toBe(true);

  await expect(page.getByText("Tanda 1 de 3", { exact: true })).toBeVisible();
  await expect(page.getByText("Segmento Nunca compraron · 1 persona")).toBeVisible();
  await expect(page.getByRole("button", { name: "Eliminar tandas pendientes" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Enviar tanda 1 de 3" })).toBeVisible();
  await expect(page.getByRole("radio", { name: /Todos/ })).toHaveCount(0);

  let confirmation = "";
  page.on("dialog", async (dialog) => { confirmation = dialog.message(); await dialog.accept(); });
  await page.getByRole("button", { name: "Enviar tanda 1 de 3" }).click();
  await expect.poll(() => sent.some((item) => item.action === "sendCampaign")).toBe(true);
  expect(confirmation).toContain("90 personas");
  expect(confirmation).toContain("hoy ya salieron 16 correos");

  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
});
