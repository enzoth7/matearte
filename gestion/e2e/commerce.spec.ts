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
test("el primer administrador puede definir sus credenciales desde el ingreso", async ({ page }) => {
  const { writes } = await mockCommerce(page, { authenticated: false, needsSetup: true });
  await page.goto("/administracion/usuarios");
  await page.getByRole("button", { name: "Configurar primer usuario" }).click();
  await page.getByLabel("Usuario de ingreso").fill("richard");
  await page.getByLabel("Contraseña", { exact: true }).fill("clave-segura-2026");
  await page.getByLabel("Confirmar contraseña").fill("clave-segura-2026");
  await page.getByRole("button", { name: "Crear acceso e ingresar" }).click();
  await expect(page.getByRole("tab", { name: "Usuarios" })).toBeVisible();
  expect(writes.some((write) => write.table === "gestion-users" && write.body.action === "bootstrap" && write.body.username === "richard")).toBe(true);
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
