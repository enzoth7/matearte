import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { WholesaleProductEditor } from "./WholesaleScreens";
import type { WholesaleSnapshot } from "./wholesaleSource";

const snapshot: WholesaleSnapshot = {
  products: [{ id: "7", model: "Criollo", variant: "Natural", rim_type: "Acero", leather_type: "Liso", price_arg: 18810, price_uyu: 507.87 }],
  customers: [], lines: [], images: [], exchangeRate: 0.027,
  categories: [{ code: "mates", label_es: "Mates", active: true }],
};

describe("editor de productos mayoristas", () => {
  it("presenta cada fila mayorista como producto independiente", () => {
    const html = renderToStaticMarkup(<WholesaleProductEditor product={{ ...snapshot.products[0], category_code: "mates" }} snapshot={snapshot} onSaved={() => {}} onClose={() => {}} onNotice={() => {}} />);
    expect(html).toContain("Datos del producto");
    expect(html).toContain("Imágenes del producto");
    expect(html).toContain("Precio y disponibilidad");
    expect(html).toContain("Criollo · Natural");
    expect(html).toContain("Nombre / detalles del producto");
    expect(html).toContain("value=\"criollo\"");
    expect(html.indexOf("Datos del producto")).toBeLessThan(html.indexOf("Imágenes del producto"));
    expect(html.indexOf("Imágenes del producto")).toBeLessThan(html.indexOf("Precio y disponibilidad"));
    expect(html).toContain("Subir imágenes");
    expect(html).toContain("Precio ARS");
    expect(html).toContain("Equivalente UYU");
    expect(html).not.toContain("Agregar variante");
    expect(html).not.toContain("Publicar</button>");
  });
});
