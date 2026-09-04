import { describe, expect, it } from "vitest";
import { filterAndSortCatalog, parseCatalogFilters, writeCatalogFilters, type CatalogFilters } from "./catalog-filters";
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

const defaults: CatalogFilters = { category: "todas", prices: [], materials: [], productTypes: [], finishes: [], colors: [], sort: "editorial" };

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
    const filters = parseCatalogFilters(new URLSearchParams("categoria=dama&precio=menos-3000&precio=7000-mas&material=cuero&tipo=torpedo&terminacion=cincelado&orden=precio&precio=invalido"));
    expect(filters).toMatchObject({ category: "dama", prices: ["menos-3000", "7000-mas"], materials: ["cuero"], productTypes: ["torpedo"], finishes: ["cincelado"], sort: "precio" });
    expect(writeCatalogFilters(filters).getAll("precio")).toEqual(["menos-3000", "7000-mas"]);
    expect(writeCatalogFilters(filters).getAll("terminacion")).toEqual(["cincelado"]);
  });

  it("filtra los nuevos productos por familia, modelo, terminación y color", () => {
    const entries: Array<{ product: Product }> = [
      {
        product: {
          ...product("bombillon-cincelado", 4200).product,
          category: "bombillas",
          filterData: { priceUYU: 4200, materials: ["plata"], productTypes: ["bombillon", "pico-de-loro"], finishes: ["cincelado", "con-aros"], colors: ["marron"] },
        },
      },
      {
        product: {
          ...product("billetera-dama", 3500).product,
          category: "dama",
          filterData: { priceUYU: 3500, materials: ["cuero"], productTypes: ["billetera"], finishes: ["liso"], colors: ["negro", "natural"] },
        },
      },
    ];
    const visible = filterAndSortCatalog(entries, { ...defaults, category: "bombillas", materials: ["plata"], productTypes: ["pico-de-loro"], finishes: ["con-aros"], colors: ["marron"] });
    expect(visible.map(({ product }) => product.id)).toEqual(["bombillon-cincelado"]);
  });
});
