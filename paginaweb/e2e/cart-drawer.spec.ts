import { expect, test } from "@playwright/test";

test("the header cart opens a responsive drawer with live totals and quantity controls", async ({ page }) => {
  let items = [
    { id: "line-39", quantity: 1, item_type: "catalog", unit_price_minor: 560000, base_unit_price_minor: 560000, currency: "UYU", variant: { id: "variant-39", name: "39", active: true, available_web: true, price_minor: 560000, currency: "UYU", option_values: { color: "marron-blanco", talle: "39" }, product: { id: "shoes", editorial_slug: "zueco-cuero-vaquita", name: "Zueco Cuero Vaquita", category: "calzado", published: true, commerce_product_images: [] } }, design: null },
    { id: "line-40", quantity: 1, item_type: "catalog", unit_price_minor: 560000, base_unit_price_minor: 560000, currency: "UYU", variant: { id: "variant-40", name: "40", active: true, available_web: true, price_minor: 560000, currency: "UYU", option_values: { color: "marron-blanco", talle: "40" }, product: { id: "shoes", editorial_slug: "zueco-cuero-vaquita", name: "Zueco Cuero Vaquita", category: "calzado", published: true, commerce_product_images: [] } }, design: null },
  ];
  await page.route("**/api/session", route => route.fulfill({ json: { authenticated: true, user: { name: "Cliente" }, cartCount: items.reduce((count, item) => count + item.quantity, 0) } }));
  await page.route("**/api/cart", route => route.fulfill({ json: { id: "cart", items } }));
  await page.route("**/api/cart/items", async route => {
    const body = route.request().postDataJSON() as { itemId: string; quantity?: number };
    if (route.request().method() === "DELETE") items = items.filter(item => item.id !== body.itemId);
    if (route.request().method() === "PATCH") items = items.map(item => item.id === body.itemId ? { ...item, quantity: body.quantity ?? item.quantity } : item);
    await route.fulfill({ json: { id: "cart", items } });
  });
  await page.goto("/");
  const mobile = (page.viewportSize()?.width ?? 1440) < 1024;
  await page.locator(mobile ? ".home-header-mobile-cart" : ".home-header-cart").click();
  const drawer = page.getByRole("dialog", { name: "Tu carrito" });
  await expect(drawer).toBeVisible();
  await expect(drawer.getByRole("article")).toHaveCount(2);
  await expect.poll(() => drawer.locator("article img").first().evaluate(image => (image as HTMLImageElement).naturalWidth > 0)).toBe(true);
  await expect(drawer.getByText("12 cuotas de $ 933,33 UYU")).toBeVisible();
  await drawer.getByRole("button", { name: "6" }).click();
  await expect(drawer.getByText("6 cuotas de $ 1.866,67 UYU")).toBeVisible();
  await drawer.getByRole("button", { name: /Agregar una unidad de/ }).first().click();
  await expect(drawer.getByText("6 cuotas de $ 2.800,00 UYU")).toBeVisible();
  await expect(drawer.getByRole("link", { name: "Ir al carrito" })).toHaveAttribute("href", "/carrito");
  await page.screenshot({ path: `artifacts/cart-drawer-${mobile ? "mobile" : "desktop"}.png`, fullPage: false });
  await page.setViewportSize({ width: mobile ? 390 : 1440, height: 600 });
  const pageScroll = await page.evaluate(() => window.scrollY);
  await drawer.evaluate(element => { element.scrollTop = 0; });
  await page.mouse.move(mobile ? 280 : 1240, 400);
  await page.mouse.wheel(0, 350);
  await expect.poll(() => drawer.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
  expect(await page.evaluate(() => window.scrollY)).toBe(pageScroll);
  if (!mobile) {
    await drawer.evaluate(element => { element.scrollTop = 0; });
    await page.mouse.move(400, 400);
    await page.mouse.wheel(0, 350);
    await expect.poll(() => drawer.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
    expect(await page.evaluate(() => window.scrollY)).toBe(pageScroll);
  }
  await drawer.evaluate(element => { element.scrollTop = element.scrollHeight; });
  await expect(drawer.getByRole("img", { name: "OCA" })).toBeVisible();
  await expect(drawer.getByRole("img", { name: "Visa" })).toBeVisible();
  if (!mobile) {
    await expect(drawer.getByRole("img", { name: "OCA" })).toHaveCSS("width", "52px");
    await expect(drawer.getByRole("img", { name: "Visa" })).toHaveCSS("width", "58px");
  }
  await page.screenshot({ path: `artifacts/cart-drawer-logos-${mobile ? "mobile" : "desktop"}.png`, fullPage: false });
  await page.keyboard.press("Escape");
  await expect(drawer).toBeHidden();
});
