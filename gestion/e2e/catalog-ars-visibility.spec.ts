import { expect, test } from "@playwright/test";
import { defaultCatalogTaxonomy } from "../../shared/catalog-taxonomy";
import { mockCommerce } from "./commerce-fixture";

test("florcosta no ve el precio mayorista ARS en el catálogo y conserva su valor al editar", async ({ page }) => {
  const { fixture, tables, writes } = await mockCommerce(page, {
    accessUserId: "t2",
    allowedPaths: ["/productos/catalogo"],
    writable: true,
  });
  tables.commerce_attribute_definitions = defaultCatalogTaxonomy.attributes;
  tables.commerce_attribute_options = defaultCatalogTaxonomy.options;
  tables.commerce_category_attributes = defaultCatalogTaxonomy.rules;
  fixture.products[0].commerce_variants[0].available_wholesale = true;
  fixture.products[0].commerce_variants[0].wholesale_price_arg = 10500;

  await page.goto("/productos/catalogo?vista=lista");
  const list = page.locator(".catalog-general-list");
  await expect(list.getByRole("columnheader", { name: "Mayorista" })).toBeVisible();
  await expect(list.getByRole("columnheader", { name: "ARS" })).toHaveCount(0);
  await expect(list).not.toContainText("10.500");

  await page.goto("/productos/catalogo?producto=product-1&variante=variant-1");
  const variants = page.locator(".catalog-variants-table");
  await expect(variants.getByRole("columnheader", { name: "Precio UYU" })).toBeVisible();
  await expect(variants.getByRole("columnheader", { name: "Precio ARS" })).toHaveCount(0);
  await variants.getByRole("button", { name: "Editar" }).first().click();
  await expect(page.getByRole("spinbutton", { name: "Precio ARS" })).toHaveCount(0);
  await expect(page.locator(".catalog-variant-details").first().getByRole("checkbox", { name: "Mayorista" })).toBeDisabled();
  await page.locator(".variant-edit-row").getByRole("spinbutton", { name: "Precio", exact: true }).fill("1200");
  await page.locator(".variant-edit-row").getByRole("button", { name: "Guardar" }).click();
  await expect.poll(() => writes.find((entry) => entry.table === "commerce_variants" && entry.method === "PATCH")?.body.base_price_minor).toBe(120000);
  const change = writes.find((entry) => entry.table === "commerce_variants" && entry.method === "PATCH")?.body;
  expect(change).not.toHaveProperty("wholesale_price_arg");
  expect(change).not.toHaveProperty("available_wholesale");
});
