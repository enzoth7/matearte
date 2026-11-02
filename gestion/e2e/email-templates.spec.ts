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
