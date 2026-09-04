import { describe, expect, it } from "vitest";
import { categories, products } from "./catalog";

describe("catálogo MateArte", () => {
  it("mantiene slugs e identificadores únicos", () => {
    expect(new Set(products.map((product) => product.slug)).size).toBe(products.length);
    expect(new Set(products.map((product) => product.id)).size).toBe(products.length);
  });

  it("asigna todos los productos a categorías existentes", () => {
    const categorySlugs = new Set<string>(categories.map((category) => category.slug));
    expect(products.every((product) => categorySlugs.has(product.category))).toBe(true);
  });

  it("no publica precios ni variantes comprables", () => {
    const variants = products.flatMap((product) => product.variants);
    expect(variants.every((variant) => variant.price === undefined)).toBe(true);
    expect(variants.every((variant) => variant.commerceId === undefined)).toBe(true);
  });

  it("registra procedencia y derechos para cada imagen", () => {
    const images = [...categories.map((category) => category.image), ...products.flatMap((product) => product.images)];
    expect(images.every((image) => Boolean(image.sourceUrl))).toBe(true);
    expect(images.every((image) => Boolean(image.rightsStatus))).toBe(true);
  });
});
