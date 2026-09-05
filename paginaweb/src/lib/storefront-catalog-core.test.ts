import { describe, expect, it } from "vitest";
import type { Product } from "@/types/catalog";
import {
  mergeStorefrontProducts,
  storefrontProductFromRow,
  type StorefrontProductRow,
} from "./storefront-catalog-core";

const baseUrl = "https://example.supabase.co";

const editorialProduct: Product = {
  id: "mate-imperial",
  slug: "mate-imperial",
  name: "Mate Imperial editorial",
  category: "mates",
  eyebrow: "Cuero & alpaca",
  summary: "Resumen editorial",
  description: "Descripción editorial",
  materials: ["Cuero", "Alpaca"],
  filterData: {
    priceUYU: 4000,
    materials: ["cuero", "alpaca"],
    mateType: "imperial",
  },
  images: [{
    src: "/editorial.png",
    alt: "Imagen editorial",
    width: 800,
    height: 800,
    source: "provided",
    sourceUrl: "/editorial.png",
    rightsStatus: "brand-public",
  }],
  variants: [],
};

function commerceProduct(overrides: Partial<StorefrontProductRow> = {}): StorefrontProductRow {
  return {
    id: "commerce-product-id",
    editorial_slug: "producto-nuevo",
    name: "Producto nuevo",
    category: "accesorios",
    description: "Descripción cargada en el panel",
    sale_mode: "standard",
    published: true,
    variants: [
      {
        id: "variant-expensive",
        sku: "NUEVO-2",
        name: "Grande",
        price_minor: 550000,
        currency: "UYU",
        inventory_tracked: true,
        stock_on_hand: 2,
        stock_reserved: 2,
        active: true,
      },
      {
        id: "variant-cheap",
        sku: "NUEVO-1",
        name: "Estándar",
        price_minor: 450000,
        currency: "UYU",
        inventory_tracked: true,
        stock_on_hand: 3,
        stock_reserved: 1,
        active: true,
      },
    ],
    images: [
      { id: "image-2", storage_path: "products/nuevo/segunda foto.webp", alt_text: "Segunda", sort_order: 2, mime_type: "image/webp", variant_id: null },
      { id: "image-1", storage_path: "products/nuevo/portada.webp", alt_text: "Portada", sort_order: 1, mime_type: "image/webp", variant_id: null },
    ],
    ...overrides,
  };
}

describe("catálogo público conectado a Supabase", () => {
  it("convierte imágenes, variantes, stock y precio mínimo cargados en el panel", () => {
    const product = storefrontProductFromRow(commerceProduct(), baseUrl, "es");

    expect(product.name).toBe("Producto nuevo");
    expect(product.category).toBe("accesorios");
    expect(product.filterData.priceUYU).toBe(4500);
    expect(product.images[0]).toMatchObject({
      source: "supabase",
      alt: "Portada",
      src: `${baseUrl}/storage/v1/object/public/product-images/products/nuevo/portada.webp`,
    });
    expect(product.variants.map((variant) => [variant.value, variant.available])).toEqual([
      ["NUEVO-1", true],
      ["NUEVO-2", false],
    ]);
  });

  it("usa Supabase como fuente del catálogo y excluye productos ausentes o de pruebas", () => {
    const visible = commerceProduct();
    const sandbox = commerceProduct({ id: "sandbox-id", editorial_slug: "sandbox", category: "sandbox" });
    const result = mergeStorefrontProducts([editorialProduct], [visible, sandbox], baseUrl, "es");

    expect(result.map((product) => product.slug)).toEqual(["producto-nuevo"]);
  });

  it("usa los atributos normalizados cargados desde el panel", () => {
    const product = storefrontProductFromRow(commerceProduct({
      category: "billeteras",
      catalog_filters: {
        materials: ["cuero"],
        productTypes: [],
        colors: ["negro", "natural"],
      },
    }), baseUrl, "es");

    expect(product.category).toBe("billeteras");
    expect(product.filterData).toMatchObject({
      materials: ["cuero"],
      productTypes: [],
      colors: ["negro", "natural"],
    });
  });

  it("actualiza un producto editorial por slug sin perder sus filtros ni su traducción", () => {
    const linked = commerceProduct({
      editorial_slug: editorialProduct.slug,
      name: "Nombre del panel",
      category: "mates",
    });
    const [product] = mergeStorefrontProducts([editorialProduct], [linked], baseUrl, "en");

    expect(product.id).toBe(editorialProduct.id);
    expect(product.name).toBe(editorialProduct.name);
    expect(product.filterData.materials).toEqual(["cuero", "alpaca"]);
    expect(product.filterData.productTypes).toEqual(["imperial"]);
    expect(product.filterData.priceUYU).toBe(4500);
    expect(product.images[0].source).toBe("supabase");
  });
});
