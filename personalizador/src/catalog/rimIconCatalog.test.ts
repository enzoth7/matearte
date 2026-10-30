import { describe, expect, it } from "vitest";
import {
  applyUploadedRimIcons,
  featuredRimIconIds,
  orderedRimIconCatalog,
  rimIconCatalog,
} from "./rimIconCatalog";

describe("catálogo de íconos del personalizador", () => {
  it("muestra primero escudo, bandera y sol de Uruguay", () => {
    expect(orderedRimIconCatalog.slice(0, 3).map((icon) => icon.id)).toEqual(featuredRimIconIds);
  });

  it("mantiene todos los íconos disponibles sin repetirlos", () => {
    expect(orderedRimIconCatalog).toHaveLength(rimIconCatalog.length);
    expect(new Set(orderedRimIconCatalog.map((icon) => icon.id)).size).toBe(rimIconCatalog.length);
  });

  it("agrega los íconos publicados a ambos catálogos y conserva los ocultos para diseños anteriores", () => {
    const initialCount = rimIconCatalog.length;
    const id = "icon-00000000-0000-4000-8000-000000000001";
    const hiddenId = "icon-00000000-0000-4000-8000-000000000002";
    applyUploadedRimIcons([
      { id, name: "Flor", src: "https://example.com/flor.webp", is_active: true },
      { id: hiddenId, name: "Anterior", src: "https://example.com/anterior.png", is_active: false },
    ]);
    expect(rimIconCatalog).toHaveLength(initialCount + 2);
    expect(orderedRimIconCatalog.some((icon) => icon.id === id)).toBe(true);
    expect(orderedRimIconCatalog.some((icon) => icon.id === hiddenId)).toBe(false);
    expect(rimIconCatalog.some((icon) => icon.id === hiddenId)).toBe(true);
    applyUploadedRimIcons([]);
  });

  it("oculta íconos incluidos para nuevas selecciones sin borrar diseños previos", () => {
    applyUploadedRimIcons([], ["auf"]);
    expect(orderedRimIconCatalog.some((icon) => icon.id === "auf")).toBe(false);
    expect(rimIconCatalog.some((icon) => icon.id === "auf")).toBe(true);
    applyUploadedRimIcons([]);
  });
});
