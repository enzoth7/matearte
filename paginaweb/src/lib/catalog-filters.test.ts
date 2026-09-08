import { describe, expect, it } from "vitest";
import {
  filterAndSortCatalog,
  findMatchingVariantForColors,
  getProductColors,
  getVariantColorHex,
  getVariantColorId,
  matchVariantWithColor,
  parseCatalogFilters,
  writeCatalogFilters,
  type CatalogFilters,
} from "./catalog-filters";
import type { Product } from "@/types/catalog";

function product(id: string, priceUYU: number, overrides: Partial<Product["filterData"]> = {}) {
  return {
    product: {
      id,
      slug: id,
      name: id,
      category: "mates",
      eyebrow: "",
      summary: "",
      description: "",
      materials: [],
      filterData: { priceUYU, materials: ["cuero"], mateType: "imperial", ...overrides },
      images: [],
      variants: [],
    } satisfies Product,
  };
}

const defaults: CatalogFilters = { category: "todas", prices: [], materials: [], productTypes: [], colors: [], sort: "editorial" };

describe("filtros del catálogo", () => {
  it("respeta los límites sin superponer rangos", () => {
    const entries = [product("2999", 2999), product("3000", 3000), product("4999", 4999), product("5000", 5000), product("6999", 6999), product("7000", 7000)];
    expect(filterAndSortCatalog(entries, { ...defaults, prices: ["menos-3000"] }).map(({ product }) => product.id)).toEqual(["2999"]);
    expect(filterAndSortCatalog(entries, { ...defaults, prices: ["3000-4999"] }).map(({ product }) => product.id)).toEqual(["3000", "4999"]);
    expect(filterAndSortCatalog(entries, { ...defaults, prices: ["5000-6999"] }).map(({ product }) => product.id)).toEqual(["5000", "6999"]);
    expect(filterAndSortCatalog(entries, { ...defaults, prices: ["7000-mas"] }).map(({ product }) => product.id)).toEqual(["7000"]);
  });

  it("combina grupos con AND y opciones de un mismo grupo con OR", () => {
    const entries: Array<{ product: Product }> = [
      product("imperial-cuero", 4500),
      product("camionero-acero", 5500, { materials: ["acero-inoxidable"], mateType: "camionero" }),
      product("imperial-alpaca", 3800, { materials: ["alpaca"], mateType: "imperial" }),
    ];
    const visible = filterAndSortCatalog(entries, { ...defaults, prices: ["3000-4999", "5000-6999"], materials: ["cuero", "alpaca"], productTypes: ["imperial"] });
    expect(visible.map(({ product }) => product.id)).toEqual(["imperial-cuero", "imperial-alpaca"]);
  });

  it("lee, valida y vuelve a escribir parámetros repetibles", () => {
    const filters = parseCatalogFilters(new URLSearchParams("categoria=billeteras&precio=menos-3000&precio=7000-mas&material=estampado&tipo=torpedo&orden=precio&precio=invalido"));
    expect(filters).toMatchObject({ category: "billeteras", prices: ["menos-3000", "7000-mas"], materials: ["estampado"], productTypes: ["torpedo"], sort: "precio" });
    expect(writeCatalogFilters(filters).getAll("precio")).toEqual(["menos-3000", "7000-mas"]);
    expect(writeCatalogFilters(filters).getAll("material")).toEqual(["estampado"]);
  });

  it("filtra los nuevos productos por categoría, material y color", () => {
    const entries: Array<{ product: Product }> = [
      {
        product: {
          ...product("bombillon-cincelado", 4200).product,
          category: "bombillones",
          filterData: { priceUYU: 4200, materials: ["plata"], productTypes: [], colors: ["marron"] },
        },
      },
      {
        product: {
          ...product("billetera-dama", 3500).product,
          category: "billeteras",
          filterData: { priceUYU: 3500, materials: ["cuero"], productTypes: [], colors: ["negro", "natural"] },
        },
      },
    ];
    const visible = filterAndSortCatalog(entries, { ...defaults, category: "bombillones", materials: ["plata"], colors: ["marron"] });
    expect(visible.map(({ product }) => product.id)).toEqual(["bombillon-cincelado"]);
  });

  it("reconoce colores de variantes y permite filtrar por ellos", () => {
    const p1: Product = {
      ...product("mate-camionero-cuero", 4000).product,
      variants: [
        { id: "v-negro", label: "Negro", value: "negro" },
        { id: "v-marron", label: "Marrón", value: "marron" },
      ],
      filterData: { priceUYU: 4000, materials: ["cuero"], productTypes: [] },
    };
    const p2: Product = {
      ...product("mate-imperial-rojo", 4500).product,
      variants: [
        { id: "v-rojo", label: "Rojo", value: "rojo" },
      ],
      filterData: { priceUYU: 4500, materials: ["cuero"], productTypes: [] },
    };

    const entries = [{ product: p1 }, { product: p2 }];

    const filteredNegro = filterAndSortCatalog(entries, { ...defaults, colors: ["negro"] });
    expect(filteredNegro.map(({ product }) => product.id)).toEqual(["mate-camionero-cuero"]);

    const filteredRojo = filterAndSortCatalog(entries, { ...defaults, colors: ["rojo"] });
    expect(filteredRojo.map(({ product }) => product.id)).toEqual(["mate-imperial-rojo"]);
  });

  it("prioriza el campo color explícito de las variantes", () => {
    const p: Product = {
      ...product("mate-imperial-especial", 5000).product,
      variants: [
        { id: "v-1", label: "Edición A", value: "ed-a", color: "cuero-crudo" },
        { id: "v-2", label: "Edición B (negro)", value: "ed-b", color: "marron" },
      ],
      filterData: { priceUYU: 5000, materials: ["cuero"], productTypes: [], colors: ["blanco"] },
    };

    // getProductColors prioriza los colores de las variantes sobre filterData
    const colors = getProductColors(p);
    expect(colors).toEqual(["cuero-crudo", "marron", "blanco"]);

    // findMatchingVariantForColors busca primero por v.color
    const matchMarron = findMatchingVariantForColors(p, ["marron"]);
    expect(matchMarron?.id).toBe("v-2");

    // getVariantColorId y getVariantColorHex usan v.color directamente
    expect(getVariantColorId(p.variants[0])).toBe("cuero-crudo");
    expect(getVariantColorHex(p.variants[0])).toBe("#e8d9bb");
    expect(getVariantColorId(p.variants[1])).toBe("marron");
    expect(getVariantColorHex(p.variants[1])).toBe("#6c4530");
  });

  it("reconoce y procesa correctamente los nuevos colores celeste, azul y beige", () => {
    expect(matchVariantWithColor("Mate Celeste Cielo", "celeste")).toBe(true);
    expect(matchVariantWithColor("Sky blue edition", "celeste")).toBe(true);
    expect(matchVariantWithColor("Mate Azul Marino", "azul")).toBe(true);
    expect(matchVariantWithColor("Blue classic", "azul")).toBe(true);
    expect(matchVariantWithColor("Mate Beige Suave", "beige")).toBe(true);
    expect(matchVariantWithColor("Color Arena", "beige")).toBe(true);

    expect(getVariantColorId("Celeste")).toBe("celeste");
    expect(getVariantColorId("Azul profundo")).toBe("azul");
    expect(getVariantColorId("Arena")).toBe("beige");
    expect(getVariantColorId("Beige claro")).toBe("beige");

    expect(getVariantColorHex("celeste")).toBe("#74acdf");
    expect(getVariantColorHex("azul")).toBe("#1e3a8a");
    expect(getVariantColorHex("beige")).toBe("#dfd1b8");
  });
});

