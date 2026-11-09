import { test, expect } from "@playwright/test";
import { mockCommerce } from "./commerce-fixture";

test("Richard ve Insumos y Reventa como subpestañas de Inventario", async ({ page }) => {
  const { tables, writes } = await mockCommerce(page, { writable: true });
  tables.inventory_cost_profiles.push(
    { id: "mate", category_code: "mates", name: "Mate imperial alpaca", method: "fabricacion", benchmark_material_minor: 60500 },
    { id: "botas", category_code: "botas", name: "Botas", method: "reventa", benchmark_material_minor: null },
  );
  tables.commerce_categories.push({ code: "materas", label_es: "Materas", active: true }, { code: "botas", label_es: "Botas", active: true });
  tables.commerce_products.push({ id: "boots-product", name: "Bota vaquera", category_code: "botas", category: "botas", sale_mode: "standard",
    commerce_variants: [{ id: "boots-variant", name: "Negra", sku: "B001", base_price_minor: 100000, price_minor: 110000, active: true }], commerce_product_images: [] });
  tables.commerce_products.push({ id: "matera-product", name: "Matera de prueba", category_code: "materas", category: "materas", sale_mode: "standard",
    commerce_variants: [{ id: "matera-variant", name: "Natural", sku: "MAT001", base_price_minor: 200000, price_minor: 200000, active: true }], commerce_product_images: [] });
  const line = (id: string, profile_id: string, name: string, kind: string, amount_minor: number | null, sort_order: number, group_name = "Otros") =>
    ({ id, profile_id, name, group_name, kind, amount_minor, sort_order, mode: "per_product", currency: "UYU", exchange_rate_to_uyu: null, purchase_quantity: null, consumption_quantity: null, unit: null });
  tables.inventory_cost_lines.push(
    line("base", "mate", "Mate base", "material", 8000, 10, "Cuerpo"),
    line("cuero", "mate", "Cuero", "material", 18000, 20, "Cuero"),
    line("fleje", "mate", "Fleje", "material", 25000, 30, "Fleje"),
    line("virola", "mate", "Virola", "material", 6500, 40, "Virola"),
    line("consumibles", "mate", "Consumibles", "material", 3000, 50, "Consumibles"),
    line("cuero-crudo", "mate", "Cuero crudo", "supply", null, 210, "Cuero"),
    line("cincelado", "mate", "Cincelado", "option", null, 60),
    line("labor", "mate", "Mano de obra", "labor", null, 70),
    line("packaging", "mate", "Packaging", "packaging", null, 80),
    line("merma", "mate", "Merma", "waste", null, 90),
  );
  await page.goto("/inventario/insumos");
  await expect(page.getByRole("heading", { name: "Insumos", level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Insumos para mates" })).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Subáreas de Inventario" }).getByRole("link", { name: "Reventa" })).toBeVisible();
  await expect(page.getByRole("row", { name: /Mate base/ })).toBeVisible();
  expect(await page.getByRole("columnheader").allTextContents()).toEqual(["Insumo", "Grupo", "Categoría", "Importe", "Acciones"]);
  await page.getByRole("textbox", { name: "Buscar insumos" }).fill("Virola");
  await expect(page.getByRole("row", { name: /Virola/ })).toBeVisible();
  await expect(page.getByRole("row", { name: /Mate base/ })).toHaveCount(0);
  await page.getByRole("textbox", { name: "Buscar insumos" }).clear();
  await expect(page.getByRole("row", { name: /Cuero crudo/ })).toBeVisible();
  await page.getByRole("rowheader", { name: "Cuero", exact: true }).locator("..").getByRole("button", { name: "Editar" }).click();
  await page.getByRole("dialog").getByLabel("Importe en UYU").fill("190");
  await page.getByRole("dialog").getByRole("button", { name: "Guardar" }).click();
  expect(writes.some((write) => write.table === "inventory_cost_lines" && write.body.amount_minor === 19000)).toBe(true);
  await page.getByRole("button", { name: "Agregar insumo" }).click();
  await page.getByRole("dialog").getByLabel("Nombre").fill("Lona");
  await page.getByRole("dialog").getByLabel("Grupo").fill("Textiles");
  await page.getByRole("dialog").getByLabel("Categoría").selectOption("materas");
  await page.getByRole("dialog").getByLabel("Importe en UYU").fill("50");
  await page.getByRole("dialog").getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByRole("row", { name: /Lona Textiles Materas/ })).toBeVisible();
  expect(writes.some((write) => write.table === "inventory_cost_profiles" && write.body.category_code === "materas")).toBe(true);
  await page.getByRole("navigation", { name: "Subáreas de Inventario" }).getByRole("link", { name: "Reventa" }).click();
  await expect(page).toHaveURL(/\/inventario\/reventa$/);
  await expect(page.getByRole("heading", { name: "Reventa", level: 1 })).toBeVisible();
  expect(await page.getByRole("columnheader").allTextContents()).toEqual(["Artículo", "Categoría", "Costo de compra", "Precio de venta base", "Acciones"]);
  await expect(page.getByText("Todavía no hay artículos de reventa cargados.")).toBeVisible();
  await expect(page.getByText(/flete|costo por par de botas/i)).toHaveCount(0);
  await page.getByRole("button", { name: "Agregar artículo" }).click();
  const resaleDialog = page.getByRole("dialog", { name: "Artículo de reventa" });
  await expect(resaleDialog.getByLabel("Categoría")).toHaveValue("");
  await expect(resaleDialog.getByLabel("Artículo")).toBeDisabled();
  await resaleDialog.getByLabel("Categoría").selectOption("materas");
  await expect(resaleDialog.getByRole("option", { name: /Matera de prueba/ })).toHaveCount(1);
  await expect(resaleDialog.getByRole("option", { name: /Bota vaquera/ })).toHaveCount(0);
  await resaleDialog.getByLabel("Categoría").selectOption("botas");
  await expect(resaleDialog.getByLabel("Artículo")).toHaveValue("");
  await expect(resaleDialog.getByRole("option", { name: /Bota vaquera/ })).toHaveCount(1);
  await resaleDialog.getByLabel("Artículo").selectOption("boots-variant");
  await page.getByRole("dialog").getByLabel("Costo de compra en UYU").fill("650");
  await page.getByRole("dialog").getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByRole("row", { name: /Bota vaquera.*Botas.*\$ 650.*UYU \$ 1\.000/ })).toBeVisible();
  await page.getByRole("row", { name: /Bota vaquera/ }).getByRole("button", { name: "Editar" }).click();
  await expect(page.getByRole("dialog").getByLabel("Categoría")).toHaveValue("botas");
  await expect(page.getByRole("dialog").getByLabel("Artículo")).toHaveValue("boots-variant");
  await page.getByRole("dialog").getByRole("button", { name: "Cancelar" }).click();
  expect(writes.some((write) => write.table === "inventory_cost_lines" && write.body.catalog_variant_id === "boots-variant" && write.body.amount_minor === 65000)).toBe(true);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("Insumos permanece oculto para usuarios de Inventario distintos de Richard", async ({ page }) => {
  await mockCommerce(page, { accessUserId: "t3", allowedPaths: ["/inicio/resumen", "/inventario/insumos", "/inventario/reventa"] });
  await page.goto("/inventario/insumos");
  await expect(page.getByRole("heading", { name: "Insumos", level: 1 })).not.toBeVisible();
  await expect(page.getByRole("navigation", { name: "Subáreas de Inventario" }).getByRole("link", { name: "Reventa" })).toHaveCount(0);
});
