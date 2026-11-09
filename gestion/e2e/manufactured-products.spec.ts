import { test, expect } from "@playwright/test";
import { mockCommerce } from "./commerce-fixture";

test("Productos fabricados muestra una fila por producto y permite vincular insumos", async ({ page }) => {
  const { tables, writes } = await mockCommerce(page, { writable: true });
  tables.inventory_cost_profiles.push({ id: "mates-cost", category_code: "mates", name: "Mates", method: "fabricacion", benchmark_material_minor: null });
  tables.inventory_cost_lines.push({ id: "leather", profile_id: "mates-cost", name: "Cuero", group_name: "Cuero", kind: "material",
    mode: "per_product", amount_minor: 18000, currency: "UYU", exchange_rate_to_uyu: null,
    purchase_quantity: null, consumption_quantity: null, unit: null, sort_order: 10 });
  for (const [id, name, amount] of [["base", "Mate base", 8000], ["fleje", "Fleje de alpaca", 25000], ["virola", "Virola", 6500], ["consumibles", "Consumibles", 3000]] as const) {
    tables.inventory_cost_lines.push({ id, profile_id: "mates-cost", name, group_name: "Otros", kind: "material",
      mode: "per_product", amount_minor: amount, currency: "UYU", exchange_rate_to_uyu: null,
      purchase_quantity: null, consumption_quantity: null, unit: null, sort_order: 20 });
  }
  tables.commerce_products.push({ id: "imperial", name: "Mate Imperial Alpaca", category_code: "mates", category: "mates", sale_mode: "standard",
    commerce_variants: [
      { id: "imperial-a", name: "Liso", sku: "I101", base_price_minor: 295000, price_minor: 295000, active: true },
      { id: "imperial-b", name: "Cincelado", sku: "I102", base_price_minor: 320000, price_minor: 320000, active: true },
    ], commerce_product_images: [] });
  tables.inventory_manufactured_products.push({ id: "sheet-imperial", source_key: "clase1:margin:B7", name: "Mate Imperial Alpaca",
    category_code: "mates", catalog_product_id: "imperial", reference_sale_price_minor: 295000,
    reference_variable_cost_minor: 60500, source_row: "3 Margen!B7:E7" });
  await page.goto("/inventario/fabricados");
  await expect(page.getByRole("heading", { name: "Productos fabricados", level: 1 })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Subáreas de Inventario" }).getByRole("link", { name: "Productos fabricados" })).toBeVisible();
  await expect(page.getByRole("row", { name: /Mate Imperial Alpaca I101, I102 Mates/ })).toBeVisible();
  expect(await page.getByRole("columnheader").allTextContents()).toEqual([
    "Nombre del producto", "SKU", "Categoría", "Costo", "Precio de venta base", "Ganancia", "Insumos vinculados", "Acciones",
  ]);
  await expect(page.getByRole("row", { name: /Mate Imperial Alpaca I101, I102 Mates/ })).toBeVisible();
  await expect(page.getByRole("row", { name: /Mate Imperial Alpaca I101/ })).toContainText("UYU $ 2.950 a UYU $ 3.200");
  await expect(page.getByRole("row", { name: /Mate Imperial Alpaca I101/ })).toContainText("UYU $ 2.345 a UYU $ 2.595");
  await expect(page.getByRole("row", { name: /Mate Imperial Alpaca I101/ }).locator(".manufactured-products-gain")).toHaveCSS("color", "rgb(47, 125, 85)");
  await expect(page.getByRole("rowheader", { name: "Mate Imperial Alpaca" })).toHaveCount(1);
  await page.getByRole("textbox", { name: "Buscar productos fabricados" }).fill("I102");
  await expect(page.getByRole("row", { name: /Mate Imperial Alpaca I101/ })).toBeVisible();
  await page.getByRole("textbox", { name: "Buscar productos fabricados" }).clear();
  await page.getByRole("row", { name: /Mate Imperial Alpaca I101/ }).getByRole("button", { name: "Editar" }).click();
  await page.getByRole("dialog").getByRole("checkbox", { name: "Cuero" }).check();
  await page.getByRole("dialog").getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByRole("row", { name: /Mate Imperial Alpaca I101/ })).toContainText("1 insumos, UYU $ 180");
  expect(writes.some((write) => write.table === "inventory_manufactured_supplies"
    && (Array.isArray(write.body) ? write.body : [write.body]).some((item) => item.cost_line_id === "leather"))).toBe(true);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("Productos fabricados está restringido a Richard", async ({ page }) => {
  await mockCommerce(page, { accessUserId: "t3", allowedPaths: ["/inicio/resumen", "/inventario/fabricados"] });
  await page.goto("/inventario/fabricados");
  await expect(page.getByRole("heading", { name: "Productos fabricados", level: 1 })).not.toBeVisible();
  await expect(page.getByRole("navigation", { name: "Subáreas de Inventario" }).getByRole("link", { name: "Productos fabricados" })).toHaveCount(0);
});

test("Agregar producto filtra primero por categoría y después por producto", async ({ page }) => {
  const { tables, writes } = await mockCommerce(page, { writable: true });
  tables.commerce_categories.push({ code: "test_bolsos", label_es: "Bolsos", active: true });
  tables.commerce_products.push(
    { id: "mate-nuevo", name: "Mate de prueba", category_code: "mates", category: "mates", sale_mode: "standard",
      commerce_variants: [{ id: "mate-nuevo-v", name: "Natural", sku: "MATE-TEST", base_price_minor: 200000, price_minor: 200000, active: true }], commerce_product_images: [] },
    { id: "bolso-nuevo", name: "Bolso de prueba", category_code: "test_bolsos", category: "test_bolsos", sale_mode: "standard",
      commerce_variants: [{ id: "bolso-nuevo-v", name: "Natural", sku: "BOLSO-TEST", base_price_minor: 300000, price_minor: 300000, active: true }], commerce_product_images: [] },
  );
  await page.goto("/inventario/fabricados");
  await page.getByRole("button", { name: "Agregar producto" }).click();
  const dialog = page.getByRole("dialog", { name: "Agregar producto fabricado" });
  await expect(dialog.getByLabel("Categoría")).toHaveValue("");
  await expect(dialog.getByLabel("Producto del catálogo")).toBeDisabled();
  await dialog.getByLabel("Categoría").selectOption("mates");
  await expect(dialog.getByLabel("Producto del catálogo")).toBeEnabled();
  await expect(dialog.getByRole("option", { name: "Mate de prueba" })).toHaveCount(1);
  await expect(dialog.getByRole("option", { name: "Bolso de prueba" })).toHaveCount(0);
  await dialog.getByLabel("Categoría").selectOption("test_bolsos");
  await expect(dialog.getByLabel("Producto del catálogo")).toHaveValue("");
  await expect(dialog.getByRole("option", { name: "Bolso de prueba" })).toHaveCount(1);
  await dialog.getByLabel("Categoría").selectOption("mates");
  await dialog.getByLabel("Producto del catálogo").selectOption("mate-nuevo");
  await dialog.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByRole("row", { name: /Mate de prueba MATE-TEST/ })).toBeVisible();
  expect(writes.some((write) => write.table === "inventory_manufactured_products" && write.body.catalog_product_id === "mate-nuevo")).toBe(true);
});
