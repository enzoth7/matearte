import { existsSync, globSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { mateAssetCatalog } from "./mateAssetCatalog";
import {
  engravingTechniqueAssetManifest,
  flejeEngravingTechniqueAssetManifest,
  torpedoVirolaEngravingTechniqueAssetManifest,
} from "./engravingTechniqueAssetManifest";
import { mateVariants } from "./mateCatalog";
import {
  EMPTY_MATE_SELECTION,
  engravingTypeOptions,
  getFirstIncompleteStage,
  getMateFamily,
  getSelectionFromLegacyVariant,
  mateDecisionCatalog,
  resolveMateSelection,
  sanitizeMateSelection,
  shouldReturnToIncompleteStage,
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
    expect(getFirstIncompleteStage({ ...selection, engravingTypeId: "bronze-applique" })).toBe("fleje-engraving");
    expect(getFirstIncompleteStage({ ...selection, engravingTypeId: "bronze-applique", flejeEngravingTypeId: "bronze-applique" })).toBeNull();
  });

  it("no avanza automáticamente del grabado de virola al grabado del fleje", () => {
    expect(shouldReturnToIncompleteStage("engraving", "fleje-engraving")).toBe(false);
    expect(shouldReturnToIncompleteStage("fleje-engraving", "engraving")).toBe(true);
  });

  it("muestra Virola/Metal solo en las ramas indicadas por los árboles Imperial y Criollo", () => {
    const imperial = getMateFamily("imperial")!;
    const criollo = getMateFamily("criollo")!;

    expect(imperial.textures.filter((item) => !item.skipMetalSelection).map((item) => item.id)).toEqual([
      "virola-plata-900",
    ]);
    expect(criollo.textures.filter((item) => !item.skipMetalSelection).map((item) => item.id)).toEqual([
      "torpedo-criollo-posa-mate",
      "imperial-criollo-posa-mate",
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
      textureId: "imperial-clasico",
      colorId: "animal-print",
      metalId: "alpaca-bronce",
      sizeId: "grande",
    });
    expect(sanitized).toEqual({
      familyId: "imperial",
      textureId: "imperial-clasico",
      colorId: null,
      metalId: null,
      sizeId: null,
      engravingTypeId: null,
      flejeEngravingTypeId: null,
    });
  });

  it("distingue las capacidades de los subtipos Criollo", () => {
    const imperialCriollo = resolveMateSelection({
      familyId: "criollo",
      textureId: "imperial-criollo-posa-mate",
      colorId: "cuero-crudo-criollo",
      metalId: "alpaca-grande-criollo",
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
      metalId: "alpaca-grande-criollo",
      sizeId: "chico",
    });
    expect(pending?.skuId).toBeNull();
    expect(pending?.status).toBe("pending");
  });

  it("no convierte un fallback visual pendiente en un SKU transaccional", () => {
    const pending = resolveMateSelection({
      familyId: "criollo",
      textureId: "imperial-criollo-posa-mate",
      colorId: "vaqueta",
      metalId: "alpaca-grande-criollo",
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
      expect(entry.src).toMatch(/^\/assets2\/mates\//);
      const physicalPath = join(process.cwd(), "public", entry.src.replace(/^\//, ""));
      expect(existsSync(physicalPath), `Falta archivo ${physicalPath}`).toBe(true);
    }
  });

  it("usa fotografías reales existentes para cada preview de color", () => {
    const previewImages = mateDecisionCatalog.flatMap((family) =>
      family.textures.flatMap((texture) => Object.values(texture.colorPreviewImages ?? {})),
    );

    expect(previewImages.length).toBeGreaterThan(0);
    for (const src of previewImages) {
      expect(src).toMatch(/^\/assets2\/mates\//);
      const physicalPath = join(process.cwd(), "public", src.replace(/^\//, ""));
      expect(existsSync(physicalPath), `Falta archivo ${physicalPath}`).toBe(true);
    }
  });

  it("usa las piezas reales de assets2 para cada preview de alpaca", () => {
    const metalPreviewImages = [...new Set(
      mateDecisionCatalog.flatMap((family) =>
        family.textures.flatMap((texture) =>
          texture.metals.flatMap((metal) => metal.previewImage ? [metal.previewImage] : []),
        ),
      ),
    )];

    expect(metalPreviewImages).toHaveLength(5);
    for (const src of metalPreviewImages) {
      expect(src).toMatch(/^\/assets2\/personalizacion\/alpaca\//);
      const physicalPath = join(process.cwd(), "public", src.replace(/^\//, ""));
      expect(existsSync(physicalPath), `Falta archivo ${physicalPath}`).toBe(true);
    }
  });

  it("no conserva referencias activas al catálogo ilustrado de mates", () => {
    const legacyRoot = ["/assets", "mates/"].join("/");
    const sourceFiles = globSync("src/**/*.{ts,tsx}", { cwd: process.cwd() })
      .filter((file) => !file.includes(".test."));
    const legacyReferences = sourceFiles.filter((file) =>
      readFileSync(join(process.cwd(), file), "utf8").includes(legacyRoot),
    );

    expect(legacyReferences).toEqual([]);
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

  it("usa las dos fotos propias para elegir el aplique del fleje", () => {
    expect(Object.keys(flejeEngravingTechniqueAssetManifest)).toEqual([
      "bronze-applique",
      "alpaca-applique",
    ]);

    for (const entry of Object.values(flejeEngravingTechniqueAssetManifest)) {
      expect(entry.src).toMatch(/^\/assets2\/personalizacion\/grabadofleje\//);
      expect(entry.usage).toBe("owned-product-reference");
      const option = engravingTypeOptions.find((item) => item.id === entry.id);
      expect(option?.flejeImage).toBe(entry.src);
      const physicalPath = join(process.cwd(), "public", entry.src.replace(/^\//, ""));
      expect(existsSync(physicalPath), `Falta archivo ${physicalPath}`).toBe(true);
    }
  });

  it("usa las dos fotos frontales propias para elegir el aplique de la virola Torpedo", () => {
    expect(Object.keys(torpedoVirolaEngravingTechniqueAssetManifest)).toEqual([
      "bronze-applique",
      "alpaca-applique",
    ]);

    for (const entry of Object.values(torpedoVirolaEngravingTechniqueAssetManifest)) {
      expect(entry.src).toMatch(/^\/assets2\/personalizacion\/grabadovirola-torpedo\//);
      expect(entry.usage).toBe("owned-product-reference");
      const option = engravingTypeOptions.find((item) => item.id === entry.id);
      expect(option?.torpedoImage).toBe(entry.src);
      const physicalPath = join(process.cwd(), "public", entry.src.replace(/^\//, ""));
      expect(existsSync(physicalPath), `Falta archivo ${physicalPath}`).toBe(true);
    }
  });
});
