import { expect, test } from "@playwright/test";
import type { Locator } from "@playwright/test";

const productPath = "/producto/mate-imperial";

async function selectMateOptions(product: Locator) {
  await product.getByRole("group", { name: "Tamaño" }).getByRole("button", { name: "Chico" }).click();
  await product.getByRole("group", { name: "Interior" }).getByRole("button", { name: "Interior Calabaza" }).click();
  await expect(product.getByRole("button", { name: "Agregar al carrito" })).toBeEnabled();
}

test("agregar al carrito como visitante muestra la pieza y actualiza el número", async ({ page }) => {
  await page.route("**/api/session", route => route.fulfill({ json: { authenticated: false, user: null, cartCount: 0 } }));
  await page.route("**/api/cart/items", route => route.fulfill({ status: 401, json: { error: "Iniciá sesión" } }));
  await page.goto(productPath);

  const isDesktop = (page.viewportSize()?.width ?? 1440) >= 1024;
  const product = page.locator(isDesktop ? ".product-desktop-view" : ".product-mobile-view");
  const cart = page.locator(isDesktop ? ".home-header-cart" : ".home-header-mobile-cart");
  await selectMateOptions(product);
  await product.getByRole("button", { name: "Agregar al carrito" }).click();

  const confirmation = page.locator(".cart-added-notice");
  await expect(confirmation).toBeVisible();
  await expect(confirmation.locator("strong")).toHaveText("Agregado al carrito");
  await expect(confirmation).toContainText("Mate Imperial");
  await expect(confirmation.locator("img")).toHaveAttribute("src", /(?:imagenes\/productos|assets\/matearte)/);
  await expect(confirmation.locator("img")).toHaveCSS("object-fit", "cover");
  await expect(confirmation.locator(".cart-added-notice-image")).toHaveCSS("overflow", "hidden");
  const imageSize = await confirmation.locator("img").evaluate(image => ({ width: getComputedStyle(image).width, height: getComputedStyle(image).height }));
  expect(imageSize.width).toBe(imageSize.height);
  await expect(cart).toContainText("1");
  if (process.env.CART_FEEDBACK_SCREENSHOT) {
    await page.waitForTimeout(300);
    await page.screenshot({ path: `artifacts/cart-feedback-${page.viewportSize()!.width}.png` });
  }
  await expect(confirmation).toBeHidden({ timeout: 5000 });

  await product.getByRole("button", { name: "Agregar al carrito" }).click();
  await expect(cart).toContainText("2");
  await expect(page.locator(".cart-added-notice")).toBeVisible();
  if (!isDesktop) {
    if (page.viewportSize()!.width === 390) await page.setViewportSize({ width: 320, height: 700 });
    await expect(cart).toBeVisible();
    const notice = await page.locator(".cart-added-notice").boundingBox();
    expect(notice!.x).toBeGreaterThanOrEqual(0);
    expect(notice!.x + notice!.width).toBeLessThanOrEqual(page.viewportSize()!.width + 1);
  }
});

test("el carrito de una cuenta usa la cantidad devuelta por la compra", async ({ page }) => {
  await page.route("**/api/session", route => route.fulfill({ json: { authenticated: true, user: { name: "Cliente" }, cartCount: 0 } }));
  await page.route("**/api/cart/items", route => route.fulfill({ status: 201, json: { items: [{ quantity: 2 }, { quantity: 1 }] } }));
  await page.goto(productPath);
  const isDesktop = (page.viewportSize()?.width ?? 1440) >= 1024;
  const product = page.locator(isDesktop ? ".product-desktop-view" : ".product-mobile-view");
  await selectMateOptions(product);
  await product.getByRole("button", { name: "Agregar al carrito" }).click();
  await expect(page.locator(isDesktop ? ".home-header-cart" : ".home-header-mobile-cart")).toContainText("3");
  await expect(page.locator(".cart-added-notice")).toContainText("Mate Imperial");
});

test("una compra rechazada no muestra la confirmación ni incrementa el carrito", async ({ page }) => {
  await page.route("**/api/session", route => route.fulfill({ json: { authenticated: true, user: { name: "Cliente" }, cartCount: 0 } }));
  await page.route("**/api/cart/items", route => route.fulfill({ status: 400, json: { error: "Sin stock" } }));
  await page.goto(productPath);
  const isDesktop = (page.viewportSize()?.width ?? 1440) >= 1024;
  const product = page.locator(isDesktop ? ".product-desktop-view" : ".product-mobile-view");
  await selectMateOptions(product);
  await product.getByRole("button", { name: "Agregar al carrito" }).click();
  await expect(product.getByText("No se pudo agregar.")).toBeVisible();
  await expect(page.locator(".cart-added-notice")).toHaveCount(0);
  await expect(page.locator(isDesktop ? ".home-header-cart" : ".home-header-mobile-cart")).not.toContainText("1");
});
