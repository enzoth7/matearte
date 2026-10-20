import { expect, test } from "@playwright/test";
import { mockCommerce } from "./commerce-fixture";
import { defaultCatalogTaxonomy } from "../../shared/catalog-taxonomy";

test("un solo editor elige Local, Web y Mayorista con casillas", async ({ page }) => {
  const { tables, writes } = await mockCommerce(page, { writable: true });
  tables.commerce_attribute_definitions = defaultCatalogTaxonomy.attributes;
  tables.commerce_attribute_options = defaultCatalogTaxonomy.options;
  tables.commerce_category_attributes = defaultCatalogTaxonomy.rules;
  await page.goto("/productos/catalogo");
  await expect(page.getByRole("button", { name: "Nuevo producto", exact: true })).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Nuevo producto web" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Nuevo mayorista" })).toHaveCount(0);
  await page.getByRole("button", { name: "Nuevo producto", exact: true }).click();
  await expect(page.getByRole("group", { name: "Disponibilidad inicial" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Nuevo producto" })).toBeVisible();
  await page.getByRole("textbox", { name: "Nombre del producto" }).fill("Mate prueba unificado");
  await page.getByLabel("Material del mate").selectOption("calabaza");
  await page.getByLabel("Tipo de virola").selectOption("acero");
  await page.getByLabel("Tipo de cuero").selectOption("liso");
  await page.getByLabel("Posamate").selectOption("sin-posamate");
  await page.getByRole("button", { name: "Crear producto" }).click();
  await page.getByLabel("SKU").fill("MATE-UNI-1");
  await page.getByLabel("Precio base UYU").fill("1000");
  await page.getByRole("checkbox", { name: "Mayorista" }).check();
  await page.getByRole("button", { name: "Crear variante" }).click();
  expect(tables.commerce_products.some((item: any) => item.name === "Mate prueba unificado")).toBe(true);
  expect(writes.some(write => write.table === "commerce_variants" && write.body.available_wholesale === true)).toBe(true);
});

test("el formulario unificado conserva el borrador", async ({ page }) => {
  await mockCommerce(page, { writable: true });
  await page.goto("/productos/catalogo");
  await page.getByRole("button", { name: "Nuevo producto", exact: true }).click();
  await page.getByRole("textbox", { name: "Nombre del producto" }).fill("Borrador de prueba");
  await expect(page.getByRole("textbox", { name: "Nombre del producto" })).toHaveValue("Borrador de prueba");
});

test("la ficha mayorista usa el editor completo y muestra las fotos subidas", async ({ page }) => {
  const { tables, writes } = await mockCommerce(page, { writable: true });
  tables.products.push({ id: "7", model: "Criollo", variant: "Natural", rim_type: "Acero", leather_type: "Liso", price_arg: 18810, price_uyu: 507.87, category_code: null, description: "" });
  await page.goto("/productos/catalogo");
  await page.locator(".product-card").filter({ hasText: "Criollo" }).first().click();

  await expect(page.getByText("Datos del producto", { exact: true })).toBeVisible();
  await expect(page.getByText("Precio y disponibilidad", { exact: true })).toBeVisible();
  await expect(page.getByText("Imágenes del producto", { exact: true })).toBeVisible();
  await page.screenshot({ path: "artifacts/catalogo-mayorista-editor.png", fullPage: true });
  await page.getByLabel("SKU").fill("CRI-7");
  await page.getByLabel("Descripción").fill("Mate criollo natural");
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect.poll(() => tables.products[0].sku).toBe("CRI-7");
  expect(tables.products[0].description).toBe("Mate criollo natural");
  await page.locator('input[id="wholesale-images-7"]').setInputFiles({
    name: "criollo.png", mimeType: "image/png",
    buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/X1cAAAAASUVORK5CYII=", "base64"),
  });
  await expect(page.locator(".wholesale-catalog-workspace .product-image")).toHaveCount(1);
  await expect(page.locator(".wholesale-catalog-workspace .product-image img")).toHaveAttribute("src", /wholesale%2F7%2F|wholesale\/7\//);
  await expect(page.locator(".catalog-product-rail .product-card").filter({ hasText: "Criollo" }).first().locator("img")).toHaveCount(1);
  await page.locator('input[id="wholesale-images-7"]').setInputFiles({
    name: "criollo-detalle.png", mimeType: "image/png",
    buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/X1cAAAAASUVORK5CYII=", "base64"),
  });
  await expect(page.locator(".wholesale-catalog-workspace .product-image")).toHaveCount(2);
  await page.getByRole("button", { name: "Hacer principal" }).click();
  await expect(page.locator(".wholesale-catalog-workspace .product-image").first()).toContainText("criollo-detalle.png");
  await page.locator(".wholesale-catalog-workspace .product-image").first().getByRole("button", { name: "Ajustar encuadre" }).click();
  await page.getByRole("dialog", { name: "Ajustá el encuadre" }).getByRole("slider").fill("1.2");
  await page.getByRole("button", { name: "Guardar portada" }).click();
  await expect(page.getByRole("dialog", { name: "Ajustá el encuadre" })).toHaveCount(0);
  expect(writes.some(write => write.table === "wholesale_product_images" && write.method === "POST")).toBe(true);
  expect(writes.some(write => write.table === "wholesale_product_images" && write.method === "PATCH" && write.body.option_values?.cover_zoom === 1.2)).toBe(true);
});

test("la disponibilidad Mayorista se guarda sin recalcular el precio", async ({ page }) => {
  const { tables } = await mockCommerce(page, { writable: true });
  tables.products.push({ id: "7", model: "Criollo", variant: "Natural", rim_type: "Acero", leather_type: "Liso", price_arg: 18810, price_uyu: 507.87, category_code: "mates", description: "", catalog_attributes: { "material-mate": "calabaza", "tipo-virola": "acero", "tipo-cuero": "liso", posamate: "sin-posamate" } });
  await page.goto("/productos/catalogo");
  await page.locator(".product-card").filter({ hasText: "Criollo" }).first().click();
  await page.locator(".wholesale-catalog-workspace").getByRole("checkbox", { name: "Mayorista" }).uncheck();
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect.poll(() => tables.products[0].available_wholesale).toBe(false);
  expect(tables.products[0].price_arg).toBe(18810);
  expect(tables.products[0].price_uyu).toBe(507.87);
});

test("dos productos del mismo modelo tienen fichas independientes y el modelo de mate seleccionado", async ({ page }) => {
  const { tables } = await mockCommerce(page, { writable: true });
  tables.products.push(
    { id: "7", model: "Criollo", variant: "Natural con Posa Mate Cinta", rim_type: "Acero", leather_type: "Liso", price_arg: 18810, price_uyu: 507.87, category_code: "mates", description: "", catalog_attributes: { "material-mate": "calabaza", "tipo-virola": "acero", "tipo-cuero": "liso", posamate: "con-posamate" } },
    { id: "8", model: "Criollo", variant: "Alpaca Grande Cincelada", rim_type: "Alpaca", leather_type: "Crudo", price_arg: 35420, price_uyu: 956.34, category_code: "mates", description: "", catalog_attributes: { "material-mate": "calabaza", "tipo-virola": "alpaca", "tipo-cuero": "crudo", posamate: "sin-posamate" } },
  );
  await page.goto("/productos/catalogo");
  const first = page.locator(".product-card").filter({ hasText: "Criollo · Natural con Posa Mate Cinta" });
  const second = page.locator(".product-card").filter({ hasText: "Criollo · Alpaca Grande Cincelada" });
  await expect(first).toHaveCount(1);
  await expect(second).toHaveCount(1);
  await first.click();
  await expect(page.locator(".wholesale-catalog-workspace").getByRole("heading", { name: "Criollo · Natural con Posa Mate Cinta" })).toBeVisible();
  await expect(page.getByText("Agregar variante")).toHaveCount(0);
  await expect(page.getByLabel("Modelo de mate")).toHaveValue("criollo");
  await page.getByLabel("Descripción").fill("Ficha independiente");
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect.poll(() => tables.products.find((item: any) => item.id === "7")?.description).toBe("Ficha independiente");
  expect(tables.products.find((item: any) => item.id === "8")?.description).toBe("");
});
