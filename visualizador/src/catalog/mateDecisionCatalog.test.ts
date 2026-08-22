import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { mateAssetCatalog } from "./mateAssetCatalog";
import { engravingTechniqueAssetManifest } from "./engravingTechniqueAssetManifest";
import { mateVariants } from "./mateCatalog";
import {
  EMPTY_MATE_SELECTION,
  getFirstIncompleteStage,
  getMateFamily,
  getSelectionFromLegacyVariant,
  mateDecisionCatalog,
  resolveMateSelection,
  sanitizeMateSelection,
  shouldAskForMetal,
  type MateSelection,
} from "./mateDecisionCatalog";

describe("árbol declarativo de mates", () => {
  it("expone las cuatro familias solicitadas", () => {
    expect(mateDecisionCatalog.map((family) => family.id)).toEqual([
      "camionero",
      "imperial",
      "torpedo",
      "criollo",
    ]);
  });

  it("resuelve todas las combinaciones declaradas sin duplicar productId", () => {
    const productIds = new Set<string>();
    let combinations = 0;

    for (const family of mateDecisionCatalog) {
      for (const texture of family.textures) {
        for (const color of texture.colors) {
          for (const metal of texture.metals) {
            for (const sizeId of texture.sizes) {
              const selection: MateSelection = {
                familyId: family.id,
                textureId: texture.id,
                colorId: color.id,
                metalId: metal.id,
                sizeId,
                engravingTypeId: "laser",
                flejeEngravingTypeId: null,
              };
              const product = resolveMateSelection(selection);
              expect(product).not.toBeNull();
              expect(product?.shapeId).toBe(texture.shapeId);
              expect(product?.capabilities).toEqual(texture.capabilities);
              expect(productIds.has(product!.productId)).toBe(false);
              productIds.add(product!.productId);
              combinations += 1;
            }
          }
        }
      }
    }

    expect(productIds.size).toBe(combinations);
    expect(combinations).toBeGreaterThan(100);
  });

  it("mantiene explícitas las decisiones de una sola opción", () => {
    const onlyFamily: MateSelection = { ...EMPTY_MATE_SELECTION, familyId: "camionero" };
    expect(getFirstIncompleteStage(onlyFamily)).toBe("texture");

    const onlyTexture = sanitizeMateSelection({ ...onlyFamily, textureId: "alpaca-cincelado-patas" });
    expect(onlyTexture.colorId).toBeNull();
    expect(onlyTexture.metalId).toBeNull();
    expect(getFirstIncompleteStage(onlyTexture)).toBe("texture");
  });

  it("considera pendiente el grabado después de completar el tamaño", () => {
    const selection = getSelectionFromLegacyVariant("imperial-lacre", "medio")!;
    expect(getFirstIncompleteStage(selection)).toBe("engraving");
    expect(getFirstIncompleteStage({ ...selection, engravingTypeId: "bronze-applique" })).toBeNull();
  });

  it("muestra Virola/Metal solo en las ramas indicadas por los árboles Imperial y Criollo", () => {
    const imperial = getMateFamily("imperial")!;
    const criollo = getMateFamily("criollo")!;

    expect(imperial.textures.filter((item) => !item.skipMetalSelection).map((item) => item.id)).toEqual([
      "virola-plata-900",
    ]);
    expect(criollo.textures.filter((item) => !item.skipMetalSelection).map((item) => item.id)).toEqual([
      "torpedo-criollo-posa-mate",
    ]);

    const imperialClasico = {
      familyId: "imperial" as const,
      textureId: "imperial-clasico",
      colorId: "natural",
      metalId: null,
      sizeId: null,
    };
    expect(shouldAskForMetal(imperialClasico)).toBe(false);
    expect(getFirstIncompleteStage(imperialClasico)).toBe("size");
    expect(sanitizeMateSelection(imperialClasico).metalId).toBe("original-imperial");
    expect(resolveMateSelection({ ...imperialClasico, sizeId: "medio" })?.metalId).toBe("original-imperial");

    const plata900 = {
      familyId: "imperial" as const,
      textureId: "virola-plata-900",
      colorId: "natural",
      metalId: null,
      sizeId: null,
    };
    expect(shouldAskForMetal(plata900)).toBe(true);
    expect(getFirstIncompleteStage(plata900)).toBe("metal");

    const torpedoCriollo = {
      familyId: "criollo" as const,
      textureId: "torpedo-criollo-posa-mate",
      colorId: "vaqueta",
      metalId: null,
      sizeId: null,
    };
    expect(shouldAskForMetal(torpedoCriollo)).toBe(true);
    expect(getFirstIncompleteStage(torpedoCriollo)).toBe("metal");
  });

  it("invalida respuestas posteriores que no pertenecen a la nueva rama", () => {
    const sanitized = sanitizeMateSelection({
      familyId: "imperial",
      textureId: "imperial-cuero-crudo",
      colorId: "animal-print",
      metalId: "alpaca-bronce",
      sizeId: "grande",
    });
    expect(sanitized).toEqual({
      familyId: "imperial",
      textureId: "imperial-cuero-crudo",
      colorId: null,
      metalId: null,
      sizeId: null,
      engravingTypeId: null,
    });
  });

  it("distingue las capacidades de los subtipos Criollo", () => {
    const imperialCriollo = resolveMateSelection({
      familyId: "criollo",
      textureId: "imperial-criollo-posa-mate",
      colorId: "cuero-crudo",
      metalId: "original-imperial",
      sizeId: "medio",
    });
    const camioneroCriollo = resolveMateSelection({
      familyId: "criollo",
      textureId: "camionero-criollo-posa-mate",
      colorId: "vaqueta",
      metalId: "original-camionero",
      sizeId: "medio",
    });

    expect(imperialCriollo?.shapeId).toBe("imperial");
    expect(imperialCriollo?.capabilities.hasFleje).toBe(true);
    expect(camioneroCriollo?.shapeId).toBe("camionero");
    expect(camioneroCriollo?.capabilities.hasFleje).toBe(false);
  });

  it("deja visibles como pendientes las ramas sin SKU confirmado", () => {
    const pending = resolveMateSelection({
      familyId: "criollo",
      textureId: "imperial-criollo-posa-mate",
      colorId: "vaqueta",
      metalId: "original-imperial",
      sizeId: "chico",
    });
    expect(pending?.skuId).toBeNull();
    expect(pending?.status).toBe("pending");
  });

  it("no convierte un fallback visual pendiente en un SKU transaccional", () => {
    const pending = resolveMateSelection({
      familyId: "imperial",
      textureId: "imperial-criollo",
      colorId: "variante-pendiente",
      metalId: "original-imperial",
      sizeId: "medio",
    });

    expect(pending?.legacyVariantId).toBe("imperial-criollo-posa-cuero-crudo");
    expect(pending?.skuId).toBeNull();
    expect(pending?.status).toBe("pending");
  });
});

describe("compatibilidad y assets del catálogo", () => {
  it("migra únicamente variantes antiguas con equivalencia explícita", () => {
    expect(getSelectionFromLegacyVariant("imperial-lacre")?.familyId).toBe("imperial");
    expect(getSelectionFromLegacyVariant("torpedo-cuero-liso-alpaca-bronce")?.metalId).toBe("alpaca-bronce");
    expect(getSelectionFromLegacyVariant("camionero-liso")).toBeNull();
  });

  it("mantiene un manifiesto y un archivo físico para cada imagen heredada", () => {
    expect(Object.keys(mateAssetCatalog)).toHaveLength(mateVariants.length);
    for (const variant of mateVariants) {
      const entry = mateAssetCatalog[variant.id];
      expect(entry, `Falta manifiesto para ${variant.id}`).toBeDefined();
      expect(variant.image).toBe(entry.src);
      const physicalPath = join(process.cwd(), "public", entry.src.replace(/^\//, ""));
      expect(existsSync(physicalPath), `Falta archivo ${physicalPath}`).toBe(true);
    }
  });

  it("guarda localmente y documenta las dos imágenes temporales de grabado", () => {
    for (const entry of Object.values(engravingTechniqueAssetManifest)) {
      expect(entry.sourceUrl).toMatch(/^https:\/\//);
      expect(entry.merchant.length).toBeGreaterThan(0);
      expect(entry.usage).toBe("temporary-reference");
      const physicalPath = join(process.cwd(), "public", entry.src.replace(/^\//, ""));
      expect(existsSync(physicalPath), `Falta archivo ${physicalPath}`).toBe(true);
    }
  });
});
