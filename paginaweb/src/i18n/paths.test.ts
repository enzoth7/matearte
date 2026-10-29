import { describe, expect, it } from "vitest";
import { canonicalPathname, localizeCanonicalPath, localizeCurrentPathname } from "./paths";

describe("rutas localizadas", () => {
  it("conserva slugs e identificadores dinámicos", () => {
    expect(localizeCurrentPathname("/producto/mate-imperial", "es", "en")).toBe("/en/product/mate-imperial");
    expect(localizeCurrentPathname("/en/orders/abc-123", "en", "pt")).toBe("/pt/pedidos/abc-123");
    expect(localizeCanonicalPath("/transferencia/abc-123", "en")).toBe("/en/bank-transfer/abc-123");
    expect(localizeCurrentPathname("/en/bank-transfer/abc-123", "en", "es")).toBe("/transferencia/abc-123");
  });

  it("traduce las páginas de categoría sin confundirlas con el catálogo", () => {
    expect(localizeCurrentPathname("/catalogo/mates", "es", "en")).toBe("/en/catalog/mates");
    expect(localizeCurrentPathname("/en/catalog/bombillas", "en", "pt")).toBe("/pt/catalogo/bombillas");
    expect(localizeCurrentPathname("/pt/catalogo/termos", "pt", "es")).toBe("/catalogo/termos");
    expect(localizeCurrentPathname("/en/catalog", "en", "es")).toBe("/catalogo");
  });

  it("resuelve páginas con segmentos traducidos", () => {
    expect(localizeCanonicalPath("/catalogo", "en")).toBe("/en/catalog");
    expect(localizeCanonicalPath("/compras/politica-de-privacidad", "pt")).toBe("/pt/compras/politica-de-privacidade");
    expect(canonicalPathname("/en/purchases/purchase-terms", "en")).toBe("/compras/condiciones-de-compra");
  });
});
