import { describe, expect, it } from "vitest";
import type { Product } from "./data";
import { changeCustomFacet, customFacetLabel, customFacetValues, matchingCustomProducts, UNSPECIFIED } from "./customArticleFacets";

const mate = (attributes: Record<string, unknown>): Product => ({
  id: "variant", name: "Mate Imperial", sku: "198", categoryCode: "mates", family: "Mates", variant: "Negro",
  options: { color: "negro" }, rim: "", leather: "", cost: 0, prices: { Local: 2600, Web: 2600, Mayorista: 0 }, stock: 0, min: 0, published: true,
  attributes: { "tipo-mate": "imperial", "material-mate": "cuero", "tipo-cuero": "liso", interior: "todos", tamano: "todos", ...attributes },
});

describe("combinaciones de mates personalizados", () => {
  it("calabaza conserva los cueros liso, crudo, croco y pelos", () => {
    const products = ["liso", "crudo", "croco", "pelos"].map(texture => mate({ "tipo-cuero": texture }));
    expect(matchingCustomProducts(products, { interior: "calabaza" })).toHaveLength(4);
    expect(customFacetValues(products[0], "material")).toEqual(["cuero"]);
    expect(customFacetValues(products[0], "interior")).toEqual(["calabaza", "ceramica"]);
    expect(customFacetValues(products[0], "tamano")).not.toContain("todos");
  });
  it("no inventa cerámica en torpedos ni interior cuando solo se conoce el cuero", () => {
    expect(customFacetValues({ ...mate({ "tipo-mate": "torpedo" }), name: "Mate Torpedo" }, "interior")).toEqual(["calabaza"]);
    expect(customFacetValues(mate({ interior: undefined }), "interior")).toEqual([UNSPECIFIED]);
    expect(customFacetValues(mate({ "material-mate": "madera", interior: undefined }), "interior")).toEqual(["madera"]);
  });
  it("distingue mate sin revestimiento y virola original sin asignarle un metal", () => {
    expect(customFacetValues(mate({ material: "cuero", "tipo-cuero": "sin-cuero" }), "material")).toEqual(["sin-revestimiento"]);
    expect(customFacetLabel("tipo-virola", "imperial")).toBe("Imperial original");
  });
  it("cambiar la textura reemplaza filtros incompatibles y conserva el interior", () => {
    const products = [mate({ "tipo-cuero": "liso", pie: "comun" }), mate({ "tipo-cuero": "croco", pie: "alpaca" })];
    const chosen = changeCustomFacet(products, { interior: "calabaza", "tipo-cuero": "liso", pie: "comun" }, "tipo-cuero", "croco");
    expect(chosen).toEqual({ "tipo-cuero": "croco", interior: "calabaza" });
    expect(matchingCustomProducts(products, chosen)).toEqual([products[1]]);
  });
});
