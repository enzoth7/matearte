import { expect, test } from "@playwright/test";
import { mockCommerce } from "./commerce-fixture";

test("Marketing permite editar el afiche sin cambiar el destino del QR", async ({ page }) => {
  await mockCommerce(page);
  await page.goto("/marketing/sorteo");

  await expect(page.getByRole("link", { name: "Sorteo", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("heading", { name: "QR del sorteo" })).toBeVisible();
  await expect(page.locator(".marketing-sorteo-poster")).not.toContainText("UNA INVITACIÓN PARA VOS");
  await expect(page.locator(".marketing-sorteo-poster")).not.toContainText("Tradición que se comparte.");
  await expect.poll(() => page.locator(".marketing-sorteo-logo").evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
  await page.getByRole("textbox", { name: "Título" }).fill("¡Sumate al sorteo!");
  await page.getByRole("textbox", { name: "Descripción" }).fill("Escaneá y participá hoy.");
  await expect(page.locator(".marketing-sorteo-poster h2")).toHaveText("¡Sumate al sorteo!");
  await expect(page.locator(".marketing-sorteo-intro")).toHaveText("Escaneá y participá hoy.");
  await page.reload();
  await expect(page.getByRole("textbox", { name: "Título" })).toHaveValue("¡Sumate al sorteo!");
  await expect(page.getByRole("textbox", { name: "Descripción" })).toHaveValue("Escaneá y participá hoy.");
  await expect(page.getByRole("link", { name: "Abrir el sorteo de MateArte Uruguay" })).toHaveAttribute("href", "https://www.matearteuruguay.com/sorteo");
  await expect.poll(() => page.locator(".marketing-sorteo-qr img").evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);

  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".marketing-sorteo-poster")).toBeVisible();
  await expect(page.locator(".marketing-sorteo-toolbar")).toBeHidden();
  await expect(page.locator(".marketing-sorteo-editor")).toBeHidden();
  await expect(page.locator(".marketing-sorteo-poster h2")).toHaveText("¡Sumate al sorteo!");
});
