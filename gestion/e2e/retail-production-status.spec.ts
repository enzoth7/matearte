import { expect, test } from "@playwright/test";
import { mockCommerce } from "./commerce-fixture";

test("un trabajo minorista pasa a producción, se completa y aparece en Histórico", async ({ page }) => {
  const { tables, writes } = await mockCommerce(page, { writable: true });
  tables.local_sales.push({
    id: "sale-workshop", sale_number: 42, reference_code: "#L042", channel: "Local",
    customer_id: null, customer_name: "Cliente de taller", sold_on: "2026-10-30",
    payment_method: "Efectivo", total_minor: 150000, currency: "UYU", created_at: "2026-10-30T12:00:00Z",
    local_sale_items: [{ id: "item-workshop", variant_id: "variant-1", sku: "SKU-1",
      product_name: "Mate personalizado", variant_name: "Marrón", quantity: 1,
      unit_price_minor: 150000, line_total_minor: 150000,
      customization: { kind: "mate" }, production_status: "pending" }],
  });

  await page.goto("/produccion/minorista");
  await page.setViewportSize({ width: 2048, height: 900 });
  const row = page.getByRole("row").filter({ hasText: "#L042" });
  const status = row.getByRole("combobox", { name: "Estado de producción del pedido #L042" });
  await expect(status).toHaveValue("pending");
  await expect(status).toHaveClass(/yellow/);
  const statusBox = await status.boundingBox();
  const actionBox = await row.getByRole("button", { name: "Ver detalle del pedido #L042" }).boundingBox();
  expect(statusBox && actionBox && Math.abs(statusBox.y + statusBox.height / 2 - actionBox.y - actionBox.height / 2)).toBeLessThan(12);
  await status.selectOption("in_production");
  await expect(status).toHaveValue("in_production");
  await expect(status).toHaveClass(/blue/);
  await status.selectOption("completed");
  await expect(row).toHaveCount(0);

  await page.goto("/produccion/historico");
  const completed = page.getByRole("row").filter({ hasText: "#L042" });
  await expect(completed.getByRole("combobox", { name: "Estado de producción del pedido #L042" })).toHaveValue("completed");
  await expect(completed.getByRole("combobox", { name: "Estado de producción del pedido #L042" })).toHaveClass(/green/);
  expect(writes.filter((write) => write.table === "order_items" && write.method === "PATCH").map((write) => write.body.production_status))
    .toEqual(["in_production", "completed"]);
});
