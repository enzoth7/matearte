import { describe, expect, it } from "vitest";
import { matchesSaleProductSearch } from "./saleProductSearch";

const product = {
  name: "Mate Criollo Camionero con Posa Mate",
  sku: "SKU 576",
  variant: "Natural",
  category: "Mates",
  attributes: { "tipo-cuero": "vaqueta", "material-mate": "cuero" },
  price: 21800,
};

describe("búsqueda de artículos en ventas", () => {
  it("encuentra fragmentos del nombre, sin acentos ni orden fijo", () => {
    expect(matchesSaleProductSearch(product, "camion cri")).toBe(true);
    expect(matchesSaleProductSearch({ ...product, name: "Cerámica artesanal" }, "ceram")).toBe(true);
  });

  it("encuentra códigos, materiales y el precio escrito con o sin separador", () => {
    for (const query of ["576", "vaqueta", "cuero", "21.800", "21800", "vaq 576"]) {
      expect(matchesSaleProductSearch(product, query)).toBe(true);
    }
    expect(matchesSaleProductSearch(product, "99999")).toBe(false);
  });

  it("usa el precio que recibe cada formulario", () => {
    expect(matchesSaleProductSearch({ ...product, price: 19000 }, "21.800")).toBe(false);
    expect(matchesSaleProductSearch({ ...product, price: 19000 }, "19.000")).toBe(true);
  });
});
