import { statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { flejeFinishCatalog, getFlejeFinish } from "../../personalizador/src/catalog/flejeFinishCatalog";

describe("terminaciones del fleje en Gestión", () => {
  it.each([
    ["pattern-1", "Laurel"],
    ["frame-25", "Azteca"],
    ["frame-26", "Sol"],
    ["frame-27", "Abstracta"],
    ["frame-28", "Griego"],
    ["frame-29", "Floral"],
    ["frame-30", "Guarda Pampa"],
    ["1", "Rupestre"],
    ["2", "Pampa"],
    ["3", "Abstracto"],
    ["4", "Flores"],
    ["5", "Griego"],
  ])("encuentra la imagen de %s (%s)", (id, name) => {
    const finish = getFlejeFinish(id);
    expect(finish?.name).toBe(name);
    expect(finish?.src).toMatch(/^\/assets\/personalizacion\/fleje\/.*\.webp$/);
    expect(statSync(join(process.cwd(), "..", "personalizador", "public", finish!.src.slice(1))).size).toBeGreaterThan(1000);
  });

  it("ofrece solo los cinco diseños actuales para ventas nuevas", () => {
    expect(flejeFinishCatalog.map((finish) => [finish.id, finish.name])).toEqual([
      ["1", "Rupestre"],
      ["2", "Pampa"],
      ["3", "Abstracto"],
      ["4", "Flores"],
      ["5", "Griego"],
    ]);
  });
});
