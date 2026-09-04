import { describe, expect, it } from "vitest";
import {
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
});
