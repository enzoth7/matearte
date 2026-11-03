import { test, expect } from "@playwright/test";
import { mockCommerce } from "./commerce-fixture";

test("Marketing muestra los correos automáticos y las plantillas de Resend", async ({ page }) => {
  await mockCommerce(page);
  await page.goto("/marketing/email-templates");
  await expect(page.getByRole("heading", { name: "Email templates" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Pedido recibido/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Cumpleaños/ })).toBeVisible();
  await expect(page.getByText("Supabase Auth")).toHaveCount(0);
  await page.getByRole("button", { name: /Pedido recibido/ }).click();
  await expect(page.getByText("Asunto: Recibimos tu pedido #123")).toBeVisible();
  const receivedPreview = page.frameLocator('iframe[title="Vista previa de Pedido recibido"]');
  await expect(receivedPreview.getByText("Descuento total", { exact: true })).toBeVisible();
  await expect(receivedPreview.getByText("−UYU 250", { exact: true })).toBeVisible();
  await expect(receivedPreview.getByText("Envío", { exact: true })).toBeVisible();
  await expect(receivedPreview.getByText("UYU 2.650", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /^Pago confirmado Se aprueba/ }).click();
  await expect(page.getByText("Destinatario: Cliente", { exact: true })).toBeVisible();
  await expect(page.getByText("Asunto: Pago confirmado · Pedido #123")).toBeVisible();
  const preview = page.frameLocator('iframe[title="Vista previa de Pago confirmado"]');
  await expect(preview.getByRole("heading", { name: "Pago confirmado" })).toBeVisible();
  await expect(preview.getByText("Descuento total", { exact: true })).toBeVisible();
  await expect(preview.getByText("−UYU 475", { exact: true })).toBeVisible();
  await expect(preview.getByText("Envío", { exact: true })).toHaveCount(0);
  await expect(preview.getByRole("link", { name: "VER ESTADO DEL PEDIDO" })).toHaveAttribute("href", /\/pedidos\//);
  await expect(preview.getByRole("link", { name: "GESTIONAR PEDIDO" })).toHaveCount(0);
  await page.getByRole("button", { name: /^Pago pendiente de confirmación Se recibe/ }).click();
  await expect(page.getByText("Destinatario: Equipo", { exact: true })).toBeVisible();
  await expect(page.getByText("Asunto: Pago pendiente de confirmación · Pedido #123")).toBeVisible();
  const pendingPreview = page.frameLocator('iframe[title="Vista previa de Pago pendiente de confirmación"]');
  await expect(pendingPreview.getByText("Hola Richard! Hay un pedido que está pendiente de confirmación.")).toBeVisible();
  await expect(pendingPreview.getByRole("link", { name: "GESTIONAR PEDIDO" })).toBeVisible();
  await page.getByRole("button", { name: /Plantilla guardada/ }).click();
  await expect(page.getByText("Asunto: Asunto de Resend")).toBeVisible();
});

test("la vista no muestra errores internos de la consulta externa", async ({ page }) => {
  await mockCommerce(page);
  await page.route("https://*.supabase.co/functions/v1/marketing-workspace", (route) => route.fulfill({
    status: 400, contentType: "application/json", body: JSON.stringify({ error: "Operación desconocida." }),
  }));
  await page.goto("/marketing/email-templates");
  await expect(page.getByRole("button", { name: /Pedido recibido/ })).toBeVisible();
  await expect(page.getByText("Operación desconocida.")).toHaveCount(0);
  await expect(page.getByText("MateArte · enviados por Resend")).toHaveCount(0);
  await expect(page.getByText("Plantillas guardadas en Resend")).toHaveCount(0);
});
