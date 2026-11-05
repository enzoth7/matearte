import { expect, test } from "@playwright/test";
import { mockCommerce } from "./commerce-fixture";

test("muestra las terminaciones disponibles junto a Íconos", async ({ page }) => {
  await mockCommerce(page, { writable: true });
  await page.goto("/productos/personalizador");
  const tabs = page.getByRole("navigation", { name: "Configuración del Personalizador" });
  await tabs.getByRole("button", { name: "Terminaciones" }).click();
  const view = page.getByRole("region", { name: "Terminaciones del Personalizador" });
  await expect(view.getByRole("heading", { name: "Virola con grabado láser" })).toBeVisible();
  await expect(view.getByRole("heading", { name: "Virola con apliques o cincelado", exact: true })).toBeVisible();
  await expect(view.getByRole("heading", { name: "Fleje", exact: true })).toBeVisible();
  const appliqueGroup = view.locator('[aria-labelledby="finish-group-apliques"]');
  await expect(appliqueGroup.getByRole("article")).toHaveCount(9);
  for (const name of ["Laureles", "Pétalos", "Puntas", "Cadenas", "Coronas 2"]) {
    await expect(appliqueGroup.getByRole("article").filter({ hasText: name })).toBeVisible();
  }
  const flejeGroup = view.locator('[aria-labelledby="finish-group-fleje"]');
  await expect(flejeGroup.getByRole("article")).toHaveCount(5);
  for (const name of ["Rupestre", "Pampa", "Abstracto", "Flores", "Griego"]) {
    await expect(flejeGroup.getByRole("article").filter({ hasText: name })).toBeVisible();
  }
  const petalos = appliqueGroup.getByRole("article").filter({ hasText: "Pétalos" });
  await expect(petalos.locator("img")).toHaveAttribute("src", /\/virola\/petalos\.webp$/);
  await petalos.scrollIntoViewIfNeeded();
  await expect.poll(() => petalos.locator("img").evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
  const coronas2 = appliqueGroup.getByRole("article").filter({ hasText: "Coronas 2" });
  await expect(coronas2.locator("img")).toHaveAttribute("src", /\/viroladeapliques\/apliques-07-coronas-2\.webp$/);
  await coronas2.scrollIntoViewIfNeeded();
  await expect.poll(() => coronas2.locator("img").evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
  await view.screenshot({ path: "test-results/terminaciones.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => view.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await view.screenshot({ path: "test-results/terminaciones-mobile.png" });
});
