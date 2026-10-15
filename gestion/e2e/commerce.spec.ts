import { test, expect } from "@playwright/test";
import { mockCommerce } from "./commerce-fixture";
test("el acceso protege todas las rutas y retira el prototipo", async ({ page }) => {
  await mockCommerce(page, { authenticated: false });
  await page.goto("/comercial/pedidos");
  await expect(page.getByRole("heading", { name: "MateArte Gestión" })).toBeVisible();
  await expect(page.getByLabel("Usuario o correo")).toBeVisible();
  await expect(page.locator("table")).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem("matearte-gestion-demo-v1"))).toBeNull();
});
test("una cuenta sin membresía no recibe registros", async ({ page }) => {
  await mockCommerce(page, { denied: true }); await page.goto("/clientes/base");
  await expect(page.getByText("Esta cuenta no tiene acceso a Gestión.")).toBeVisible();
  await expect(page.locator("table")).toHaveCount(0);
});
test("un error de lectura nunca rellena el panel con ejemplos", async ({ page }) => {
  await mockCommerce(page, { failure: true }); await page.goto("/comercial/pedidos");
  await expect(page.getByText("Lectura interrumpida")).toBeVisible();
  await expect(page.getByText("MA-FAKE")).toHaveCount(0);
  await expect(page.locator("table")).toHaveCount(0);
});
