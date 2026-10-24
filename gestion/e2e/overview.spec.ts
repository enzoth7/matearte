import { expect, test } from "@playwright/test";
import { mockCommerce } from "./commerce-fixture";
import { overviewRange } from "../src/overview";

test("inicio compara las ventas minoristas y mayoristas", async ({ page }) => {
  const { tables } = await mockCommerce(page, { writable: true });
  tables.customers.push({ full_name: "Mayorista Inicio", first_name: "Mayorista", last_name: "Inicio", phone: "", email: "", address: "", notes: "", customer_type: "Mayorista" });
  tables.order_lines.push({ line_id: "line-overview", order_id: "PED-OVERVIEW", created_at: "2026-10-18T12:00:00Z",
    completed_at: null, customer: "Mayorista Inicio", model: "Criollo", variant: "Marrón", quantity: 2,
    status: "Pendiente", order_type: "normal", unit_price_arg: 10000, unit_price_uyu: 1000,
    exchange_rate: 0.1, total_arg: 20000, total_uyu: 2000 });

  await page.goto("/inicio/resumen");
  const card = page.locator(".card").filter({ has: page.getByRole("heading", { name: "Ventas por tipo de cliente" }) });
  await expect(card).toContainText("Minorista");
  await expect(card).toContainText("Mayorista");
  await expect(card).toContainText("venta");
  await expect(page.getByRole("heading", { name: "Pendientes", exact: true })).toHaveCount(0);
});

test("inicio muestra dos rankings de diez productos debajo de los gráficos", async ({ page }) => {
  const { tables } = await mockCommerce(page, { writable: true });
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Montevideo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  tables.local_sales.push({ id: "top-products-sale", sale_number: 300, reference_code: "#L300", channel: "Local",
    customer_id: null, customer_name: "Cliente minorista", sold_on: today, payment_method: "Efectivo", total_minor: 550000, currency: "UYU",
    created_at: `${today}T12:00:00Z`, local_sale_items: Array.from({ length: 10 }, (_, index) => ({ id: `top-item-${index}`, variant_id: null,
      sku: `TOP-${index}`, product_name: `Producto vendido ${index + 1}`, variant_name: "", quantity: 10 - index,
      unit_price_minor: 10000, line_total_minor: (10 - index) * 10000 })) });
  const analyticsRequests: Record<string, unknown>[] = [];
  await page.route("https://*.supabase.co/functions/v1/marketing-workspace", async route => {
    const request = route.request().postDataJSON() as Record<string, unknown>;
    analyticsRequests.push(request);
    const products = Array.from({ length: 12 }, (_, index) => ({ label: `Producto visto ${request.startDate} ${index + 1}`, visitors: 20 - index, pageviews: 30 - index }));
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ products }) });
  });
  await page.goto("/inicio/resumen");
  const cards = page.locator(".overview-rankings-grid .card");
  await expect(cards).toHaveCount(2);
  await expect(cards.nth(0)).toContainText("Productos más vendidos minorista");
  await expect(cards.nth(0).locator(".overview-ranking li")).toHaveCount(10);
  await expect(cards.nth(1).locator(".overview-ranking li")).toHaveCount(10);
  await expect(cards.nth(1)).toContainText(`Producto visto ${overviewRange("14d").start} 1`);
  await expect(cards.nth(1)).not.toContainText(`Producto visto ${overviewRange("14d").start} 11`);
  await expect(cards.nth(1)).toContainText("últimos 14 días");
  expect(analyticsRequests[0]).toMatchObject({ action: "analytics", site: "tienda", productsOnly: true, startDate: overviewRange("14d").start, endDate: overviewRange("14d").end });
  await page.getByRole("combobox", { name: "Período del resumen" }).selectOption("6m");
  await expect(cards.nth(1)).toContainText("últimos 6 meses");
  await expect(cards.nth(1)).toContainText(`Producto visto ${overviewRange("6m").start} 1`);
  expect(analyticsRequests.at(-1)).toMatchObject({ action: "analytics", site: "tienda", productsOnly: true, startDate: overviewRange("6m").start, endDate: overviewRange("6m").end });
  const columns = await cards.evaluateAll(elements => elements.map(element => element.getBoundingClientRect().left));
  expect(columns[1]).toBeGreaterThan(columns[0]);
  await page.screenshot({ path: "artifacts/overview-rankings-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  const mobileColumns = await cards.evaluateAll(elements => elements.map(element => element.getBoundingClientRect().left));
  expect(Math.abs(mobileColumns[1] - mobileColumns[0])).toBeLessThan(2);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  await page.screenshot({ path: "artifacts/overview-rankings-mobile.png", fullPage: true });
});
