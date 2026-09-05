import type { MateVariant } from "./mateCatalog";
import type { RimFinishId } from "./rimFinishCatalog";
import { rimIconCatalog } from "./rimIconCatalog";
import { normalizeEngravingText } from "../utils/engravingText";
import {
  createDefaultElementTransform,
  normalizeElementTransform,
  type ElementTransform,
  type IconElement,
  type RimTextElement,
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
  texts: RimTextElement[];
  imageMode: RimImageMode;
  icons: IconElement[];
  textTransform: ElementTransform;
}

export const MAX_RIM_TEXT_LENGTH = 40;
export const MAX_RIM_ICONS = 3;

function hasUsableCustomImage(value: unknown): value is IconElement["customImage"] {
  if (!value || typeof value !== "object") return false;
  const asset = value as Record<string, unknown>;
  return typeof asset.id === "string" && typeof asset.previewUrl === "string";
}

/**
 * Older drafts can contain repeated or incomplete icon entries. Keep only
 * selectable catalog items or valid uploads, and never let stale entries use
 * a slot in the three-icon limit.
 */
export function normalizeRimIcons(value: unknown): IconElement[] {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  const icons: IconElement[] = [];

  for (const rawIcon of value) {
    if (!rawIcon || typeof rawIcon !== "object") continue;
    const icon = rawIcon as Partial<IconElement>;
    const customImage = hasUsableCustomImage(icon.customImage) ? icon.customImage : null;
    const selectedImageId = typeof icon.selectedImageId === "string" ? icon.selectedImageId : null;
    const catalogIconExists = selectedImageId !== null && rimIconCatalog.some((item) => item.id === selectedImageId);

    if (!customImage && !catalogIconExists) continue;

    const selectionKey = customImage ? `upload:${customImage.id}` : `catalog:${selectedImageId}`;
    if (seen.has(selectionKey)) continue;
    seen.add(selectionKey);

    icons.push({
      id: typeof icon.id === "string" ? icon.id : crypto.randomUUID(),
      selectedImageId,
      customImage,
      transform: normalizeElementTransform(icon.transform, "rim"),
    });

    if (icons.length === MAX_RIM_ICONS) break;
  }

  return icons;
}

export function createDefaultRimTextElements(): RimTextElement[] {
  return [
    {
      id: "text-1",
      text: "",
      inverted: false,
      transform: createDefaultElementTransform("rim"),
    },
    {
      id: "text-2",
      text: "",
      inverted: true,
      transform: createDefaultElementTransform("rim"),
    },
  ];
}

export const rimCatalog: RimOption[] = [
  { id: "original", name: "Original del producto", shortName: "Original", material: "original" },
  { id: "acero", name: "Virola de acero", shortName: "Acero", material: "acero" },
  { id: "alpaca", name: "Virola de alpaca", shortName: "Alpaca", material: "alpaca" },
  { id: "alpaca-grande", name: "Virola de alpaca grande", shortName: "Alpaca grande", material: "alpaca-grande" },
  { id: "alpaca-grande-lacre", name: "Alpaca grande al lacre", shortName: "Alpaca grande al lacre", material: "alpaca-grande" },
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
  const texts = createDefaultRimTextElements();
  return {
    rimId: rim.id,
    finishMode: "none",
    finishId: "finish-1",
    textMode: "none",
    text: "",
    texts,
    imageMode: "none",
    icons: [],
    textTransform: texts[0].transform,
  };
}

export function normalizeRimSelection(variant: MateVariant, current?: Partial<RimCustomization> | null): RimCustomization {
  const safeCurrent = current ?? {};
  const sanitizedCurrent = { ...safeCurrent } as Partial<RimCustomization> & { customFinishImage?: unknown };
  delete sanitizedCurrent.customFinishImage;
  const compatibleRims = getCompatibleRims(variant);
  const rim = compatibleRims.find((item) => item.id === safeCurrent.rimId)
    ?? compatibleRims.find((item) => item.id === variant.defaultRimId)
    ?? compatibleRims[0];
  if (!rim) throw new Error(`La variante ${variant.id} no tiene virolas compatibles válidas`);

  const rawTexts = Array.isArray(safeCurrent.texts) ? safeCurrent.texts : [];
  const text1Raw = rawTexts.find((t) => t.id === "text-1") ?? rawTexts[0];
  const text2Raw = rawTexts.find((t) => t.id === "text-2") ?? rawTexts[1];

  const primaryText = sanitizeRimText(
    typeof safeCurrent.text === "string" ? safeCurrent.text : (text1Raw?.text ?? ""),
  ).slice(0, MAX_RIM_TEXT_LENGTH);
  const primaryTransform = normalizeElementTransform(safeCurrent.textTransform ?? text1Raw?.transform, "rim");

  const texts: RimTextElement[] = [
    {
      id: "text-1",
      text: typeof text1Raw?.text === "string"
        ? sanitizeRimText(text1Raw.text).slice(0, MAX_RIM_TEXT_LENGTH)
        : primaryText,
      inverted: typeof text1Raw?.inverted === "boolean" ? text1Raw.inverted : false,
      transform: normalizeElementTransform(text1Raw?.transform ?? primaryTransform, "rim"),
    },
    {
      id: "text-2",
      text: typeof text2Raw?.text === "string"
        ? sanitizeRimText(text2Raw.text).slice(0, MAX_RIM_TEXT_LENGTH)
        : "",
      inverted: typeof text2Raw?.inverted === "boolean" ? text2Raw.inverted : true,
      transform: normalizeElementTransform(text2Raw?.transform, "rim"),
    },
  ];

  return {
    ...createDefaultRimSelection(variant),
    ...sanitizedCurrent,
    rimId: rim.id,
    text: texts[0].text,
    textTransform: texts[0].transform,
    texts,
    icons: normalizeRimIcons(safeCurrent.icons),
  };
}

export function sanitizeRimText(value: string): string {
  return normalizeEngravingText(value);
}
