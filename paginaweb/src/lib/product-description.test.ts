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

describe("descripción generada para productos sin texto", () => {
  it("arma la descripción solo con datos del producto", () => {
    const { summary, description } = buildProductDescription(mate, "es");

    expect(summary).toBe("Elaboración a mano en Paysandú, Uruguay.");
    expect(description).toBe(
      "Mate Camionero Cuero Crudo Alpaca Cincelada. Elaboración a mano en Paysandú, Uruguay. "
      + "Características: Tipo de mate: Camionero; Material del mate: Cuero; Tipo de virola: Alpaca cincelada. "
      + "Colores: Negro, Marrón.",
    );
  });

  it("omite los ejes de variante (todos) y no repite el tipo de personalizado", () => {
    const { description } = buildProductDescription(mate, "es");
    expect(description).not.toContain("Tamaño");
    expect(description).not.toContain("Tipo personalizado");
  });

  it("indica que se elabora por encargo cuando corresponde", () => {
    expect(buildProductDescription({ ...mate, madeToOrder: true }, "es").description).toContain("Se elabora por encargo.");
    expect(buildProductDescription({ ...mate, madeToOrder: true }, "en").summary).toBe("Handmade in Paysandú, Uruguay. Made to order.");
  });

  it("traduce etiquetas conocidas en inglés y portugués", () => {
    expect(buildProductDescription(mate, "en").description).toContain("Specifications: Mate style: Camionero; Mate material: Leather; Rim type: Alpaca cincelada.");
    expect(buildProductDescription(mate, "pt").description).toContain("Tipo de virola: Alpaca cincelada");
  });

  it("no afirma producción propia en artículos de reventa", () => {
    const termo = buildProductDescription({ name: "Termo Stanley", category: "termos", details: [], colors: [], madeToOrder: false }, "es");
    expect(termo.summary).toBe("Termo para mate.");
    expect(termo.description).not.toContain("Paysandú");
    expect(isMadeByMateArte("termos")).toBe(false);
    expect(isMadeByMateArte("mates")).toBe(true);
  });

  it("no incluye calificativos comerciales en los valores generados", () => {
    const { description } = buildProductDescription({
      ...mate,
      details: [detail("tipo-virola", "Tipo de virola", ["Alpaca grande cincelada Premium"])],
    }, "es");
    expect(description).toContain("Tipo de virola: Alpaca grande cincelada.");
    expect(description.toLowerCase()).not.toContain("premium");
  });

  it("lista primero lo que identifica al producto y traduce colores", () => {
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

  it("sin características igual describe el origen", () => {
    const { description } = buildProductDescription({ name: "Yerbero de Cuero", category: "yerberos", details: [], colors: [], madeToOrder: false }, "es");
    expect(description).toBe("Yerbero de Cuero. Elaboración a mano en Paysandú, Uruguay.");
  });
});

describe("meta description", () => {
  it("deja intacto un texto corto y recorta sin cortar palabras", () => {
    expect(truncateForMeta("Texto corto.")).toBe("Texto corto.");
    const long = truncateForMeta("Mate Camionero. Elaboración a mano en Paysandú, Uruguay. " + "Característica: valor; ".repeat(20));
    expect(long.length).toBeLessThanOrEqual(155);
    expect(long).not.toMatch(/\s$/);
  });
});
