import { describe, expect, it } from "vitest";
import { buildProductDescription, isMadeByMateArte, truncateForMeta } from "@/lib/product-description";
import type { CatalogAttributeDetail } from "../../../shared/catalog-taxonomy";

const detail = (code: string, label: string, values: string[], rawValue: unknown = values[0]): CatalogAttributeDetail =>
  ({ code, label, values, rawValue } as CatalogAttributeDetail);

const mate = {
  name: "Mate Camionero Cuero Crudo Alpaca Cincelada",
  category: "mates",
  details: [
    detail("tipo-mate", "Tipo de mate", ["Camionero"]),
    detail("material-mate", "Material del mate", ["Cuero"]),
    detail("tipo-virola", "Tipo de virola", ["Alpaca cincelada"]),
    detail("tamano", "Tamaño", ["Chico", "Mediano", "Grande"], "todos"),
    detail("tipo-personalizado", "Tipo personalizado", ["Mate"]),
  ],
  colors: ["Negro", "Marrón"],
  madeToOrder: false,
};

describe("texto de respaldo para productos sin descripción en Gestión", () => {
  it("no muestra texto en la ficha y arma los metadatos solo con datos del producto", () => {
    const { summary, description } = buildProductDescription(mate, "es");

    expect(summary).toBe("");
    expect(description).toBe(
      "Mate Camionero Cuero Crudo Alpaca Cincelada. "
      + "Características: Tipo de mate: Camionero; Material del mate: Cuero; Tipo de virola: Alpaca cincelada. "
      + "Colores: Negro, Marrón.",
    );
  });

  it("no menciona el lugar de origen", () => {
    expect(buildProductDescription(mate, "es").description).not.toContain("Paysandú");
    expect(buildProductDescription(mate, "en").description).not.toContain("Paysandú");
  });

  it("omite los ejes de variante (todos) y no repite el tipo de personalizado", () => {
    const { description } = buildProductDescription(mate, "es");
    expect(description).not.toContain("Tamaño");
    expect(description).not.toContain("Tipo personalizado");
  });

  it("indica que se elabora por encargo cuando corresponde", () => {
    expect(buildProductDescription({ ...mate, madeToOrder: true }, "es").description).toContain("Se elabora por encargo.");
  });

  it("lista primero lo que identifica al producto y traduce etiquetas y colores", () => {
    const { description } = buildProductDescription({
      ...mate,
      details: [
        detail("pie", "Pie", ["Común"]),
        detail("tipo-virola", "Tipo de virola", ["Alpaca"]),
        detail("tipo-mate", "Tipo de mate", ["Camionero"]),
      ],
      colors: ["Marrón"],
    }, "en");
    expect(description).toContain("Specifications: Mate style: Camionero; Rim type: Alpaca; Base: Standard.");
    expect(description).toContain("Colors: Brown.");
  });

  it("mantiene Premium en los valores generados", () => {
    const { description } = buildProductDescription({
      ...mate,
      details: [detail("tipo-virola", "Tipo de virola", ["Alpaca grande cincelada Premium"])],
    }, "es");
    expect(description).toContain("Tipo de virola: Alpaca grande cincelada Premium.");
  });

  it("los artículos de reventa no figuran como producción propia en los datos estructurados", () => {
    expect(isMadeByMateArte("termos")).toBe(false);
    expect(isMadeByMateArte("mates")).toBe(true);
  });
});

describe("meta description", () => {
  it("deja intacto un texto corto y recorta sin cortar palabras", () => {
    expect(truncateForMeta("Texto corto.")).toBe("Texto corto.");
    const long = truncateForMeta("Mate Camionero. Hecho a mano. " + "Característica: valor; ".repeat(20));
    expect(long.length).toBeLessThanOrEqual(155);
    expect(long).not.toMatch(/\s$/);
  });
});
