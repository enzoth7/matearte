import { describe, expect, it } from "vitest";
import { canonicalPathname, localizeCanonicalPath, localizeCurrentPathname } from "./paths";

describe("rutas localizadas", () => {
  it("conserva slugs e identificadores dinámicos", () => {
    expect(localizeCurrentPathname("/producto/mate-imperial", "es", "en")).toBe("/en/product/mate-imperial");
    expect(localizeCurrentPathname("/en/orders/abc-123", "en", "pt")).toBe("/pt/pedidos/abc-123");
  });

  it("resuelve páginas con segmentos traducidos", () => {
    expect(localizeCanonicalPath("/catalogo", "en")).toBe("/en/catalog");
    expect(localizeCanonicalPath("/compras/politica-de-privacidad", "pt")).toBe("/pt/compras/politica-de-privacidade");
    expect(canonicalPathname("/en/purchases/purchase-terms", "en")).toBe("/compras/condiciones-de-compra");
  });
});
