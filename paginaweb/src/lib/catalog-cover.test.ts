import { describe, expect, it } from "vitest";
import { catalogCoverStyle } from "@/lib/catalog-cover";

describe("catalogCoverStyle", () => {
  it("aplica el encuadre guardado por Commerce Admin", () => {
    expect(catalogCoverStyle({ cover_x: 8.5, cover_y: -12, cover_zoom: 1.4 })).toEqual({
      objectPosition: "41.5% 62%",
      transform: "scale(1.4)",
    });
  });

  it("limita valores inválidos para evitar portadas rotas", () => {
    expect(catalogCoverStyle({ cover_x: 90, cover_y: -90, cover_zoom: 9 })).toEqual({
      objectPosition: "10% 90%",
      transform: "scale(2.5)",
    });
  });

  it("no agrega estilos cuando la imagen no tiene un recorte", () => {
    expect(catalogCoverStyle({ color: "marron" })).toBeUndefined();
  });
});
