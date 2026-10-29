import { expect, test } from "@playwright/test";

test("moneda por idioma y entrega argentina en escritorio y móvil", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  for (const [path, label, currency] of [["/catalogo", "Moneda", "UYU"], ["/en/catalog", "Currency", "USD"], ["/pt/catalogo", "Moeda", "BRL"]]) {
    await page.goto(path);
    const compact = (page.viewportSize()?.width || 1440) < 1024;
    if (compact) await page.locator(".home-header-menu").click();
    const selector = page.getByRole("combobox", { name: label }).filter({ visible: true });
    await expect(selector).toHaveValue(currency);
    if (currency !== "UYU") await expect(selector).toBeDisabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  }
  await page.route("**/api/checkout/argentina", route => route.fulfill({ json: { enabled: true, arsPerUyu: 30 } }));
  await page.goto("/checkout");
  await page.getByRole("button", { name: "Argentina · transferencia ARS" }).click();
  await expect(page.getByRole("heading", { name: "Compra por unidad · Argentina" })).toBeVisible();
  await expect(page.getByText("Envío dentro de Argentina a cargo del destinatario. No incluido en el total.")).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Provincia" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Código postal" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  await page.screenshot({ path: `artifacts/argentina-checkout-${page.viewportSize()?.width}.png`, fullPage: true });
  const orderId = "a1111111-1111-4111-8111-111111111111";
  let status = "pending_payment";
  let rejected = false;
  await page.route("**/api/checkout/argentina", async route => {
    if (route.request().method() === "POST") {
      expect(route.request().postDataJSON().customer).toMatchObject({ countryCode: "AR", postalCode: "1000", department: "Buenos Aires" });
      expect(route.request().headers()["idempotency-key"]).toBeTruthy();
      return route.fulfill({ json: { orderId } });
    }
    return route.fulfill({ json: { enabled: true, arsPerUyu: 30 } });
  });
  await page.route(`**/api/orders/${orderId}`, route => route.fulfill({ json: {
    id: orderId, order_number: 999, status, currency: "ARS", items_subtotal_minor: 300000, total_minor: 300000,
    shipping_minor: 0, payment_fee_minor: 0, discount_minor: 0, discount_code: null, paypal_amount_usd_minor: null,
    shipping_method: "national_shipping", shipping_snapshot: { country: "Argentina", payOnDelivery: true },
    customer_snapshot: { purchaseFlow: "argentina_retail_transfer", country: "Argentina", bank: { bank_name: "Banco de prueba", account_holder: "Cuenta de prueba", cbu: "0000000000000000000000", alias: "prueba.e2e" } },
    created_at: "2026-10-29T12:00:00Z", order_items: [],
    commerce_bank_transfer_receipts: rejected ? [{ status: "rejected", rejection_reason: "Archivo equivocado" }] : [],
  } }));
  await page.route(`**/api/orders/${orderId}/receipt`, route => { status = "payment_verification_pending"; rejected = false; return route.fulfill({ json: { ok: true } }); });
  await page.getByRole("textbox", { name: "Nombre completo" }).fill("Comprador de prueba");
  await page.getByRole("textbox", { name: "Teléfono" }).fill("+541111111111");
  await page.getByRole("textbox", { name: "Localidad" }).fill("Buenos Aires");
  await page.getByRole("textbox", { name: "Código postal" }).fill("1000");
  await page.getByRole("textbox", { name: "Dirección" }).fill("Calle de prueba 123");
  await page.getByRole("combobox", { name: "Provincia" }).selectOption("Buenos Aires");
  await page.getByRole("button", { name: "Confirmar pedido y ver datos para transferir" }).click();
  await expect(page).toHaveURL(new RegExp(`/pedidos/${orderId}`));
  await expect(page.getByRole("heading", { name: "Total del pedido: $ 3.000 ARS" })).toBeVisible();
  await expect(page.getByText("prueba.e2e")).toBeVisible();
  await page.locator('input[type="file"]').setInputFiles({ name: "prueba.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.7 test") });
  await page.getByRole("button", { name: "Enviar comprobante" }).click();
  await expect(page.getByText("Recibimos tu comprobante. Estamos revisando el pago.")).toBeVisible();
  status = "payment_failed"; rejected = true;
  await page.reload();
  await expect(page.getByText("Comprobante rechazado: Archivo equivocado. Podés adjuntar otro.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Enviar comprobante" })).toBeDisabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  await page.screenshot({ path: `artifacts/argentina-receipt-${page.viewportSize()?.width}.png`, fullPage: true });
  expect(errors).toEqual([]);
});
