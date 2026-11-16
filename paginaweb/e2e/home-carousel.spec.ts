import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    sessionStorage.setItem("matearte-welcome-dismissed", "1"),
  );
});

test("cuatro escenas, enlaces y selección con teclado", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const hero = page.locator(".home-carousel");
  await expect(hero.locator("article[data-active=true]")).toHaveAttribute(
    "id",
    "hero-champions",
  );
  for (const [index, key] of [
    "champions",
    "custom",
    "leather",
    "tradition",
  ].entries()) {
    const control = hero.locator("nav button").nth(index);
    await control.focus();
    await page.keyboard.press("Enter");
    const scene = hero.locator(`#hero-${key}`);
    await expect(scene).toHaveAttribute("data-active", "true");
    await expect(scene.locator("a")).toHaveAttribute(
      "href",
      key === "custom"
        ? "/personalizados"
        : key === "champions"
          ? "/catalogo?coleccion=uruguay"
          : "/catalogo",
    );
    await expect(scene.locator("img")).toBeVisible();
    await expect
      .poll(() =>
        scene
          .locator("img")
          .evaluate(
            (image: HTMLImageElement) =>
              image.complete && image.naturalWidth > 0,
          ),
      )
      .toBe(true);
    await expect(hero.locator("article[inert]")).toHaveCount(3);
  }
  await expect(hero.locator(".home-carousel-pause")).toBeHidden();
  await page.waitForTimeout(5200);
  await expect(hero.locator("article[data-active=true]")).toHaveAttribute(
    "id",
    "hero-tradition",
  );
});

test("avance automático, pausa al interactuar y gesto táctil", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  const hero = page.locator(".home-carousel");
  await expect(hero.locator("article[data-active=true]")).toHaveAttribute(
    "id",
    "hero-champions",
  );
  await expect(hero.locator("article[data-active=true]")).toHaveAttribute(
    "id",
    "hero-custom",
    { timeout: 7500 },
  );
  await hero.locator("nav button").nth(2).click();
  await page.mouse.move(0, 0);
  await page.keyboard.press("Tab");
  await page.waitForTimeout(5200);
  await expect(hero.locator("article[data-active=true]")).toHaveAttribute(
    "id",
    "hero-leather",
  );
  const session = await page.context().newCDPSession(page);
  await session.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: 300, y: 300 }],
  });
  await session.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x: 100, y: 310 }],
  });
  await session.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await expect(hero.locator("article[data-active=true]")).toHaveAttribute(
    "id",
    "hero-tradition",
  );
});

for (const [locale, title] of [
  ["en", "THE MATE OF"],
  ["pt", "O MATE DOS"],
]) {
  test(`inicio en ${locale} sin desbordes`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(`/${locale}`);
    await expect(page.locator(".home-carousel h1")).toContainText(title);
    const dimensions = await page.evaluate(() => ({
      width: document.documentElement.clientWidth,
      content: document.documentElement.scrollWidth,
    }));
    expect(dimensions.content).toBe(dimensions.width);
    await expect(page.locator(".home-carousel nav button")).toHaveCount(4);
  });
}
