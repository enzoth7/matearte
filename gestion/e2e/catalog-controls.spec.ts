import { test, expect } from "@playwright/test";
import { mockCommerce } from "./commerce-fixture";
import { defaultCatalogTaxonomy } from "../../shared/catalog-taxonomy";

for (const category of ["botas", "zuecos"] as const) {
  test(`${category} permite guardar varios números en un solo producto`, async ({ page }) => {
    const { fixture, tables, writes } = await mockCommerce(page, { writable: true });
    tables.commerce_categories = defaultCatalogTaxonomy.categories;
    tables.commerce_attribute_definitions = defaultCatalogTaxonomy.attributes;
    tables.commerce_attribute_options = defaultCatalogTaxonomy.options;
    tables.commerce_category_attributes = defaultCatalogTaxonomy.rules;
    Object.assign(fixture.products[0], { category, category_code: category, attributes: { talle: "36" } });

    await page.goto("/productos/catalogo?producto=product-1");
    const sizes = page.getByRole("group", { name: category === "botas" ? /Números de bota/ : /Números de zueco/ });
    await expect(sizes.getByLabel("36", { exact: true })).toBeChecked();
    await sizes.getByLabel("38", { exact: true }).check();
    await sizes.getByLabel("40", { exact: true }).check();
    await page.locator(".product-details").getByRole("button", { name: "Guardar cambios" }).click();
    await expect.poll(() => writes.find(write => write.table === "commerce_products" && Array.isArray(write.body.attributes?.talle))?.body.attributes.talle).toEqual(["36", "38", "40"]);
    await page.reload();
    await expect(sizes.getByLabel("36", { exact: true })).toBeChecked();
    await expect(sizes.getByLabel("38", { exact: true })).toBeChecked();
    await expect(sizes.getByLabel("40", { exact: true })).toBeChecked();
    await expect(sizes.getByLabel("37", { exact: true })).not.toBeChecked();
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(sizes).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test("el selector distingue los personalizados y ordena las categorías por nombre", async ({ page }) => {
  const { tables } = await mockCommerce(page);
  tables.commerce_categories = [
    ...defaultCatalogTaxonomy.categories,
    { code: "posa-mates", label_es: "Posa mates", parent_code: null, sort_order: 130, active: true },
  ];
  await page.goto("/productos/catalogo?producto=product-1");
  const category = page.getByRole("combobox", { name: /Categoría/ });
  await expect(category.locator('option[value="personalizados"]')).toHaveText("Personalizados");
  await expect(category.locator('option[value="posa-mates"]')).toHaveText("Posa mates");
  await expect(category.locator('option[value="mates-personalizados"]')).toHaveCount(0);
  const labels = await category.locator('option:not([value=""])').allTextContents();
  expect(labels.indexOf("Posa mates")).toBeLessThan(labels.indexOf("Servicios"));
});

test("Personalizados exige tipo y cambia los campos sin crear variantes por características", async ({ page }) => {
  const { tables } = await mockCommerce(page);
  tables.commerce_categories = defaultCatalogTaxonomy.categories;
  tables.commerce_attribute_definitions = defaultCatalogTaxonomy.attributes;
  tables.commerce_attribute_options = defaultCatalogTaxonomy.options;
  tables.commerce_category_attributes = defaultCatalogTaxonomy.rules;
  await page.goto("/productos/catalogo?producto=product-1");
  await page.getByRole("combobox", { name: /Categoría/ }).selectOption("personalizados");
  const type = page.getByRole("combobox", { name: "Tipo", exact: true });
  await expect(type).toBeVisible();
  await expect(page.getByRole("combobox", { name: /Tipo de virola/ })).toHaveCount(0);
  await type.selectOption("mate");
  await expect(page.getByRole("combobox", { name: /Tipo de virola/ })).toBeVisible();
  await expect(page.getByRole("combobox", { name: /Tipo de cuero/ })).toBeVisible();
  await type.selectOption("matera");
  await expect(page.getByRole("combobox", { name: /Tipo de virola/ })).toHaveCount(0);
  await expect(page.getByRole("combobox", { name: /Diseño de la matera/ })).toBeVisible();
});

test("los mates muestran un solo material y conservan el ajuste de precio", async ({ page }) => {
  const { writes, tables } = await mockCommerce(page, { writable: true });
  tables.commerce_attribute_definitions = defaultCatalogTaxonomy.attributes;
  tables.commerce_attribute_options = defaultCatalogTaxonomy.options;
  tables.commerce_category_attributes = defaultCatalogTaxonomy.rules;
  await page.goto("/productos/catalogo?producto=product-1");
  const material = page.getByRole("combobox", { name: "Material del mate" });
  await expect(material).toBeVisible();
  await expect(page.getByRole("group", { name: "Materiales" })).toHaveCount(0);
  await expect(page.locator(".material-option")).toHaveCount(0);

  const adjustment = page.getByRole("switch", { name: /Sumar ajuste de Mercado Pago/ });
  await expect(adjustment).toBeChecked();
  await page.screenshot({ path: "artifacts/catalog-controls.png", fullPage: true });
  await adjustment.click();
  await expect(adjustment).not.toBeChecked();
  expect(writes.some((write) => write.table === "commerce_products" && write.method === "PATCH" && write.body.apply_catalog_price_adjustment === false)).toBe(true);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(material).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("las acciones de variantes usan iconos y la edición conserva la alineación", async ({ page }) => {
  const { fixture, tables } = await mockCommerce(page, { writable: true });
  tables.commerce_attribute_definitions = defaultCatalogTaxonomy.attributes;
  tables.commerce_attribute_options = defaultCatalogTaxonomy.options;
  tables.commerce_category_attributes = defaultCatalogTaxonomy.rules;
  fixture.products[0].commerce_variants[0].option_values = { color: "negro" };
  fixture.products[0].commerce_variants[1].option_values = { color: "marron" };
  await page.goto("/productos/catalogo?producto=product-1&variante=variant-1");

  const table = page.locator(".catalog-variants-table");
  const row = table.getByRole("row").filter({ hasText: "SKU-1" });
  await expect(row.getByRole("button", { name: "Editar" })).toBeVisible();
  await expect(table.locator(".variant-edit-row")).toHaveCount(0);
  const actions = row.locator(".variant-row-actions button");
  await expect(actions).toHaveCount(3);
  expect(await actions.allTextContents()).toEqual(["", "", ""]);
  await expect(row.getByRole("button", { name: "Desactivar" })).toBeVisible();
  const columnWidths = await table.locator("thead th").evaluateAll((cells) => cells.map((cell) => cell.getBoundingClientRect().width));

  await row.getByRole("button", { name: "Editar" }).click();
  const editRow = table.locator(".variant-edit-row");
  await expect(editRow.getByRole("combobox", { name: "Color" })).toBeVisible();
  await expect(editRow.locator(".field-label")).toHaveCount(0);
  const editedColumnWidths = await table.locator("thead th").evaluateAll((cells) => cells.map((cell) => cell.getBoundingClientRect().width));
  expect(editedColumnWidths.every((width, index) => Math.abs(width - columnWidths[index]) < 1)).toBe(true);
  const skuWidth = await editRow.getByRole("textbox", { name: "SKU" }).evaluate((input) => input.getBoundingClientRect().width);
  expect(skuWidth).toBeLessThan(120);
  const actionPositions = await editRow.locator(".variant-row-actions button").evaluateAll((buttons) => buttons.map((button) => button.getBoundingClientRect().top));
  expect(actionPositions.every((top) => Math.abs(top - actionPositions[0]) < 1)).toBe(true);
  expect(await editRow.locator(".variant-row-actions button").allTextContents()).toEqual(["", ""]);
  await editRow.getByRole("button", { name: "Cancelar" }).click();
  await expect(table.locator(".variant-edit-row")).toHaveCount(0);
});

test("una ficha mayorista vinculada usa el editor único y conserva su precio ARS", async ({ page }) => {
  const { fixture, tables, writes } = await mockCommerce(page, { writable: true });
  tables.commerce_attribute_definitions = defaultCatalogTaxonomy.attributes;
  tables.commerce_attribute_options = defaultCatalogTaxonomy.options;
  tables.commerce_category_attributes = defaultCatalogTaxonomy.rules;
  const product = fixture.products[0];
  product.name = "Criollo Coquito · Sin posa mate";
  product.commerce_variants = [product.commerce_variants[0]];
  Object.assign(product.commerce_variants[0], {
    name: "Sin color", sku: "SKU-1", available_local: false, available_web: false,
    available_wholesale: true, wholesale_price_arg: 10500,
  });
  product.commerce_product_images.push({
    id: "legacy-photo", storage_path: "wholesale/45/criollo.png", original_name: "Criollo.png",
    alt_text: "Criollo", mime_type: "image/png", byte_size: 1024, sort_order: 0, variant_id: null, option_values: {},
  });
  await page.goto(`/productos/catalogo?producto=${product.id}`);
  await expect(page.locator(".catalog-editor .panel-head h3")).toHaveText(product.name);
  await expect(page.getByLabel("Nombre", { exact: false }).first()).toHaveValue(product.name);
  await expect(page.getByText("Variantes comprables", { exact: true })).toBeVisible();
  const variantTable = page.locator(".catalog-variants-table");
  await expect(variantTable.getByRole("columnheader", { name: "Precio UYU" })).toBeVisible();
  const hasHorizontalOverflow = () => page.locator(".variants-section .table-scroll").evaluate((container) => container.scrollWidth > container.clientWidth + 1);
  expect(await hasHorizontalOverflow()).toBe(false);
  await expect(page.getByRole("button", { name: "Ajustar encuadre" })).toBeVisible();
  await expect(page.getByLabel("Mover Criollo.png a otro producto")).toBeVisible();
  await page.getByRole("row").filter({ hasText: "SKU-1" }).getByRole("button", { name: "Editar" }).click();
  const priceArg = page.getByRole("spinbutton", { name: "Precio ARS" });
  await expect(priceArg).toHaveValue("10500");
  await priceArg.fill("11000");
  await page.locator(".variant-edit-row").getByRole("button", { name: "Guardar" }).click();
  await expect.poll(() => writes.find(write => write.table === "commerce_variants" && write.method === "PATCH")?.body.wholesale_price_arg).toBe(11000);
  await page.setViewportSize({ width: 1280, height: 900 });
  expect(await hasHorizontalOverflow()).toBe(false);
  await variantTable.getByRole("button", { name: "Editar" }).click();
  expect(await hasHorizontalOverflow()).toBe(false);
  await variantTable.getByRole("button", { name: "Cancelar" }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await hasHorizontalOverflow()).toBe(false);
});

test("las páginas retiradas vuelven a la lista única del catálogo", async ({ page }) => {
  await mockCommerce(page);
  await page.goto("/productos/precios");
  await expect(page).toHaveURL(/\/productos\/catalogo\?vista=lista$/);
  await expect(page.getByRole("columnheader", { name: "SKU" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Ajustes y mayoristas" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Precios por canal" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Publicación y contenido web" })).toHaveCount(0);
});

test("Servicios tiene una pestaña propia y no aparece en Catálogo general", async ({ page }) => {
  const { fixture, writes } = await mockCommerce(page, { writable: true });
  fixture.reference.categories.push({ code: "servicios", label_es: "Servicios", active: true });
  fixture.products.push({
    id: "service-1", name: "Cambio de calabaza", editorial_slug: "cambio-calabaza",
    category: "servicios", category_code: "servicios", description: "", sale_mode: "standard",
    published: false, peso: 0, updated_at: "2026-10-19T12:00:00Z", attributes: {},
    commerce_product_images: [],
    commerce_variants: [{ id: "service-variant-1", sku: "SERV-1", name: "Única", price_minor: 70000, base_price_minor: 70000, active: true, available_local: true, available_web: false, weight_grams: 0 }],
  }, {
    id: "service-2", name: "Grabado láser", editorial_slug: "grabado-laser",
    category: "servicios", category_code: "servicios", description: "", sale_mode: "standard",
    published: false, peso: 0, updated_at: "2026-10-19T12:00:00Z", attributes: {},
    commerce_product_images: [],
    commerce_variants: [{ id: "service-variant-2", sku: "SERV-2", name: "Única", price_minor: 0, base_price_minor: 0, active: true, available_local: true, available_web: false, weight_grams: 0 }],
  });

  await page.goto("/productos/catalogo");
  await expect(page.getByText("Cambio de calabaza", { exact: true })).toHaveCount(0);
  await page.getByRole("link", { name: "Servicios" }).click();
  await expect(page).toHaveURL(/\/productos\/servicios$/);
  await expect(page.getByRole("button", { name: "Cambio de calabaza" })).toBeVisible();
  await expect(page.getByRole("row").filter({ hasText: "Grabado láser" })).toContainText("A definir en la venta");
  await expect(page.getByRole("columnheader", { name: "Precio local" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Web" })).toHaveCount(0);
  await expect(page.getByRole("columnheader", { name: "Mayorista" })).toHaveCount(0);
  await expect(page.getByText("Mayorista desde 30 artículos.")).toHaveCount(0);
  await expect(page.getByText("Mate de catálogo", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Grabado láser" }).click();
  await expect(page.getByRole("switch", { name: /Sumar ajuste de Mercado Pago/ })).toHaveCount(0);
  await expect(page.getByRole("group", { name: "Canales de venta" })).toHaveCount(0);
  await page.locator(".catalog-variants-table").getByRole("button", { name: "Editar" }).click();
  await expect(page.getByRole("combobox", { name: "Tipo de precio" }).first()).toHaveValue("variable");
  await page.getByRole("combobox", { name: "Tipo de precio" }).first().selectOption("fixed");
  await page.locator(".variant-edit-row").getByRole("spinbutton", { name: "Precio" }).fill("850");
  await page.locator(".variant-edit-row").getByRole("button", { name: "Guardar" }).click();
  await expect.poll(() => writes.find((write) => write.table === "commerce_variants" && write.method === "PATCH")?.body).toMatchObject({
    base_price_minor: 85000, available_local: true, available_web: false, available_wholesale: false,
  });
  await page.locator(".catalog-variants-table").getByRole("button", { name: "Editar" }).click();
  await page.getByRole("combobox", { name: "Tipo de precio" }).first().selectOption("variable");
  await expect(page.locator(".variant-edit-row").getByRole("spinbutton", { name: "Precio" })).toHaveCount(0);
  await page.locator(".variant-edit-row").getByRole("button", { name: "Guardar" }).click();
  await expect.poll(() => writes.filter((write) => write.table === "commerce_variants" && write.method === "PATCH").at(-1)?.body.base_price_minor).toBe(0);
});

test("un servicio nuevo puede quedar sin precio fijo y solo para Local", async ({ page }) => {
  const { fixture, writes } = await mockCommerce(page, { writable: true });
  fixture.reference.categories.push({ code: "servicios", label_es: "Servicios", active: true });
  fixture.products.push({
    id: "service-new", name: "Reparación", editorial_slug: "reparacion",
    category: "servicios", category_code: "servicios", description: "", sale_mode: "standard",
    published: false, peso: 0, updated_at: "2026-10-20T12:00:00Z", attributes: {},
    commerce_product_images: [], commerce_variants: [],
  });

  await page.goto("/productos/servicios?producto=service-new");
  const form = page.locator(".variant-create");
  await expect(form.getByRole("combobox", { name: "Tipo de precio" })).toHaveValue("variable");
  await expect(form.getByRole("spinbutton", { name: "Precio local UYU" })).toHaveCount(0);
  await form.getByRole("textbox", { name: "SKU" }).fill("610");
  await form.getByRole("button", { name: "Crear variante" }).click();
  await expect.poll(() => writes.find((write) => write.table === "commerce_variants" && write.method === "POST")?.body).toMatchObject({
    sku: "610", base_price_minor: 0, price_minor: 0,
    available_local: true, available_web: false, available_wholesale: false,
  });
});
