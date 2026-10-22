import { describe, expect, it } from "vitest";
import { matchesCatalogImage, matchesCatalogStatus } from "./catalogListFilters";

describe("filtros del catálogo", () => {
  it("separa activos de inactivos y no filtra con Todos", () => {
    expect(matchesCatalogStatus({ active: true }, "Activos")).toBe(true);
    expect(matchesCatalogStatus({ active: false }, "Activos")).toBe(false);
    expect(matchesCatalogStatus({}, "Inactivos")).toBe(true);
    expect(matchesCatalogStatus({ active: true }, "Inactivos")).toBe(false);
    expect(matchesCatalogStatus({ active: false }, "Todos")).toBe(true);
  });

  it("separa productos con imagen de productos sin imagen", () => {
    expect(matchesCatalogImage({ imageUrl: "https://x/foto.png" }, "Con imagen")).toBe(true);
    expect(matchesCatalogImage({ imageUrl: "" }, "Con imagen")).toBe(false);
    expect(matchesCatalogImage({}, "Sin imagen")).toBe(true);
    expect(matchesCatalogImage({ imageUrl: "https://x/foto.png" }, "Sin imagen")).toBe(false);
    expect(matchesCatalogImage({}, "Todas")).toBe(true);
  });
});
