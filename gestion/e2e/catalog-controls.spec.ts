import { test, expect } from "@playwright/test";
import { mockCommerce } from "./commerce-fixture";
import { defaultCatalogTaxonomy } from "../../shared/catalog-taxonomy";

test("materiales alineados y ajuste de precio por producto", async ({ page }) => {
  const { writes, tables } = await mockCommerce(page, { writable: true });
  tables.commerce_attribute_definitions = defaultCatalogTaxonomy.attributes;
  tables.commerce_attribute_options = defaultCatalogTaxonomy.options;
  tables.commerce_category_attributes = defaultCatalogTaxonomy.rules;
  await page.goto("/productos/catalogo?producto=product-1");
  const material = page.locator(".material-option").first();
  await expect(material).toBeVisible();
  expect(await material.evaluate((element) => getComputedStyle(element).flexDirection)).toBe("row");
  expect(await material.evaluate((element) => element.getBoundingClientRect().height)).toBeLessThan(50);

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

test("las páginas retiradas vuelven a la lista única del catálogo", async ({ page }) => {
  await mockCommerce(page);
  await page.goto("/productos/precios");
  await expect(page).toHaveURL(/\/productos\/catalogo\?vista=lista$/);
  await expect(page.getByRole("columnheader", { name: "SKU" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Ajustes y mayoristas" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Precios por canal" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Publicación y contenido web" })).toHaveCount(0);
});
