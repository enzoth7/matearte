import { test, expect } from "@playwright/test";
import { mockCommerce } from "./commerce-fixture";

test("una venta por WhatsApp guarda el envío y la seña en la moneda elegida", async ({ page }) => {
  const { writes } = await mockCommerce(page, { writable: true });
  await page.goto("/comercial/registrar-min");

  const currency = page.getByLabel("Moneda", { exact: true });
  await expect(currency).toHaveValue("UYU");
  await expect(currency.getByRole("option")).toHaveText(["ARS", "UYU", "USD", "BRL"]);
  await expect(page.getByLabel(/^Envío/)).toHaveCount(0);
  await currency.selectOption("BRL");
  await page.getByLabel("Envío (BRL)", { exact: true }).fill("99");
  await currency.selectOption("UYU");
  await expect(page.getByLabel(/^Envío/)).toHaveCount(0);
  await currency.selectOption("USD");
  await expect(page.getByLabel("Envío (USD)", { exact: true })).toHaveValue("");

  await page.getByLabel("Canal de venta").selectOption("WhatsApp");
  await page.getByLabel("Buscar producto").fill("SKU-1");
  await page.getByRole("button", { name: /SKU-1.*Mate de catálogo/ }).click();
  await page.getByLabel("Precio (USD)", { exact: true }).fill("50");
  await page.getByLabel("Envío (USD)", { exact: true }).fill("15");
  await page.getByLabel("Con seña").check();
  await page.getByLabel("Seña cobrada (USD)", { exact: true }).fill("10");
  await expect(page.getByLabel("Fotos de los artículos de la venta").getByText("USD 65", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Guardar venta" }).click();

  await expect.poll(() => writes.find(write => write.table === "gestion_create_local_sale_with_items")?.body).toMatchObject({
    p_channel: "WhatsApp",
    p_currency: "USD",
    p_rate_to_uyu: 40.25,
    p_shipping_minor: 1500,
    p_deposit_minor: 1000,
    p_items: [{ sale_unit_price_minor: 5000 }],
  });
  const detail = page.getByRole("dialog", { name: "Detalle del pedido" });
  await expect(detail.getByText("USD 65", { exact: true })).toBeVisible();
  await expect(detail.getByText("USD 15", { exact: true })).toBeVisible();
  await detail.getByRole("button", { name: "Registrar cobro" }).click();
  await expect(page.getByLabel("Importe cobrado (USD)", { exact: true })).toHaveValue("55");
});
