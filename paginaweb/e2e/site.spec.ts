import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("portada, navegación y accesibilidad", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Una tradición");
  await expect(page.locator("html")).toHaveClass(/lenis/);
  const stackLayers = page.locator(".scroll-stack-layer");
  await expect(stackLayers).toHaveCount(12);
  await expect(stackLayers.first()).toHaveCSS("position", "sticky");
  await expect(stackLayers.last()).toHaveCSS("position", "sticky");
  await expect(stackLayers.nth(3)).toHaveAttribute("data-stack-mode", "tall");
  await expect(page.getByRole("button", { name: /Selector de idioma próximamente/ })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Carrito próximamente" })).toBeDisabled();
  await page.waitForTimeout(500);
  await page.getByRole("link", { name: "Explorar catálogo" }).click();
  await expect(page).toHaveURL(/\/catalogo/);
  await expect(page).toHaveTitle(/Catálogo/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Piezas para el ritual");
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((violation) => ["serious", "critical"].includes(violation.impact ?? ""))).toEqual([]);
});

test("filtros y detalle de producto son funcionales", async ({ page }) => {
  await page.goto("/catalogo");
  await page.getByLabel("Categoría").selectOption("mates");
  await expect(page).toHaveURL(/categoria=mates/);
  await page.getByPlaceholder("Buscar por nombre o material").fill("imperial");
  await expect(page.getByText("Mate Imperial", { exact: true }).first()).toBeVisible();
  await page.getByRole("link", { name: /Mate Imperial/ }).first().click();
  await expect(page).toHaveURL(/\/producto\/mate-imperial/);
  await expect(page.getByText(/Precio y compra todavía no disponibles/)).toBeVisible();
});

test("la presentación multimedia está visible y el comercio permanece desactivado", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Historias que se ven en movimiento." })).toBeVisible();
  const heroVideo = page.locator("video[data-hero-video]");
  await expect(heroVideo).toHaveAttribute("autoplay", "");
  await expect(heroVideo).toHaveAttribute("loop", "");
  const video = page.locator("#video-story-panel video");
  await expect(video).toHaveAttribute("preload", "metadata");
  await expect(video).toHaveAttribute("autoplay", "");
  await expect(page.getByAltText("Escudo de la Asociación Uruguaya de Fútbol")).toBeVisible();
  await video.scrollIntoViewIfNeeded();
  await expect.poll(() => video.evaluate((element) => (element as HTMLVideoElement).muted)).toBe(true);
  await expect.poll(() => video.evaluate((element) => (element as HTMLVideoElement).paused)).toBe(false);
  await page.getByRole("button", { name: "Pausar video" }).click();
  await expect.poll(() => video.evaluate((element) => (element as HTMLVideoElement).paused)).toBe(true);
  await expect(page.getByText("Presentación interna.")).toBeVisible();
  const cartResponse = await page.goto("/carrito");
  expect(cartResponse?.status()).toBe(404);
});

test("respeta reduced motion y no desborda horizontalmente", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const stackLayers = page.locator(".scroll-stack-layer");
  await expect(stackLayers.first()).toHaveCSS("position", "relative");
  await expect(stackLayers.last()).toHaveCSS("position", "relative");
  const widths = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  expect(widths.scroll).toBeLessThanOrEqual(widths.client + 1);
});

test("las fotos de La tradición viaja responden al hover", async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 0) < 1024, "El hover corresponde a puntero de escritorio");
  await page.goto("/");
  const image = page.getByAltText(/Darwin Núñez/);
  await image.scrollIntoViewIfNeeded();
  const card = image.locator("..");
  const before = await image.evaluate((element) => getComputedStyle(element).scale);
  await card.hover();
  await page.waitForTimeout(350);
  const after = await image.evaluate((element) => getComputedStyle(element).scale);
  expect(after).not.toBe(before);
});

test("clientes presenta el alcance internacional y controla el carrusel", async ({ page }) => {
  await page.goto("/clientes");
  await expect(page).toHaveTitle(/Clientes alrededor del mundo/);
  await expect(page.getByRole("heading", { level: 1, name: /Hecho acá/ })).toBeVisible();
  await expect(page.getByRole("img", { name: "Destinos internacionales de MateArte Uruguay" })).toBeVisible();

  const destinations = page.getByRole("list", { name: "Lista de destinos internacionales" });
  await expect(destinations.getByRole("button")).toHaveCount(13);
  await destinations.getByRole("button", { name: /Singapur/ }).click();
  await expect(page.getByText("Asia", { exact: true })).toBeVisible();

  const pauseButton = page.getByRole("button", { name: "Pausar carrusel" });
  await expect(pauseButton).toBeVisible();
  await pauseButton.click();
  await expect(page.getByRole("button", { name: "Reanudar carrusel" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".testimonial-scroller").first()).toHaveAttribute("data-paused", "true");
  await expect(page.getByText("Contenido demostrativo.")).toBeVisible();

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((violation) => ["serious", "critical"].includes(violation.impact ?? ""))).toEqual([]);
});

test("el carrusel internacional respeta reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/clientes");
  await expect(page.getByRole("button", { name: "Movimiento reducido" })).toBeDisabled();
  await expect(page.locator(".testimonial-track").first()).toHaveCSS("animation-name", "none");
});

test("el menú móvil abre, identifica su estado y navega", async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 1440) >= 1024, "Solo corresponde a navegación móvil");
  await page.goto("/");
  const menuButton = page.getByRole("button", { name: "Abrir menú" });
  await menuButton.click();
  await expect(page.getByRole("button", { name: "Cerrar menú" })).toHaveAttribute("aria-expanded", "true");
  await page.getByRole("navigation", { name: "Navegación móvil" }).getByRole("link", { name: /Nosotros/ }).click();
  await expect(page).toHaveURL(/\/nosotros/);
});
