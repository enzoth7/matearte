import { describe, expect, it } from "vitest";
import { defaultCatalogTaxonomy, optionSignature } from "../../../shared/catalog-taxonomy";
import { validatedCatalogSelection } from "./cart";

const variant = { color: "natural", option_values: { color: "natural" } };

describe("selección comercial del carrito", () => {
  it("exige tamaño cuando el mate ofrece todos y separa dos medidas del mismo color", () => {
    const product = { name: "Mate Imperial", category_code: "mates", attributes: { tamano: "todos", interior: "calabaza" } };
    expect(() => validatedCatalogSelection(defaultCatalogTaxonomy, product, variant, { color: "natural" })).toThrow(/Elegí un valor válido/);
    const chico = validatedCatalogSelection(defaultCatalogTaxonomy, product, variant, { color: "natural", tamano: "chico", interior: "calabaza" });
    const grande = validatedCatalogSelection(defaultCatalogTaxonomy, product, variant, { color: "natural", tamano: "grande", interior: "calabaza" });
    expect(optionSignature(chico)).not.toBe(optionSignature(grande));
    expect(() => validatedCatalogSelection(defaultCatalogTaxonomy, product, variant, { color: "natural", tamano: "todos" })).toThrow();
  });

  it("acepta solo la medida fija del producto y descarta selecciones antiguas", () => {
    const product = { name: "Mate Imperial", category_code: "mates", attributes: { tamano: "mediano", interior: "calabaza" } };
    expect(validatedCatalogSelection(defaultCatalogTaxonomy, product, variant, { color: "natural", tamano: "mediano", interior: "calabaza" })).toEqual({ color: "natural", tamano: "mediano", interior: "calabaza" });
    expect(() => validatedCatalogSelection(defaultCatalogTaxonomy, product, variant, { color: "natural", tamano: "grande" })).toThrow();
    expect(() => validatedCatalogSelection(defaultCatalogTaxonomy, product, variant, { color: "natural", tamano: "mediano", material: "cuero" })).toThrow();
  });

  it("exige interior en un imperial y separa las compras por interior", () => {
    const product = { name: "Mate Criollo Imperial Fleje Flores", category_code: "mates", attributes: { "tipo-mate": "criollo", tamano: "mediano", interior: "todos" } };
    const selected = { color: "natural", tamano: "mediano" };
    expect(() => validatedCatalogSelection(defaultCatalogTaxonomy, product, variant, selected)).toThrow(/Interior/);
    const calabaza = validatedCatalogSelection(defaultCatalogTaxonomy, product, variant, { ...selected, interior: "calabaza" });
    const ceramica = validatedCatalogSelection(defaultCatalogTaxonomy, product, variant, { ...selected, interior: "ceramica" });
    expect(optionSignature(calabaza)).not.toBe(optionSignature(ceramica));
    expect(() => validatedCatalogSelection(defaultCatalogTaxonomy, product, variant, { ...selected, interior: "todos" })).toThrow();
  });

  it("solo admite calabaza en torpedos y criollos comunes, también personalizados", () => {
    for (const product of [
      { name: "Mate Torpedo", category_code: "mates", attributes: { "tipo-mate": "torpedo", tamano: "mediano", interior: "calabaza" } },
      { name: "Mate Criollo Virola de Alpaca", category_code: "mates", attributes: { "tipo-mate": "criollo", tamano: "mediano", interior: "calabaza" } },
      { name: "Mate Criollo personalizado", category_code: "personalizados", attributes: { "tipo-personalizado": "mate", "tipo-mate": "criollo", tamano: "mediano", interior: "calabaza" } },
    ]) {
      expect(validatedCatalogSelection(defaultCatalogTaxonomy, product, variant, { color: "natural", tamano: "mediano", interior: "calabaza" }).interior).toBe("calabaza");
      expect(() => validatedCatalogSelection(defaultCatalogTaxonomy, product, variant, { color: "natural", tamano: "mediano", interior: "ceramica" })).toThrow();
    }
  });

  it("impide comprar una bombilla o cinto sin largo configurado", () => {
    expect(() => validatedCatalogSelection(defaultCatalogTaxonomy, { category_code: "bombillas", attributes: {} }, { option_values: {} }, {})).toThrow(/configurar sus opciones de compra/);
    expect(() => validatedCatalogSelection(defaultCatalogTaxonomy, { category_code: "cintos", attributes: {} }, { option_values: {} }, {})).toThrow(/configurar sus opciones de compra/);
    expect(validatedCatalogSelection(defaultCatalogTaxonomy, { category_code: "bombillas", attributes: { "largo-mm": "larga" } }, { option_values: {} }, { "largo-mm": "larga" })).toEqual({ "largo-mm": "larga" });
  });

  it("Todos los largos exige elegir un largo y separa las dos elecciones", () => {
    const product = { category_code: "bombillas", attributes: { "largo-mm": "todos" } };
    expect(() => validatedCatalogSelection(defaultCatalogTaxonomy, product, { option_values: {} }, {})).toThrow(/Largo/);
    const corta = validatedCatalogSelection(defaultCatalogTaxonomy, product, { option_values: {} }, { "largo-mm": "corta" });
    const larga = validatedCatalogSelection(defaultCatalogTaxonomy, product, { option_values: {} }, { "largo-mm": "larga" });
    expect(optionSignature(corta)).not.toBe(optionSignature(larga));
    expect(() => validatedCatalogSelection(defaultCatalogTaxonomy, product, { option_values: {} }, { "largo-mm": "todos" })).toThrow();
  });

  it("valida talle de bota y el color elegido", () => {
    const product = { category_code: "botas", attributes: { talle: "todos" } };
    expect(validatedCatalogSelection(defaultCatalogTaxonomy, product, variant, { color: "natural", talle: "38" })).toEqual({ color: "natural", talle: "38" });
    expect(() => validatedCatalogSelection(defaultCatalogTaxonomy, product, variant, { color: "negro", talle: "38" })).toThrow(/color/);
  });

  it("acepta varios talles de botas y zuecos sin mezclar las líneas del carrito", () => {
    for (const category_code of ["botas", "zuecos"]) {
      const product = { category_code, attributes: { talle: ["36", "38", "40"] } };
      const size36 = validatedCatalogSelection(defaultCatalogTaxonomy, product, variant, { color: "natural", talle: "36" });
      const size40 = validatedCatalogSelection(defaultCatalogTaxonomy, product, variant, { color: "natural", talle: "40" });
      expect(optionSignature(size36)).not.toBe(optionSignature(size40));
      expect(() => validatedCatalogSelection(defaultCatalogTaxonomy, product, variant, { color: "natural", talle: "37" })).toThrow(/Talle/);
      expect(() => validatedCatalogSelection(defaultCatalogTaxonomy, product, variant, { color: "natural" })).toThrow(/Talle/);
    }
  });
});
