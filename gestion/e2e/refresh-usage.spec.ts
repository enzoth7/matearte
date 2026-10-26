import { test, expect, type Page } from "@playwright/test";
import { mockCommerce } from "./commerce-fixture";

async function visibility(page: Page, state: "visible" | "hidden") {
  await page.evaluate((state) => {
    Object.defineProperty(document, "visibilityState", { configurable: true, value: state });
    document.dispatchEvent(new Event("visibilitychange"));
    window.dispatchEvent(new Event("focus"));
  }, state);
}

test("Gestión solo actualiza al entrar, volver o pedirlo; nunca por quedar abierta", async ({ page }) => {
  await mockCommerce(page);
  await page.clock.install();
  let snapshots = 0;
  page.on("request", request => {
    if (new URL(request.url()).pathname === "/rest/v1/shipping_rates") snapshots++;
  });
  await page.goto("/inicio/resumen");
  await expect(page.getByRole("button", { name: "Actualizar", exact: true })).toBeEnabled();
  await expect(page.getByText(/^Actualizado \d/)).toBeVisible();
  const initial = snapshots;
  expect(initial).toBeGreaterThan(0);

  await page.clock.runFor(32_000);
  expect(snapshots).toBe(initial);
  await visibility(page, "hidden");
  await page.clock.runFor(60_000);
  expect(snapshots).toBe(initial);

  await visibility(page, "visible");
  await page.clock.runFor(200);
  await expect.poll(() => snapshots).toBe(initial + 1);
  await expect(page.getByRole("button", { name: "Actualizar", exact: true })).toBeEnabled();
  await page.clock.runFor(16_000);
  expect(snapshots).toBe(initial + 1);

  await page.getByRole("button", { name: "Actualizar", exact: true }).click();
  await expect.poll(() => snapshots).toBe(initial + 2);
  await expect(page.getByRole("button", { name: "Actualizar", exact: true })).toBeEnabled();
});

test("guardar un producto refresca los datos compartidos sin esperar un intervalo", async ({ page }) => {
  const { fixture } = await mockCommerce(page, { writable: true });
  let snapshots = 0;
  page.on("request", request => {
    if (new URL(request.url()).pathname === "/rest/v1/shipping_rates") snapshots++;
  });
  await page.goto("/productos/catalogo");
  await expect(page.getByRole("button", { name: "Actualizar", exact: true })).toBeEnabled();
  await page.locator(".product-card").first().click();
  await page.locator(".product-details").getByRole("textbox", { name: "Nombre", exact: true }).fill("Mate actualizado sin sondeo");
  const beforeSave = snapshots;
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect.poll(() => fixture.products[0].name).toBe("Mate actualizado sin sondeo");
  await expect.poll(() => snapshots).toBeGreaterThan(beforeSave);
  await expect(page.getByRole("button", { name: "Actualizar", exact: true })).toBeEnabled();
});
