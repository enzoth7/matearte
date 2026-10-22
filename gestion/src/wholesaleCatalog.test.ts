import { describe, expect, it } from "vitest";
import { wholesaleFromCatalog } from "./wholesaleSource";

const variant = (id: string, overrides: Record<string, unknown> = {}) => ({ id, sku: "150", name: "Negro", price_minor: 100000, base_price_minor: 100000, active: true, weight_grams: null, color: "negro", option_values: { color: "negro" }, wholesale_price_arg: 18500, available_local: true, available_web: true, available_wholesale: true, ...overrides });
const row = (variants: ReturnType<typeof variant>[], images: Record<string, unknown>[] = []) => ({ id: "p1", name: "Criollo Coquito", category: "mates", category_code: "mates", description: "", attributes: { "tipo-mate": "criollo" }, commerce_variants: variants, commerce_product_images: images }) as never;

describe("mayorista sobre el catálogo único", () => {
  it("convierte solo las variantes con mayorista activo, con precio ARS y UYU", () => {
    const { products } = wholesaleFromCatalog([row([variant("v1"), variant("v2", { available_wholesale: false, sku: "151" })])], 0.027);
    expect(products).toHaveLength(1);
    expect(products[0]).toMatchObject({ id: "v1", model: "Criollo Coquito", variant: "Negro", sku: "150", price_arg: 18500, commerce_variant_id: "v1", commerce_product_id: "p1" });
    expect(products[0].price_uyu).toBeCloseTo(499.5);
  });

  it("toma como portada la foto de la variante, o la general del producto", () => {
    const images = [
      { id: "g", storage_path: "p1/general.png", alt_text: "", sort_order: 0, variant_id: null, option_values: {} },
      { id: "e", storage_path: "p1/negro.png", alt_text: "", sort_order: 1, variant_id: "v1", option_values: {} },
    ];
    const { images: covers } = wholesaleFromCatalog([row([variant("v1"), variant("v2", { color: "marron", option_values: { color: "marron" }, sku: "151" })], images)], 0.027);
    expect(covers.find(item => item.product_id === "v1")?.storage_path).toBe("p1/negro.png");
    expect(covers.find(item => item.product_id === "v2")?.storage_path).toBe("p1/general.png");
  });

  it("no inventa precio mayorista cuando falta", () => {
    const { products } = wholesaleFromCatalog([row([variant("v1", { wholesale_price_arg: null })])], 0.027);
    expect(products[0].price_arg).toBe(0);
  });
});
