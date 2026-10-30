import type { ElementTransform } from "../../personalizador/src/types/personalizer";
import type { Product } from "./data";
import { assemblyFieldsFor, assemblyLabels, assemblyHasFleje, validateMateAssembly } from "../../shared/mate-assembly";
import { catalogAttributeDetails, catalogPurchaseAxes, catalogValueLabel, defaultCatalogTaxonomy, normalizeCatalogValueMap } from "../../shared/catalog-taxonomy";

export type PersonalizationKind = "mate" | "matera" | "bombilla";
export type PersonalizationTechnique = "none" | "laser" | "bronze-applique" | "alpaca-applique";
export type PersonalizationContent = "text" | "logo" | "text-logo";

export type LocalPersonalizationDraft = {
  kind: PersonalizationKind;
  rimIconId?: string;
  flejeIconId?: string;
  rimIcons?: { id: string; selectedImageId: string }[];
  flejeIcons?: { id: string; selectedImageId: string }[];
  designTransforms?: Record<string, ElementTransform>;
  rimTechnique: PersonalizationTechnique;
  rimContent: PersonalizationContent;
  rimText: string;
  rimText2: string;
  rimTextInverted: boolean;
  rimText2Inverted: boolean;
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

export function localDesignIcons(draft: LocalPersonalizationDraft, part: "rim" | "fleje") {
  const legacy = part === "rim" ? draft.rimIconId : draft.flejeIconId;
  return (part === "rim" ? draft.rimIcons : draft.flejeIcons) ?? (legacy ? [{ id: `${part}-icon`, selectedImageId: legacy }] : []);
}

export function localDesignTransform(draft: LocalPersonalizationDraft, key: string, side: "rim" | "front" | "back"): ElementTransform {
  const iconIndex = localDesignIcons(draft, side === "rim" ? "rim" : "fleje").findIndex(icon => icon.id === key);
  if (iconIndex >= 0 && !draft.designTransforms?.[key]) {
    const angle = Math.PI / 2 + iconIndex * Math.PI / 4;
    return { x: side === "rim" ? .5 + .35 * Math.cos(angle) : .2 + (iconIndex % 4) * .2, y: side === "rim" ? .5 + .35 * Math.sin(angle) : .5, scale: 1, rotation: 0, side };
  }
  const position = key === "rim-icon" ? { x: .5, y: .85 } : key === "rim-upload" ? { x: .85, y: .5 } : key === "fleje-icon" ? { x: .8, y: .5 } : key === "fleje-upload" ? { x: .2, y: .5 } : { x: .5, y: .5 };
  return draft.designTransforms?.[key] || { ...position, scale: 1, rotation: 0, side };
}

export function invertLocalRimText(draft: LocalPersonalizationDraft, id: string): Pick<LocalPersonalizationDraft, "rimTextInverted" | "rimText2Inverted"> {
  if (id === "text-2") {
    const rimText2Inverted = !draft.rimText2Inverted;
    return { rimText2Inverted, rimTextInverted: draft.rimText.trim() && draft.rimTextInverted === rimText2Inverted ? !rimText2Inverted : draft.rimTextInverted };
  }
  const rimTextInverted = !draft.rimTextInverted;
  return { rimTextInverted, rimText2Inverted: draft.rimText2.trim() && draft.rimText2Inverted === rimTextInverted ? !rimTextInverted : draft.rimText2Inverted };
}

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
  if (product.assembly) return assemblyFieldsFor(product.assembly).filter(f => f.code === "tamano" || f.code === "interior").map(f => ({ code: f.code, label: f.label, values: f.options.map(o => ({ value: o.value, label: o.label })) }));
  return catalogPurchaseAxes(defaultCatalogTaxonomy, product.categoryCode || "mates", normalizeCatalogValueMap(product.attributes), product.name)
    .filter(axis => axis.code === "tamano" || axis.code === "interior");
}

export function mateCharacteristicDetails(product: Product) {
  if (product.assembly) return assemblyFieldsFor(product.assembly).map(f => ({ code: f.code, label: f.label, values: [assemblyLabels(product.assembly!)[f.code]], rawValue: product.assembly![f.code] }));
  return catalogAttributeDetails(defaultCatalogTaxonomy, normalizeCatalogValueMap(product.attributes));
}

export function createPersonalizationDraft(kind: PersonalizationKind, product?: Product): LocalPersonalizationDraft {
  const selectedOptions: Record<string, string> = {};
  if (kind === "mate" && product) for (const axis of matePurchaseAxes(product)) {
    if (axis.values.length === 1) selectedOptions[axis.code] = axis.values[0].value;
  }
  if (product?.assembly) Object.assign(selectedOptions, { tamano: product.assembly.tamano, interior: product.assembly.interior });
  return {
    kind,
    rimTechnique: product?.assembly?.["tipo-virola"] === "sin-virola" ? "none" : "laser",
    rimContent: "text",
    rimText: "",
    rimText2: "",
    rimTextInverted: false,
    rimText2Inverted: true,
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
  if (product.assembly) return assemblyHasFleje(product.assembly);
  if (normalizeCatalogValueMap(product.attributes)["diseno-fleje"]) return true;
  const value = normalize(`${product.name} ${product.variant} ${String(product.options?.modelo || "")}`);
  return value.includes("imperial") || value.includes("fleje");
}

export function validatePersonalization(draft: LocalPersonalizationDraft, product: Product): string {
  if (product.assembly && validateMateAssembly(product.assembly)) return `Elegí ${validateMateAssembly(product.assembly)} para completar el armado.`;
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

  if (!product.assembly && draft.rimTechnique === "none" && (!productHasFleje(product) || draft.flejeTechnique === "none")) {
    return `Elegí qué parte se personaliza en ${product.name}.`;
  }
  if (draft.rimTechnique !== "none") {
    if (hasText(draft.rimContent) && !draft.rimText.trim() && !draft.rimText2.trim()) return `Ingresá el texto de la virola para ${product.name}.`;
    if (hasLogo(draft.rimContent) && !draft.rimLogoFile && !localDesignIcons(draft, "rim").length) return `Adjuntá el logo de la virola para ${product.name}.`;
  }
  if (productHasFleje(product) && draft.flejeTechnique !== "none") {
    if (hasText(draft.flejeContent) && !draft.flejeFrontText.trim() && !draft.flejeBackText.trim()) return `Ingresá el texto del fleje para ${product.name}.`;
    if (hasLogo(draft.flejeContent) && !draft.flejeLogoFile && !localDesignIcons(draft, "fleje").length) return `Adjuntá el logo del fleje para ${product.name}.`;
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
  const transform = (key: string, side: "rim" | "front" | "back") => localDesignTransform(draft, key, side);
  const designIcons = (part: "rim" | "fleje", asset?: StoredPersonalizationAsset) => {
    const side = part === "rim" ? "rim" : "front";
    const selectedIcons = localDesignIcons(draft, part);
    return [...icon(asset, side).map(item => ({ ...item, id: `${part}-upload`, transform: transform(`${part}-upload`, side) })), ...selectedIcons.map(item => ({ ...item, customImage: null, transform: transform(item.id, side) }))];
  };
  return {
    schemaVersion: 1,
    source: "local",
    assets,
    localPersonalization: { kind: "mate", instructions: draft.instructions.trim(), selectedOptions },
    ...(product.assembly ? { assembly: { schemaVersion: 1, selections: product.assembly, labels: assemblyLabels(product.assembly) } } : {}),
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
      capabilities: { hasRim: product.assembly?.["tipo-virola"] !== "sin-virola", hasFleje: flejeAvailable },
      rim: {
        rimId: String(attributes["tipo-virola"] || product.rim || ""),
        finishMode: draft.rimTechnique !== "none" && draft.rimFinish !== "none" ? "finish" : "none",
        finishId: draft.rimFinish === "none" ? "finish-1" : draft.rimFinish,
        textMode: draft.rimTechnique !== "none" && hasText(draft.rimContent) ? "text" : "none",
        text: draft.rimText.trim() || draft.rimText2.trim(),
        texts: draft.rimTechnique !== "none" && hasText(draft.rimContent) ? [
          { id: "text-1", text: draft.rimText.trim(), inverted: draft.rimTextInverted, transform: transform("rim-text", "rim") },
          { id: "text-2", text: draft.rimText2.trim(), inverted: draft.rimText2Inverted, transform: transform("rim-text-2", "rim") },
        ] : [],
        imageMode: hasRimLogo ? "image" : "none",
        icons: hasRimLogo ? designIcons("rim", stored.rim) : [],
        textTransform: transform("rim-text", "rim"),
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
          icons: hasFlejeLogo ? designIcons("fleje", stored.fleje) : [],
          textTransform: transform("front-text", "front"),
        },
        back: {
          textMode: flejeAvailable && draft.flejeTechnique !== "none" && hasText(draft.flejeContent) && draft.flejeBackText.trim() ? "text" : "none",
          text: draft.flejeBackText.trim(),
          textTransform: transform("back-text", "back"),
          imageMode: "none",
          selectedImageId: null,
          customImage: null,
          icons: [],
        },
      },
    },
  };
}
