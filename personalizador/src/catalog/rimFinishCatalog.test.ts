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
    expect(getRimFinish("petalos")).toMatchObject({ id: "petalos", name: "Pétalos", image: "/assets/personalizacion/virola/petalos.webp" });
  });

  it.each(["bronze-applique", "alpaca-applique"] as const)(
    "ofrece nueve terminaciones para %s",
    (engravingTypeId) => {
      const catalog = getRimFinishCatalogForEngravingType(engravingTypeId);

      expect(usesAppliqueRimFinishes(engravingTypeId)).toBe(true);
      expect(catalog).toBe(appliqueRimFinishCatalog);
      expect(catalog).toHaveLength(9);
      expect(catalog.every((finish) => finish.textKnockoutScale === 0.25)).toBe(true);
      expect(catalog.map((finish) => finish.image)).toEqual([
        "/assets/personalizacion/viroladeapliques/apliques-01-espirales.webp",
        "/assets/personalizacion/viroladeapliques/apliques-02-triangulos.webp",
        "/assets/personalizacion/viroladeapliques/apliques-03-escamas.webp",
        "/assets/personalizacion/viroladeapliques/apliques-04-coronas.webp",
        "/assets/personalizacion/virola/laureles.webp",
        "/assets/personalizacion/virola/petalos.webp",
        "/assets/personalizacion/viroladeapliques/apliques-05-puntas-cinceladas.webp",
        "/assets/personalizacion/viroladeapliques/apliques-06-cadenas.webp",
        "/assets/personalizacion/viroladeapliques/apliques-07-coronas-2.webp",
      ]);
    },
  );

  it("resuelve las terminaciones nuevas para dibujarlas en la vista previa", () => {
    for (const finish of appliqueRimFinishCatalog) {
      expect(getRimFinish(finish.id)).toEqual(finish);
    }
  });
});
