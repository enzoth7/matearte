import { expect, test } from "@playwright/test";
import { mockCommerce } from "./commerce-fixture";

test("la ficha del cliente se abre desde Pedidos y Base", async ({ page }) => {
  await mockCommerce(page);

  for (const path of ["/comercial/pedidos", "/clientes/base"]) {
    await page.goto(path);
    await page.getByRole("button", { name: "Ver ficha de Cliente de prueba" }).first().click();
    const dialog = page.getByRole("dialog", { name: "Cliente de prueba" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("Datos del cliente")).toBeVisible();
    await expect(dialog.getByText("05/04/1993")).toBeVisible();
    await expect(dialog.getByText("Uruguay")).toBeVisible();
    await expect(dialog.getByText("Montevideo")).toBeVisible();
    await expect(dialog.getByText("099000000")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/clientes/base");
  await page.getByRole("button", { name: "Ver ficha de Cliente de prueba" }).click();
  const bounds = await page.getByRole("dialog", { name: "Cliente de prueba" }).boundingBox();
  expect(bounds?.width).toBeLessThanOrEqual(390);
});
