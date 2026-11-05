import { expect, test } from "@playwright/test";
import { mockCommerce } from "./commerce-fixture";

test("muestra las terminaciones disponibles junto a Íconos", async ({ page }) => {
  await mockCommerce(page, { writable: true });
  await page.goto("/productos/personalizador");
  const tabs = page.getByRole("navigation", { name: "Configuración del Personalizador" });
  await tabs.getByRole("button", { name: "Terminaciones" }).click();
  const view = page.getByRole("region", { name: "Terminaciones del Personalizador" });
  await expect(view.getByRole("heading", { name: "Virola con grabado láser" })).toBeVisible();
  await expect(view.getByRole("heading", { name: "Virola con apliques" })).toBeVisible();
  await expect(view.getByRole("heading", { name: "Fleje", exact: true })).toBeVisible();
  for (const name of ["Manos", "Pampa", "Abstracto", "Flores", "Griego"]) {
    await expect(view.getByRole("article").filter({ hasText: name }).first()).toBeVisible();
  }
  const petalos = view.getByRole("article").filter({ hasText: "Pétalos" });
  await expect(petalos.locator("img")).toHaveAttribute("src", /\/virola\/petalos\.webp$/);
  await petalos.scrollIntoViewIfNeeded();
  await expect.poll(() => petalos.locator("img").evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
  await view.screenshot({ path: "test-results/terminaciones.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => view.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await view.screenshot({ path: "test-results/terminaciones-mobile.png" });
});
