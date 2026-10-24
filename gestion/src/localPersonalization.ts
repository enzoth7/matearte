import type { Product } from "./data";
import { catalogAttributeDetails, catalogPurchaseAxes, catalogValueLabel, defaultCatalogTaxonomy, normalizeCatalogValueMap } from "../../shared/catalog-taxonomy";

export type PersonalizationKind = "mate" | "matera" | "bombilla";
export type PersonalizationTechnique = "none" | "laser" | "bronze-applique" | "alpaca-applique";
export type PersonalizationContent = "text" | "logo" | "text-logo";

export type LocalPersonalizationDraft = {
  kind: PersonalizationKind;
  rimTechnique: PersonalizationTechnique;
  rimContent: PersonalizationContent;
  rimText: string;
  rimFinish: string;
  flejeTechnique: PersonalizationTechnique;
  flejeContent: PersonalizationContent;
  flejeFrontText: string;
  flejeBackText: string;
  flejeFinish: string;
  materaTechnique: Exclude<PersonalizationTechnique, "none">;
  materaContent: PersonalizationContent;
  materaPlacement: "front" | "lid" | "front-lid";
  materaText: string;
  bombillaTechnique: Exclude<PersonalizationTechnique, "none">;
  bombillaContent: PersonalizationContent;
  bombillaPlacement: string;
  bombillaText: string;
  instructions: string;
  selectedOptions: Record<string, string>;
  rimLogoFile: File | null;
  flejeLogoFile: File | null;
  materaLogoFile: File | null;
  bombillaLogoFile: File | null;
};

export type StoredPersonalizationAsset = {
  bucket_id: "order-assets";
  object_path: string;
  original_name: string;
  mime_type: string;
  byte_size: number;
};

const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es");
const hasText = (content: PersonalizationContent) => content === "text" || content === "text-logo";
const hasLogo = (content: PersonalizationContent) => content === "logo" || content === "text-logo";

export function personalizationKind(product: Product): PersonalizationKind | null {
  if (product.personalizationType) return product.personalizationType;
  const category = normalize(product.categoryCode || product.family || "");
  const name = normalize(product.name);
  const personalized = category.includes("personaliz") || name.includes("personaliz");
  if (!personalized) return null;
  if (category.includes("bombilla") || /\bbombill(?:a|on)\b/.test(name)) return "bombilla";
  if (category.includes("matera") || /\bmatera\b/.test(name)) return "matera";
  if (category.includes("mate") || /\bmate\b/.test(name)) return "mate";
  return null;
}

export function matePurchaseAxes(product: Product) {
  return catalogPurchaseAxes(defaultCatalogTaxonomy, product.categoryCode || "mates", normalizeCatalogValueMap(product.attributes), product.name)
    .filter(axis => axis.code === "tamano" || axis.code === "interior");
}

export function mateCharacteristicDetails(product: Product) {
  return catalogAttributeDetails(defaultCatalogTaxonomy, normalizeCatalogValueMap(product.attributes));
}

export function createPersonalizationDraft(kind: PersonalizationKind, product?: Product): LocalPersonalizationDraft {
  const selectedOptions: Record<string, string> = {};
  if (kind === "mate" && product) for (const axis of matePurchaseAxes(product)) {
    if (axis.values.length === 1) selectedOptions[axis.code] = axis.values[0].value;
  }
  return {
    kind,
    rimTechnique: "laser",
    rimContent: "text",
    rimText: "",
    rimFinish: "none",
    flejeTechnique: "none",
    flejeContent: "text",
    flejeFrontText: "",
    flejeBackText: "",
    flejeFinish: "none",
    materaTechnique: "laser",
    materaContent: "logo",
    materaPlacement: "front",
    materaText: "",
    bombillaTechnique: "laser",
    bombillaContent: "text",
    bombillaPlacement: "Cuerpo",
    bombillaText: "",
    instructions: "",
    selectedOptions,
    rimLogoFile: null,
    flejeLogoFile: null,
    materaLogoFile: null,
    bombillaLogoFile: null,
  };
}

export function productHasFleje(product: Product): boolean {
  if (normalizeCatalogValueMap(product.attributes)["diseno-fleje"]) return true;
  const value = normalize(`${product.name} ${product.variant} ${String(product.options?.modelo || "")}`);
  return value.includes("imperial") || value.includes("fleje");
}

export function validatePersonalization(draft: LocalPersonalizationDraft, product: Product): string {
  if (draft.kind === "bombilla") {
    if (hasText(draft.bombillaContent) && !draft.bombillaText.trim()) return `Ingresá el texto para ${product.name}.`;
    if (hasLogo(draft.bombillaContent) && !draft.bombillaLogoFile) return `Adjuntá el logo para ${product.name}.`;
    if (!draft.bombillaPlacement.trim()) return `Indicá dónde va el diseño en ${product.name}.`;
    return "";
  }
  if (draft.kind === "matera") {
    if (hasText(draft.materaContent) && !draft.materaText.trim()) return `Ingresá el texto para ${product.name}.`;
    if (hasLogo(draft.materaContent) && !draft.materaLogoFile) return `Adjuntá el logo para ${product.name}.`;
    return "";
  }

  for (const axis of matePurchaseAxes(product)) {
    if (!axis.values.length) return `Configurá ${axis.label.toLowerCase()} en el catálogo para ${product.name}.`;
    if (!axis.values.some(option => option.value === draft.selectedOptions[axis.code])) return `Elegí ${axis.label.toLowerCase()} para ${product.name}.`;
  }

  if (draft.rimTechnique === "none" && (!productHasFleje(product) || draft.flejeTechnique === "none")) {
    return `Elegí qué parte se personaliza en ${product.name}.`;
  }
  if (draft.rimTechnique !== "none") {
    if (hasText(draft.rimContent) && !draft.rimText.trim()) return `Ingresá el texto de la virola para ${product.name}.`;
    if (hasLogo(draft.rimContent) && !draft.rimLogoFile) return `Adjuntá el logo de la virola para ${product.name}.`;
  }
  if (productHasFleje(product) && draft.flejeTechnique !== "none") {
    if (hasText(draft.flejeContent) && !draft.flejeFrontText.trim() && !draft.flejeBackText.trim()) return `Ingresá el texto del fleje para ${product.name}.`;
    if (hasLogo(draft.flejeContent) && !draft.flejeLogoFile) return `Adjuntá el logo del fleje para ${product.name}.`;
  }
  return "";
}

const techniqueLabel = (technique: PersonalizationTechnique) => ({
  none: "Sin personalizar",
  laser: "Láser",
  "bronze-applique": "Aplique de bronce",
  "alpaca-applique": "Aplique de alpaca",
}[technique]);

const placementLabel = (placement: LocalPersonalizationDraft["materaPlacement"]) => ({
  front: "Frente",
  lid: "Tapa",
  "front-lid": "Frente y tapa",
}[placement]);

const contentLabel = (content: PersonalizationContent) => ({
  text: "Texto",
  logo: "Logo",
  "text-logo": "Texto y logo",
}[content]);

const customImage = (asset?: StoredPersonalizationAsset) => asset ? {
  id: asset.object_path,
  name: asset.original_name,
  mimeType: asset.mime_type,
  size: asset.byte_size,
  previewUrl: `storage:${asset.bucket_id}:${asset.object_path}`,
  originalUrl: `storage:${asset.bucket_id}:${asset.object_path}`,
  storageRef: `storage:${asset.bucket_id}:${asset.object_path}`,
  source: "upload",
} : null;

const icon = (asset?: StoredPersonalizationAsset, side: "rim" | "front" = "rim") => asset ? [{
  id: asset.object_path,
  selectedImageId: null,
  customImage: customImage(asset),
  transform: { x: 0.5, y: 0.5, scale: 1, rotation: 0, side },
}] : [];

const optionText = (product: Product, ...keys: string[]) => {
  for (const key of keys) {
    const value = product.options?.[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "No especificado";
};

export function buildLocalPersonalizationSnapshot(
  draft: LocalPersonalizationDraft,
  product: Product,
  stored: { rim?: StoredPersonalizationAsset; fleje?: StoredPersonalizationAsset; matera?: StoredPersonalizationAsset; bombilla?: StoredPersonalizationAsset } = {},
): Record<string, unknown> {
  const assets = [stored.rim, stored.fleje, stored.matera, stored.bombilla].filter((asset): asset is StoredPersonalizationAsset => Boolean(asset));
  if (draft.kind === "bombilla") {
    return {
      schemaVersion: 1,
      source: "local",
      assets,
      localPersonalization: {
        kind: "bombilla",
        technique: draft.bombillaTechnique,
        techniqueLabel: techniqueLabel(draft.bombillaTechnique),
        content: draft.bombillaContent,
        contentLabel: contentLabel(draft.bombillaContent),
        placement: draft.bombillaPlacement.trim(),
        placementLabel: draft.bombillaPlacement.trim(),
        text: hasText(draft.bombillaContent) ? draft.bombillaText.trim() : "",
        logoName: hasLogo(draft.bombillaContent) ? stored.bombilla?.original_name || "" : "",
        instructions: draft.instructions.trim(),
      },
      configuration: {
        selectionLabels: { family: product.name, color: product.variant, texture: product.leather, metal: product.rim, size: optionText(product, "tamaño", "tamano", "size") },
        capabilities: { hasFleje: false },
        rim: {},
      },
    };
  }
  if (draft.kind === "matera") {
    return {
      schemaVersion: 1,
      source: "local",
      assets,
      localPersonalization: {
        kind: "matera",
        technique: draft.materaTechnique,
        techniqueLabel: techniqueLabel(draft.materaTechnique),
        content: draft.materaContent,
        contentLabel: contentLabel(draft.materaContent),
        placement: draft.materaPlacement,
        placementLabel: placementLabel(draft.materaPlacement),
        text: hasText(draft.materaContent) ? draft.materaText.trim() : "",
        logoName: hasLogo(draft.materaContent) ? stored.matera?.original_name || "" : "",
        instructions: draft.instructions.trim(),
      },
      configuration: {
        selectionLabels: { family: product.name, color: product.variant, texture: product.leather, metal: product.rim, size: optionText(product, "tamaño", "tamano", "size") },
        capabilities: { hasFleje: false },
        rim: {},
      },
    };
  }

  const hasRimLogo = draft.rimTechnique !== "none" && hasLogo(draft.rimContent);
  const hasFlejeLogo = draft.flejeTechnique !== "none" && hasLogo(draft.flejeContent);
  const flejeAvailable = productHasFleje(product);
  const selectedOptions = Object.fromEntries(matePurchaseAxes(product).map(axis => [axis.code, draft.selectedOptions[axis.code]]));
  const attributes = normalizeCatalogValueMap(product.attributes);
  const detailLabels = Object.fromEntries(mateCharacteristicDetails(product).map(detail => [detail.code, detail.values.join(", ")]));
  const color = typeof product.options?.color === "string" ? catalogValueLabel(defaultCatalogTaxonomy, "color", product.options.color) : product.variant;
  return {
    schemaVersion: 1,
    source: "local",
    assets,
    localPersonalization: { kind: "mate", instructions: draft.instructions.trim(), selectedOptions },
    configuration: {
      selectedOptions,
      productAttributes: attributes,
      selectionLabels: {
        family: product.name,
        color,
        texture: detailLabels["tipo-cuero"] || detailLabels["material-mate"] || product.leather || "No especificada",
        metal: detailLabels["tipo-virola"] || product.rim || "No especificada",
        size: selectedOptions.tamano ? catalogValueLabel(defaultCatalogTaxonomy, "tamano", selectedOptions.tamano) : optionText(product, "tamaño", "tamano", "size"),
        interior: selectedOptions.interior ? catalogValueLabel(defaultCatalogTaxonomy, "interior", selectedOptions.interior) : detailLabels.interior || "No especificado",
        characteristics: detailLabels,
        engraving: techniqueLabel(draft.rimTechnique),
      },
      engravingTypeId: draft.rimTechnique === "none" ? null : draft.rimTechnique,
      flejeEngravingTypeId: draft.flejeTechnique === "none" ? null : draft.flejeTechnique,
      capabilities: { hasRim: true, hasFleje: flejeAvailable },
      rim: {
        rimId: String(attributes["tipo-virola"] || product.rim || ""),
        finishMode: draft.rimTechnique !== "none" && draft.rimFinish !== "none" ? "finish" : "none",
        finishId: draft.rimFinish === "none" ? "finish-1" : draft.rimFinish,
        textMode: draft.rimTechnique !== "none" && hasText(draft.rimContent) ? "text" : "none",
        text: draft.rimText.trim(),
        texts: draft.rimTechnique !== "none" && hasText(draft.rimContent) ? [{ id: "text-1", text: draft.rimText.trim() }] : [],
        imageMode: hasRimLogo ? "image" : "none",
        icons: hasRimLogo ? icon(stored.rim) : [],
      },
    },
    flejeConfiguration: {
      finishMode: flejeAvailable && draft.flejeTechnique !== "none" && draft.flejeFinish !== "none" ? "finish" : "none",
      finishId: draft.flejeFinish === "none" ? "pattern-1" : draft.flejeFinish,
      sides: {
        front: {
          textMode: flejeAvailable && draft.flejeTechnique !== "none" && hasText(draft.flejeContent) && draft.flejeFrontText.trim() ? "text" : "none",
          text: draft.flejeFrontText.trim(),
          imageMode: hasFlejeLogo ? "image" : "none",
          selectedImageId: null,
          customImage: hasFlejeLogo ? customImage(stored.fleje) : null,
          icons: hasFlejeLogo ? icon(stored.fleje, "front") : [],
        },
        back: {
          textMode: flejeAvailable && draft.flejeTechnique !== "none" && hasText(draft.flejeContent) && draft.flejeBackText.trim() ? "text" : "none",
          text: draft.flejeBackText.trim(),
          imageMode: "none",
          selectedImageId: null,
          customImage: null,
          icons: [],
        },
      },
    },
  };
}
