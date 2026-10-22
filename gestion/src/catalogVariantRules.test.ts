import { describe, expect, it } from "vitest";
import {
  colorOnlyVariantValues,
  defaultCatalogTaxonomy,
  formatVariantLabel,
  taxonomyRulesForCategory,
  taxonomyRulesForProduct,
} from "../../shared/catalog-taxonomy";

describe("regla de variantes del catálogo", () => {
  it("solo permite color como diferencia de variante en todas las categorías", () => {
    for (const category of defaultCatalogTaxonomy.categories) {
      expect(taxonomyRulesForCategory(defaultCatalogTaxonomy, category.code, "variant")
        .every(rule => rule.attribute_code === "color")).toBe(true);
    }
  });

  it("trata virola, cuero, posamate, talle y capacidad como datos del producto", () => {
    const mates = taxonomyRulesForCategory(defaultCatalogTaxonomy, "mates", "product").map(rule => rule.attribute_code);
    const botas = taxonomyRulesForCategory(defaultCatalogTaxonomy, "botas", "product").map(rule => rule.attribute_code);
    const termos = taxonomyRulesForCategory(defaultCatalogTaxonomy, "termos", "product").map(rule => rule.attribute_code);

    expect(mates).toEqual(expect.arrayContaining(["tipo-virola", "tipo-cuero", "posamate", "tamano"]));
    expect(botas).toContain("talle");
    expect(termos).toContain("capacidad-ml");
  });

  it("muestra el diseño de fleje solo para mates imperiales y ofrece las opciones nuevas", () => {
    const codes = (values: Record<string, string>) => taxonomyRulesForProduct(defaultCatalogTaxonomy, "mates", values, "product").map(rule => rule.attribute_code);
    expect(codes({ "tipo-mate": "imperial" })).toContain("diseno-fleje");
    expect(codes({ "tipo-mate": "camionero" })).not.toContain("diseno-fleje");
    expect(codes({})).not.toContain("diseno-fleje");
    expect(codes({ "tipo-mate": "criollo" })).toContain("diseno-fleje");
    expect(codes({ "tipo-mate": "torpedo" })).not.toContain("diseno-fleje");
    const flejeRule = taxonomyRulesForProduct(defaultCatalogTaxonomy, "mates", { "tipo-mate": "criollo" }, "product").find(rule => rule.attribute_code === "diseno-fleje");
    expect(flejeRule?.required).toBe(false);
    const options = (attribute: string) => defaultCatalogTaxonomy.options.filter(item => item.attribute_code === attribute).map(item => item.label_es);
    expect(options("diseno-fleje")).toEqual(["Pampa", "Griego", "Rupestre", "Flores", "Abstracto", "Liso", "Premium", "Manos"]);
    expect(options("tipo-virola")).toEqual(expect.arrayContaining(["Sin Virola", "Plata", "Alpaca Grande Cincelada Premium", "Imperial Premium", "Acero y Bronce Liso", "Imperial Acero Inoxidable"]));
    expect(options("tipo-cuero")).toContain("Sin Cuero");
  });

  it("descarta cualquier dato heredado que no sea color al guardar una variante", () => {
    const values = colorOnlyVariantValues({ color: "marron", tamano: "grande", "tipo-virola": "acero" });
    expect(values).toEqual({ color: "marron" });
    expect(formatVariantLabel(defaultCatalogTaxonomy, "mates", values)).toBe("Marrón");
  });

  it("pide tipo y muestra solo los campos propios de mate o matera", () => {
    const rules = (values: Record<string, string>) => taxonomyRulesForProduct(defaultCatalogTaxonomy, "personalizados", values, "product")
      .map(rule => rule.attribute_code);
    expect(rules({})).toContain("tipo-personalizado");
    expect(rules({})).not.toContain("material-mate");
    expect(rules({ "tipo-personalizado": "mate" })).toEqual(expect.arrayContaining(["material-mate", "tipo-virola", "tipo-cuero", "posamate"]));
    expect(rules({ "tipo-personalizado": "mate" })).not.toContain("diseno-matera");
    expect(rules({ "tipo-personalizado": "matera" })).toEqual(expect.arrayContaining(["forma", "material", "diseno-matera"]));
    expect(rules({ "tipo-personalizado": "matera" })).not.toContain("tipo-virola");
    expect(taxonomyRulesForProduct(defaultCatalogTaxonomy, "personalizados", { "tipo-personalizado": "matera" }, "variant")
      .map(rule => rule.attribute_code)).toEqual(["color"]);
  });
});
