import { describe, expect, it } from "vitest";
import {
  appliqueRimFinishCatalog,
  getRimFinish,
  getRimFinishCatalogForEngravingType,
  rimFinishCatalog,
  usesAppliqueRimFinishes,
} from "./rimFinishCatalog";

describe("catálogo de terminaciones para la virola", () => {
  it("mantiene las terminaciones generales para grabado láser", () => {
    expect(getRimFinishCatalogForEngravingType("laser")).toBe(rimFinishCatalog);
    expect(usesAppliqueRimFinishes("laser")).toBe(false);
  });

  it.each(["bronze-applique", "alpaca-applique"] as const)(
    "reemplaza las terminaciones de %s por las cuatro de viroladeapliques",
    (engravingTypeId) => {
      const catalog = getRimFinishCatalogForEngravingType(engravingTypeId);

      expect(usesAppliqueRimFinishes(engravingTypeId)).toBe(true);
      expect(catalog).toBe(appliqueRimFinishCatalog);
      expect(catalog).toHaveLength(4);
      expect(catalog.every((finish) => finish.textKnockoutScale === 0.25)).toBe(true);
      expect(catalog.map((finish) => finish.image)).toEqual([
        "/assets2/personalizacion/viroladeapliques/apliques-01-espirales.webp",
        "/assets2/personalizacion/viroladeapliques/apliques-02-triangulos.webp",
        "/assets2/personalizacion/viroladeapliques/apliques-03-escamas.webp",
        "/assets2/personalizacion/viroladeapliques/apliques-04-coronas.webp",
      ]);
    },
  );

  it("resuelve las terminaciones nuevas para dibujarlas en la vista previa", () => {
    for (const finish of appliqueRimFinishCatalog) {
      expect(getRimFinish(finish.id)).toEqual(finish);
    }
  });
});
