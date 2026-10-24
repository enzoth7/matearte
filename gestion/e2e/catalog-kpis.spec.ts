import { test, expect } from "@playwright/test";
import { mockCommerce } from "./commerce-fixture";

test("los indicadores del catálogo siguen los artículos visibles y su disponibilidad real en web", async ({ page }) => {
  const { fixture } = await mockCommerce(page);
  fixture.products[0].commerce_variants[1].active = false;
  fixture.reference.categories.push({ code: "cintos", label_es: "Cintos", active: true });
  fixture.products.push({
    id: "product-2", name: "Cinto de prueba", editorial_slug: "cinto-prueba",
    category: "cintos", category_code: "cintos", description: "", sale_mode: "standard",
    published: false, peso: 0, updated_at: "2026-10-23T12:00:00Z", attributes: {},
    commerce_product_images: [{ id: "image-2", storage_path: "products/cinto.png", original_name: "cinto.png", alt_text: "", mime_type: "image/png", byte_size: 100, sort_order: 0, variant_id: null, option_values: {} }],
    commerce_variants: [{ id: "variant-3", sku: "CINTO-1", name: "Negro", price_minor: 150000, base_price_minor: 150000, active: true, available_web: true, weight_grams: 0 }],
  });

  const kpi = (label: string) => page.locator(".stats .stat").filter({ has: page.getByText(label, { exact: true }) }).locator("strong");
  const expectKpis = async (visible: string, web: string, active: string) => {
    await expect(kpi("Artículos visibles")).toHaveText(visible);
    await expect(kpi("Disponibles en web")).toHaveText(web);
    await expect(kpi("Artículos activos")).toHaveText(active);
  };

  await page.goto("/productos/catalogo");
  await expectKpis("3", "1", "2");
  const clearFilters = page.getByRole("button", { name: "Quitar filtros" });
  await expect(clearFilters).toBeDisabled();
  const help = page.getByRole("button", { name: "Qué significa Disponibles en web" });
  await help.hover();
  await expect(page.getByRole("tooltip")).toContainText("producto está publicado");
  await help.click();
  await expect(help).toHaveAttribute("aria-expanded", "true");
  await help.press("Escape");
  await expect(help).toHaveAttribute("aria-expanded", "false");
  await page.getByRole("combobox", { name: "Familia" }).selectOption("Mates");
  await expectKpis("2", "1", "1");
  await page.getByRole("combobox", { name: "Estado" }).selectOption("Inactivos");
  await expectKpis("1", "0", "0");
  await page.getByRole("combobox", { name: "Estado" }).selectOption("Todos");
  await page.getByRole("textbox", { name: "Buscar productos" }).fill("SKU-1");
  await expectKpis("1", "1", "1");
  await page.getByRole("textbox", { name: "Buscar productos" }).clear();
  await page.getByRole("combobox", { name: "Familia" }).selectOption("Todos");
  await page.getByRole("combobox", { name: "Imagen" }).selectOption("Con imagen");
  await expectKpis("1", "0", "1");
  await page.getByRole("button", { name: "Lista" }).click();
  await expectKpis("1", "0", "1");
  await expect(page.locator(".catalog-general-list tbody tr")).toHaveCount(1);
  await page.getByRole("combobox", { name: "Estado" }).selectOption("Activos");
  await page.getByRole("textbox", { name: "Buscar productos" }).fill("CINTO");
  await clearFilters.click();
  await expect(page.getByRole("combobox", { name: "Familia" })).toHaveValue("Todos");
  await expect(page.getByRole("combobox", { name: "Estado" })).toHaveValue("Todos");
  await expect(page.getByRole("combobox", { name: "Imagen" })).toHaveValue("Todas");
  await expect(page.getByRole("textbox", { name: "Buscar productos" })).toHaveValue("");
  await expect(clearFilters).toBeDisabled();
  await expectKpis("3", "1", "2");
  await expect(page.locator(".catalog-general-list tbody tr")).toHaveCount(3);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("combobox", { name: "Estado" }).selectOption("Inactivos");
  await expect(clearFilters).toBeVisible();
  const clearButtonBounds = await clearFilters.boundingBox();
  expect(clearButtonBounds && clearButtonBounds.x >= 0 && clearButtonBounds.x + clearButtonBounds.width <= 390).toBe(true);
});
