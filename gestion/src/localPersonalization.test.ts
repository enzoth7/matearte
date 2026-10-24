import { describe, expect, it } from "vitest";
import type { Product } from "./data";
import { buildLocalPersonalizationSnapshot, createPersonalizationDraft, matePurchaseAxes, personalizationKind, productHasFleje, validatePersonalization } from "./localPersonalization";

const product = (changes: Partial<Product> = {}): Product => ({
  id: "variant", name: "Mate Imperial Personalizado", sku: "P-1", categoryCode: "mates-personalizados", family: "Mates personalizados",
  variant: "Marrón", options: { tamaño: "Grande" }, rim: "Alpaca", leather: "Liso", cost: 0,
  prices: { Local: 1000, Web: 1000, Mayorista: 0 }, stock: 0, min: 0, published: false, active: true, availableChannels: ["Local"], ...changes,
});

describe("personalización de ventas locales", () => {
  it("conserva el ícono y la ubicación del diseño sin exigir un archivo adicional", () => {
    const draft = createPersonalizationDraft("mate");
    draft.rimContent = "logo";
    draft.rimIconId = "corazon";
    draft.designTransforms = { "rim-icon": { x: .6, y: .2, scale: .8, rotation: 25, side: "rim" } };
    expect(validatePersonalization(draft, product())).toBe("");
    const snapshot = buildLocalPersonalizationSnapshot(draft, product()) as any;
    expect(snapshot.configuration.rim.icons[0]).toMatchObject({ selectedImageId: "corazon", transform: draft.designTransforms["rim-icon"] });
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
    draft.flejeTechnique = "bronze-applique";
    draft.flejeContent = "text";
    draft.flejeFrontText = "MATE";
    const snapshot = buildLocalPersonalizationSnapshot(draft, product()) as any;
    expect(snapshot.configuration.selectionLabels.family).toBe("Mate Imperial Personalizado");
    expect(snapshot.configuration.rim.texts[0].text).toBe("ENZO");
    expect(snapshot.flejeConfiguration.sides.front.text).toBe("MATE");
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
  });
});
