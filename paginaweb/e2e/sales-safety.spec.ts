import { expect, test } from "@playwright/test";

test("catálogo, producto, personalización y acceso a compras permanecen disponibles", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.goto("/catalogo");
  const compact = (page.viewportSize()?.width ?? 1440) < 1024;
  const catalog = page.locator(compact ? ".catalog-mobile-view" : ".catalog-desktop-view");
  const product = catalog.locator('a[href*="/producto/"]').first();
  await expect(product).toBeVisible();
  await product.click();
  await expect(page).toHaveURL(/\/producto\//);
  await expect(page.locator(compact ? ".product-mobile-view h1" : ".product-desktop-view h1")).toBeVisible();
  await expect(page.getByRole("button", { name: "Agregar al carrito", exact: true }).filter({ visible: true })).toBeVisible();
  await page.goto("/personalizados");
  await expect(page.getByRole("heading", { level: 1 }).filter({ visible: true })).toBeVisible();
  await page.screenshot({ path: `artifacts/sales-personalization-${compact ? "mobile" : "desktop"}.png`, fullPage: false });
  await page.goto("/checkout");
  await expect(page.locator("main")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Finalizar compra", exact: true })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Nombre completo", exact: true })).toBeVisible();
  await expect(page.getByRole("radio", { name: /retiro en tienda/i })).toBeAttached();
  const telephone = await page.locator('input[name="tel"]').boundingBox();
  expect(telephone).not.toBeNull();
  expect(telephone!.x + telephone!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  await page.screenshot({ path: `artifacts/sales-checkout-${compact ? "mobile" : "desktop"}.png`, fullPage: false });
  for (const [url, language] of [["/en/catalog", "en"], ["/pt/catalogo", "pt-BR"], ["/catalogo", "es-UY"]]) {
    await page.goto(url);
    await expect(page.locator("html")).toHaveAttribute("lang", language);
    await expect(page.locator(compact ? ".catalog-mobile-view" : ".catalog-desktop-view")).toBeVisible();
  }
  expect(errors).toEqual([]);
});
