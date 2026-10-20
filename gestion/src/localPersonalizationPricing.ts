import type { LocalPersonalizationDraft } from "./localPersonalization";

export type PublishedLocalPricing = {
  versionId: string;
  version: number;
  rules: Record<string, number>;
};

export type LocalPriceItem = {
  ruleKey: string;
  label: string;
  quantity: number;
  unitPriceMinor: number;
  totalMinor: number;
};

export function parsePublishedLocalPricing(value: unknown): PublishedLocalPricing {
  if (!value || typeof value !== "object") throw new Error("No hay precios publicados para el Personalizador.");
  const data = value as Record<string, unknown>;
  if (typeof data.versionId !== "string" || !Number.isInteger(data.version) || !data.rules || typeof data.rules !== "object") {
    throw new Error("Los precios publicados del Personalizador están incompletos.");
  }
  return { versionId: data.versionId, version: data.version as number, rules: data.rules as Record<string, number> };
}

const characterCount = (value: string) => value.match(/[\p{L}\p{N}]/gu)?.length ?? 0;
const usesText = (content: LocalPersonalizationDraft["rimContent"]) => content === "text" || content === "text-logo";
const usesLogo = (content: LocalPersonalizationDraft["rimContent"]) => content === "logo" || content === "text-logo";

export function calculateLocalPersonalizationPrice(draft: LocalPersonalizationDraft, catalog: PublishedLocalPricing | null) {
  const items: LocalPriceItem[] = [];
  const missingRuleKeys: string[] = [];
  const add = (technique: string, part: "rim_text" | "rim_image" | "fleje_text" | "fleje_image", label: string, quantity: number) => {
    if (!quantity) return;
    const ruleKey = `customization:${technique}:${part}`;
    const value = catalog?.rules[ruleKey];
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
      missingRuleKeys.push(ruleKey);
      return;
    }
    const unitPriceMinor = Math.round(value * 100);
    items.push({ ruleKey, label, quantity, unitPriceMinor, totalMinor: unitPriceMinor * quantity });
  };

  if (draft.kind === "mate" && draft.rimTechnique !== "none") {
    if (usesText(draft.rimContent)) {
      const count = characterCount(draft.rimText);
      add(draft.rimTechnique, "rim_text", draft.rimTechnique === "laser" ? "Grabado de texto en virola" : "Letras en virola", draft.rimTechnique === "laser" && count ? 1 : count);
    }
    if (usesLogo(draft.rimContent) && draft.rimLogoFile) add(draft.rimTechnique, "rim_image", "Logo en virola", 1);
  }
  if (draft.kind === "mate" && draft.flejeTechnique !== "none") {
    if (usesText(draft.flejeContent)) add(draft.flejeTechnique, "fleje_text", "Caracteres en fleje", characterCount(draft.flejeFrontText) + characterCount(draft.flejeBackText));
    if (usesLogo(draft.flejeContent) && draft.flejeLogoFile) add(draft.flejeTechnique, "fleje_image", "Logo en fleje", 1);
  }
  if (draft.kind === "matera" || draft.kind === "bombilla") {
    // Las tres técnicas comparten las tarifas publicadas de texto e imagen de la virola.
    const matera = draft.kind === "matera";
    const technique = matera ? draft.materaTechnique : draft.bombillaTechnique;
    const content = matera ? draft.materaContent : draft.bombillaContent;
    const text = matera ? draft.materaText : draft.bombillaText;
    const logo = matera ? draft.materaLogoFile : draft.bombillaLogoFile;
    const applications = matera && draft.materaPlacement === "front-lid" ? 2 : 1;
    const article = matera ? "matera" : "bombilla";
    if (usesText(content)) {
      const count = characterCount(text);
      add(technique, "rim_text", `Texto en ${article}`, (technique === "laser" && count ? 1 : count) * applications);
    }
    if (usesLogo(content) && logo) add(technique, "rim_image", `Logo en ${article}`, applications);
  }
  return { items, extrasMinor: items.reduce((sum, item) => sum + item.totalMinor, 0), missingRuleKeys };
}
