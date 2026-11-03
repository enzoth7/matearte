import { describe, expect, it } from "vitest";
import type { Product } from "./data";
import { buildLocalPersonalizationSnapshot, createPersonalizationDraft, invertLocalRimText, localDesignTransform, localRimLogos, matePurchaseAxes, personalizationKind, productHasFleje, validatePersonalization } from "./localPersonalization";

const product = (changes: Partial<Product> = {}): Product => ({
  id: "variant", name: "Mate Imperial Personalizado", sku: "P-1", categoryCode: "mates-personalizados", family: "Mates personalizados",
  variant: "Marrón", options: { tamaño: "Grande" }, rim: "Alpaca", leather: "Liso", cost: 0,
  prices: { Local: 1000, Web: 1000, Mayorista: 0 }, stock: 0, min: 0, published: false, active: true, availableChannels: ["Local"], ...changes,
});

describe("personalización de ventas locales", () => {
  it("conserva muchos logos independientes en virola y excluye los que se quitaron del diseño", () => {
    const draft = createPersonalizationDraft("mate");
    draft.rimContent = "logo";
    draft.rimLogos = Array.from({ length: 64 }, (_, index) => ({ id: `logo-${index}`, file: { name: "repetido.png" } as File, enabled: index !== 1 }));
    draft.designTransforms = { "logo-63": { x: .6, y: .2, scale: .8, rotation: 25, side: "rim" } };
    const rimLogos = draft.rimLogos.map(({ id }) => ({ id, asset: { bucket_id: "order-assets" as const, object_path: `${id}/logo.png`, original_name: "repetido.png", mime_type: "image/png", byte_size: 100 } }));
    const snapshot = buildLocalPersonalizationSnapshot(draft, product(), { rimLogos }) as any;
    expect(validatePersonalization(draft, product())).toBe("");
    expect(snapshot.configuration.rim.icons).toHaveLength(63);
    expect(snapshot.assets).toHaveLength(63);
    expect(new Set(snapshot.configuration.rim.icons.map((item: any) => item.customImage.storageRef)).size).toBe(63);
    expect(snapshot.configuration.rim.icons.find((item: any) => item.id === "logo-63").transform).toEqual(draft.designTransforms["logo-63"]);
    expect(localDesignTransform(draft, "logo-0", "rim")).not.toEqual(localDesignTransform(draft, "logo-2", "rim"));
    draft.rimLogos = draft.rimLogos.map(logo => ({ ...logo, enabled: false }));
    expect(validatePersonalization(draft, product())).toContain("logo de la virola");
    expect((buildLocalPersonalizationSnapshot(draft, product(), { rimLogos }) as any).configuration.rim.icons).toEqual([]);
  });
  it("recupera el logo único de borradores anteriores y conserva su transformación", () => {
    const draft = createPersonalizationDraft("mate");
    draft.rimLogoFile = { name: "anterior.png" } as File;
    draft.rimContent = "logo";
    draft.designTransforms = { "rim-upload": { x: .2, y: .4, scale: 1.3, rotation: 40, side: "rim" } };
    expect(localRimLogos(draft)).toEqual([{ id: "rim-upload", file: draft.rimLogoFile, enabled: true }]);
    const snapshot = buildLocalPersonalizationSnapshot(draft, product(), { rim: { bucket_id: "order-assets", object_path: "anterior.png", original_name: "anterior.png", mime_type: "image/png", byte_size: 100 } }) as any;
    expect(snapshot.configuration.rim.icons[0]).toMatchObject({ id: "rim-upload", transform: draft.designTransforms["rim-upload"] });
  });
  it("conserva el ícono y la ubicación del diseño sin exigir un archivo adicional", () => {
    const draft = createPersonalizationDraft("mate");
    draft.rimContent = "logo";
    draft.rimIconId = "corazon";
    draft.designTransforms = { "rim-icon": { x: .6, y: .2, scale: .8, rotation: 25, side: "rim" } };
    expect(validatePersonalization(draft, product())).toBe("");
    const snapshot = buildLocalPersonalizationSnapshot(draft, product()) as any;
    expect(snapshot.configuration.rim.icons[0]).toMatchObject({ selectedImageId: "corazon", transform: draft.designTransforms["rim-icon"] });
  });
  it("guarda los íconos del fleje en el lado elegido y conserva los anteriores en el frente", () => {
    const draft = createPersonalizationDraft("mate");
    draft.rimText = "MATE";
    draft.flejeTechnique = "bronze-applique";
    draft.flejeContent = "logo";
    draft.flejeIcons = [
      { id: "legacy-front", selectedImageId: "sol" },
      { id: "back-one", selectedImageId: "corazon", side: "back" },
      { id: "back-two", selectedImageId: "escudo", side: "back" },
    ];
    draft.designTransforms = { "back-one": { x: .7, y: .3, scale: 1.2, rotation: 15, side: "back" } };
    expect(validatePersonalization(draft, product())).toBe("");
    const snapshot = buildLocalPersonalizationSnapshot(draft, product()) as any;
    expect(snapshot.flejeConfiguration.sides.front.icons.map((item: any) => item.id)).toEqual(["legacy-front"]);
    expect(snapshot.flejeConfiguration.sides.back.imageMode).toBe("image");
    expect(snapshot.flejeConfiguration.sides.back.icons.map((item: any) => item.id)).toEqual(["back-one", "back-two"]);
    expect(snapshot.flejeConfiguration.sides.back.icons[0].transform).toEqual(draft.designTransforms["back-one"]);
    expect(localDesignTransform(draft, "back-two", "back").x).toBe(.4);
  });
  it("conserva el logo subido en el lado elegido sin duplicarlo y respeta su ubicación", () => {
    const draft = createPersonalizationDraft("mate");
    draft.flejeTechnique = "bronze-applique";
    draft.flejeContent = "logo";
    const asset = { bucket_id: "order-assets" as const, object_path: "test/logo.png", original_name: "logo.png", mime_type: "image/png", byte_size: 100 };
    for (const side of ["front", "back", "front"] as const) {
      draft.designTransforms = { "fleje-upload": { x: .3, y: .6, scale: 1.2, rotation: 15, side } };
      const snapshot = buildLocalPersonalizationSnapshot(draft, product(), { fleje: asset }) as any;
      const sides = snapshot.flejeConfiguration.sides;
      expect(sides[side].imageMode).toBe("image");
      expect(sides[side].customImage.name).toBe("logo.png");
      expect(sides[side].icons).toHaveLength(1);
      expect(sides[side].icons[0].transform).toEqual(draft.designTransforms["fleje-upload"]);
      expect(sides[side === "front" ? "back" : "front"]).toMatchObject({ imageMode: "none", customImage: null, icons: [] });
    }
    delete draft.designTransforms;
    const legacy = buildLocalPersonalizationSnapshot(draft, product(), { fleje: asset }) as any;
    expect(legacy.flejeConfiguration.sides.front.icons).toHaveLength(1);
    expect(legacy.flejeConfiguration.sides.back.icons).toEqual([]);
  });
  it("permite usar el logo temporal en ambos lados y quitarlo sin perder los íconos del catálogo", () => {
    const draft = createPersonalizationDraft("mate");
    draft.rimText = "ENZO";
    draft.flejeTechnique = "bronze-applique";
    draft.flejeContent = "logo";
    draft.flejeLogoFile = {} as File;
    const asset = { bucket_id: "order-assets" as const, object_path: "logo.png", original_name: "logo.png", mime_type: "image/png", byte_size: 100 };
    draft.flejeLogoSides = [];
    expect(validatePersonalization(draft, product())).toContain("Agregá un ícono");
    draft.designTransforms = {
      "fleje-upload-front": { x: .2, y: .3, scale: .8, rotation: 10, side: "front" },
      "fleje-upload-back": { x: .7, y: .6, scale: 1.3, rotation: 30, side: "back" },
    };
    for (const placements of [["front", "back"], ["back"], []] as ("front" | "back")[][]) {
      draft.flejeLogoSides = placements;
      draft.flejeIcons = [{ id: "sol", selectedImageId: "sol", side: "front" }];
      expect(validatePersonalization(draft, product())).toBe("");
      const snapshot = buildLocalPersonalizationSnapshot(draft, product(), { fleje: asset }) as any;
      for (const side of ["front", "back"] as const) {
        const uploads = snapshot.flejeConfiguration.sides[side].icons.filter((item: any) => item.customImage);
        expect(uploads).toHaveLength(Number(placements.includes(side)));
        if (uploads.length) expect(uploads[0].transform).toEqual(draft.designTransforms[`fleje-upload-${side}`]);
      }
      expect(snapshot.flejeConfiguration.sides.front.icons.some((item: any) => item.id === "sol")).toBe(true);
    }
  });
  it("distingue mates, materas y bombillas personalizadas", () => {
    expect(personalizationKind(product())).toBe("mate");
    expect(personalizationKind(product({ name: "Matera personalizada", categoryCode: "materas-personalizadas" }))).toBe("matera");
    expect(personalizationKind(product({ name: "Mate Imperial", categoryCode: "mates" }))).toBeNull();
    expect(personalizationKind(product({ name: "Diseño único", categoryCode: "personalizados", personalizationType: "matera" }))).toBe("matera");
    expect(personalizationKind(product({ name: "Bombilla personalizada", categoryCode: "personalizados" }))).toBe("bombilla");
    expect(productHasFleje(product())).toBe(true);
  });

  it("exige texto o logo según la selección", () => {
    const mate = createPersonalizationDraft("mate");
    expect(validatePersonalization(mate, product())).toContain("texto de la virola");
    mate.rimText = "MATEARTE";
    expect(validatePersonalization(mate, product())).toBe("");
    const matera = createPersonalizationDraft("matera");
    expect(validatePersonalization(matera, product({ name: "Matera personalizada" }))).toContain("logo");
  });

  it("genera una instantánea compatible con Producción", () => {
    const draft = createPersonalizationDraft("mate");
    draft.rimText = "ENZO";
    draft.rimText2 = "MATEARTE";
    draft.rimTextInverted = true;
    draft.flejeTechnique = "bronze-applique";
    draft.flejeContent = "text";
    draft.flejeFrontText = "MATE";
    const snapshot = buildLocalPersonalizationSnapshot(draft, product()) as any;
    expect(snapshot.configuration.selectionLabels.family).toBe("Mate Imperial Personalizado");
    expect(snapshot.configuration.rim.texts[0].text).toBe("ENZO");
    expect(snapshot.configuration.rim.texts).toMatchObject([
      { id: "text-1", text: "ENZO", inverted: true },
      { id: "text-2", text: "MATEARTE", inverted: true },
    ]);
    expect(snapshot.flejeConfiguration.sides.front.text).toBe("MATE");
  });

  it("permite usar solo el segundo texto de la virola", () => {
    const draft = createPersonalizationDraft("mate");
    draft.rimText2 = "ABAJO";
    expect(validatePersonalization(draft, product())).toBe("");
    const snapshot = buildLocalPersonalizationSnapshot(draft, product()) as any;
    expect(snapshot.configuration.rim.texts[1]).toMatchObject({ text: "ABAJO", inverted: true });
  });

  it("al invertir un texto mueve el otro al lado opuesto", () => {
    const draft = createPersonalizationDraft("mate");
    draft.rimText = "ARRIBA";
    draft.rimText2 = "ABAJO";
    expect(invertLocalRimText(draft, "text-1")).toEqual({ rimTextInverted: true, rimText2Inverted: false });
    expect(invertLocalRimText({ ...draft, rimText2: "" }, "text-1")).toEqual({ rimTextInverted: true, rimText2Inverted: true });
  });

  it("exige tamaño e interior cuando el mate base ofrece todos y los conserva en el pedido", () => {
    const mate = product({ categoryCode: "mates", attributes: { "tipo-mate": "imperial", "tipo-cuero": "vaqueta", "tipo-virola": "alpaca", tamano: "todos", interior: "todos" }, options: { color: "marron" } });
    const draft = createPersonalizationDraft("mate", mate);
    draft.rimText = "ENZO";
    expect(matePurchaseAxes(mate).map(axis => axis.code)).toEqual(expect.arrayContaining(["interior", "tamano"]));
    expect(validatePersonalization(draft, mate)).toMatch(/tamaño|interior/i);
    draft.selectedOptions = { tamano: "grande", interior: "ceramica" };
    expect(validatePersonalization(draft, mate)).toBe("");
    const snapshot = buildLocalPersonalizationSnapshot(draft, mate) as any;
    expect(snapshot.configuration.selectedOptions).toEqual({ interior: "ceramica", tamano: "grande" });
    expect(snapshot.configuration.selectionLabels).toMatchObject({ size: "Grande", interior: "Cerámica", color: "Marrón" });
  });

  it("valida y guarda el diseño de una bombilla y las indicaciones para taller", () => {
    const draft = createPersonalizationDraft("bombilla");
    const bombilla = product({ name: "Bombilla de alpaca", categoryCode: "bombillas" });
    expect(validatePersonalization(draft, bombilla)).toContain("texto");
    draft.bombillaText = "ENZO";
    draft.instructions = "Letra cursiva de 8 mm";
    expect(validatePersonalization(draft, bombilla)).toBe("");
    const snapshot = buildLocalPersonalizationSnapshot(draft, bombilla) as any;
    expect(snapshot.localPersonalization).toMatchObject({ kind: "bombilla", text: "ENZO", placement: "Cuerpo", instructions: "Letra cursiva de 8 mm" });
    expect(snapshot.configuration).not.toHaveProperty("rim");
  });
});
