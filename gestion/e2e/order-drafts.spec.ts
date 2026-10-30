import { expect, test } from "@playwright/test";
import { mockCommerce } from "./commerce-fixture";

test("la venta minorista se retoma después de recargar", async ({ page }) => {
  await mockCommerce(page, { writable: true });
  await page.goto("/comercial/registrar-min");
  await page.getByLabel("Buscar producto").fill("SKU-1");
  await page.getByRole("button", { name: /SKU-1 · Mate de catálogo/ }).click();
  await page.getByRole("button", { name: "Agregar nuevo cliente" }).click();
  await page.getByLabel("Nombre", { exact: true }).fill("Cliente en borrador");

  await page.reload();
  await expect(page.getByRole("button", { name: "Retomar borrador" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Guardar venta" })).toHaveCount(0);
  await page.getByRole("button", { name: "Retomar borrador" }).click();
  await expect(page.getByLabel("Nombre", { exact: true })).toHaveValue("Cliente en borrador");
  await expect(page.locator(".local-sale-line")).toContainText("Mate de catálogo");
  await page.getByRole("button", { name: "Guardar venta" }).click();
  await expect(page).toHaveURL(/\/comercial\/pedidos/);
  await page.goto("/comercial/registrar-min");
  await expect(page.getByRole("button", { name: "Retomar borrador" })).toHaveCount(0);
});

test("las ventas minoristas mantienen varios borradores separados", async ({ page }) => {
  await mockCommerce(page, { writable: true });
  await page.goto("/comercial/registrar-min");
  await page.getByRole("button", { name: "Agregar nuevo cliente" }).click();
  await page.getByLabel("Nombre", { exact: true }).fill("Cliente Uno");
  await page.getByRole("button", { name: "Ver mis borradores" }).click();
  await expect(page.locator(".order-draft-entry")).toHaveCount(1);
  await page.getByRole("button", { name: "Empezar una venta nueva" }).click();
  await page.getByRole("button", { name: "Agregar nuevo cliente" }).click();
  await page.getByLabel("Nombre", { exact: true }).fill("Cliente Dos");
  await page.reload();
  await expect(page.locator(".order-draft-entry")).toHaveCount(2);
  await page.locator(".order-draft-entry").filter({ hasText: "Cliente Uno" }).getByRole("button", { name: "Retomar borrador" }).click();
  await expect(page.getByLabel("Nombre", { exact: true })).toHaveValue("Cliente Uno");
});

test("el pedido mayorista se retoma después de salir de la sección", async ({ page }) => {
  const { tables } = await mockCommerce(page, { writable: true });
  tables.customers.push({ full_name: "Ana Pérez", first_name: "Ana", last_name: "Pérez", company_name: "Almacén Sur", phone: "", email: "", address: "", notes: "" });
  tables.products.push({ id: "21", model: "Torpedo Acero Liso", variant: "Negro", category_code: "mates", catalog_attributes: { "tipo-mate": "torpedo" }, price_arg: 18800, price_uyu: 500 });
  await page.goto("/comercial/registrar-may");
  await page.getByRole("searchbox", { name: "Buscar cliente" }).fill("Ana");
  await page.getByRole("button", { name: /Ana Pérez · Almacén Sur/ }).click();
  await page.getByRole("searchbox", { name: "Buscar producto" }).fill("Torpedo");
  await page.getByRole("button", { name: /Torpedo Acero Liso/ }).click();
  await page.getByRole("button", { name: "Guardar borrador" }).click();
  await expect(page.getByText("Borrador guardado en este navegador.")).toBeVisible();

  await page.goto("/comercial/pedidos");
  await page.goto("/comercial/registrar-may");
  await expect(page.locator(".order-draft-entry")).toHaveCount(1);
  await page.getByRole("button", { name: "Retomar borrador" }).click();
  await expect(page.getByRole("combobox", { name: "Cliente", exact: true })).toHaveValue("Ana Pérez");
  await expect(page.locator(".wholesale-sale-line")).toContainText("Torpedo Acero Liso");
  await page.getByRole("button", { name: "Ver mis borradores" }).click();
  await page.getByRole("button", { name: "Empezar un pedido nuevo" }).click();
  await page.getByRole("searchbox", { name: "Buscar cliente" }).fill("Ana");
  await page.getByRole("button", { name: /Ana Pérez · Almacén Sur/ }).click();
  await page.getByRole("searchbox", { name: "Buscar producto" }).fill("Torpedo");
  await page.getByRole("button", { name: /Torpedo Acero Liso/ }).click();
  await page.getByRole("spinbutton", { name: "Cantidad 1" }).fill("3");
  await page.reload();
  await expect(page.locator(".order-draft-entry")).toHaveCount(2);
  await page.locator(".order-draft-entry").first().getByRole("button", { name: "Retomar borrador" }).click();
  await expect(page.getByRole("spinbutton", { name: "Cantidad 1" })).toHaveValue("3");
  await page.getByRole("button", { name: "Ver mis borradores" }).click();
  await page.locator(".order-draft-entry").last().getByRole("button", { name: "Retomar borrador" }).click();
  await expect(page.getByRole("spinbutton", { name: "Cantidad 1" })).toHaveValue("1");
});
