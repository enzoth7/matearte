import type { MateVariant } from "./mateCatalog";
import type { RimFinishId } from "./rimFinishCatalog";
import {
  createDefaultElementTransform,
  normalizeElementTransform,
  type CustomImageAsset,
  type ElementTransform,
} from "../types/customizer";

export type RimMaterial = "original" | "acero" | "alpaca" | "alpaca-grande" | "alpaca-bronce" | "acero-bronce" | "plata-900";
export type RimFinishMode = "none" | "finish";
export type RimTextMode = "none" | "text";
export type RimImageMode = "none" | "image";

export interface RimOption {
  id: string;
  name: string;
  shortName: string;
  material: RimMaterial;
}

export interface RimCustomization {
  rimId: string;
  finishMode: RimFinishMode;
  finishId: RimFinishId;
  textMode: RimTextMode;
  text: string;
  imageMode: RimImageMode;
  selectedImageId: string | null;
  customImage: CustomImageAsset | null;
  textTransform: ElementTransform;
  imageTransform: ElementTransform;
}

export const MAX_RIM_TEXT_LENGTH = 40;

export const rimCatalog: RimOption[] = [
  { id: "original", name: "Original del producto", shortName: "Original", material: "original" },
  { id: "acero", name: "Virola de acero", shortName: "Acero", material: "acero" },
  { id: "alpaca", name: "Virola de alpaca", shortName: "Alpaca", material: "alpaca" },
  { id: "alpaca-grande", name: "Virola de alpaca grande", shortName: "Alpaca grande", material: "alpaca-grande" },
  { id: "alpaca-bronce", name: "Virola de alpaca y bronce", shortName: "Alpaca y bronce", material: "alpaca-bronce" },
  { id: "acero-bronce", name: "Virola de acero y bronce", shortName: "Acero y bronce", material: "acero-bronce" },
  { id: "plata-900", name: "Virola de plata 900", shortName: "Plata 900", material: "plata-900" },
];

export function getRimOption(rimId: string): RimOption | undefined {
  return rimCatalog.find((rim) => rim.id === rimId);
}

export function getCompatibleRims(variant: MateVariant): RimOption[] {
  return variant.compatibleRimIds.flatMap((rimId) => {
    const rim = getRimOption(rimId);
    return rim ? [rim] : [];
  });
}

export function createDefaultRimSelection(variant: MateVariant): RimCustomization {
  const compatibleRims = getCompatibleRims(variant);
  const rim = compatibleRims.find((item) => item.id === variant.defaultRimId) ?? compatibleRims[0];
  if (!rim) throw new Error(`La variante ${variant.id} no tiene virolas compatibles válidas`);
  return {
    rimId: rim.id,
    finishMode: "none",
    finishId: "finish-1",
    textMode: "none",
    text: "",
    imageMode: "none",
    selectedImageId: null,
    customImage: null,
    textTransform: createDefaultElementTransform("rim"),
    imageTransform: createDefaultElementTransform("rim"),
  };
}

export function normalizeRimSelection(variant: MateVariant, current?: Partial<RimCustomization> | null): RimCustomization {
  const safeCurrent = current ?? {};
  const compatibleRims = getCompatibleRims(variant);
  const rim = compatibleRims.find((item) => item.id === safeCurrent.rimId)
    ?? compatibleRims.find((item) => item.id === variant.defaultRimId)
    ?? compatibleRims[0];
  if (!rim) throw new Error(`La variante ${variant.id} no tiene virolas compatibles válidas`);

  return {
    ...createDefaultRimSelection(variant),
    ...safeCurrent,
    rimId: rim.id,
    customImage: safeCurrent.customImage ?? null,
    textTransform: normalizeElementTransform(safeCurrent.textTransform, "rim"),
    imageTransform: normalizeElementTransform(safeCurrent.imageTransform, "rim"),
  };
}

export function sanitizeRimText(value: string): string {
  return value.replace(/\s+/g, " ").replace(/^ /, "");
}
