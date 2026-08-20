import type { FlejeFinishId } from "../catalog/flejeFinishCatalog";
import type { MateModel, MateSize } from "../catalog/mateCatalog";
import type { MateCapabilities, MateSelection } from "../catalog/mateDecisionCatalog";
import type { RimCustomization } from "../catalog/rimCatalog";

export type CustomizationSide = "rim" | "front" | "back";
export type EditableElement = "text" | "image" | "finish";
export type FlejeSide = "front" | "back";

export interface ElementTransform {
  x: number;
  y: number;
  scale: number;
  rotation: number;
  side: CustomizationSide;
}

export interface CustomImageAsset {
  id: string;
  name: string;
  mimeType: "image/png" | "image/jpeg" | "image/svg+xml";
  size: number;
  previewUrl: string;
  originalUrl: string;
  source: "upload";
}

export interface IconElement {
  id: string;
  selectedImageId: string | null;
  customImage: CustomImageAsset | null;
  transform: ElementTransform;
}

export interface RimTextElement {
  id: string;
  text: string;
  inverted?: boolean;
  transform: ElementTransform;
}

export interface FlejeSideCustomization {
  textMode: "none" | "text";
  text: string;
  imageMode: "none" | "image";
  selectedImageId: string | null;
  customImage: CustomImageAsset | null;
  textTransform: ElementTransform;
  imageTransform: ElementTransform;
  finishTransform: ElementTransform;
}

export interface FlejeCustomization {
  finishMode: "none" | "finish";
  finishId: FlejeFinishId;
  sides: Record<FlejeSide, FlejeSideCustomization>;
}

export interface MateConfiguration {
  schemaVersion: 2;
  productId: string | null;
  skuId: string | null;
  selection: MateSelection;
  selectionLabels: {
    family: string;
    texture: string;
    color: string;
    metal: string;
    size: string;
  };
  capabilities: MateCapabilities;
  isLegacy: boolean;
  modelId: MateModel;
  variantId: string;
  size: MateSize;
  colorId: string;
  rim: RimCustomization;
}

export const DEFAULT_ELEMENT_TRANSFORM: ElementTransform = {
  x: 0.5,
  y: 0.5,
  scale: 1,
  rotation: 0,
  side: "rim",
};

export function createDefaultElementTransform(side: CustomizationSide): ElementTransform {
  return { ...DEFAULT_ELEMENT_TRANSFORM, side };
}

export function normalizeElementTransform(
  value: Partial<ElementTransform> | null | undefined,
  side: CustomizationSide,
): ElementTransform {
  const x = Number(value?.x);
  const y = Number(value?.y);
  const scale = Number(value?.scale);
  const rotation = Number(value?.rotation);

  return {
    x: Number.isFinite(x) ? Math.min(0.98, Math.max(0.02, x)) : 0.5,
    y: Number.isFinite(y) ? Math.min(0.98, Math.max(0.02, y)) : 0.5,
    scale: Number.isFinite(scale) ? Math.min(1.6, Math.max(0.5, scale)) : 1,
    rotation: Number.isFinite(rotation) ? Math.min(180, Math.max(-180, rotation)) : 0,
    side,
  };
}

export function createDefaultFlejeSide(side: FlejeSide): FlejeSideCustomization {
  return {
    textMode: "none",
    text: "",
    imageMode: "none",
    selectedImageId: null,
    customImage: null,
    textTransform: createDefaultElementTransform(side),
    imageTransform: createDefaultElementTransform(side),
    finishTransform: createDefaultElementTransform(side),
  };
}

export function createDefaultFlejeCustomization(): FlejeCustomization {
  return {
    finishMode: "none",
    finishId: "pattern-1",
    sides: {
      front: createDefaultFlejeSide("front"),
      back: createDefaultFlejeSide("back"),
    },
  };
}

export function normalizeFlejeCustomization(value: unknown): FlejeCustomization {
  const input = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const inputSides = (input.sides && typeof input.sides === "object" ? input.sides : {}) as Record<string, unknown>;

  const normalizeSide = (side: FlejeSide): FlejeSideCustomization => {
    const sideInput = (inputSides[side] && typeof inputSides[side] === "object"
      ? inputSides[side]
      : side === "front"
        ? input
        : {}) as Record<string, unknown>;
    const customImage = sideInput.customImage && typeof sideInput.customImage === "object"
      ? sideInput.customImage as CustomImageAsset
      : null;

    return {
      textMode: sideInput.textMode === "text" ? "text" : "none",
      text: typeof sideInput.text === "string" ? sideInput.text : "",
      imageMode: sideInput.imageMode === "image" ? "image" : "none",
      selectedImageId: typeof sideInput.selectedImageId === "string" ? sideInput.selectedImageId : null,
      customImage,
      textTransform: normalizeElementTransform(sideInput.textTransform as Partial<ElementTransform>, side),
      imageTransform: normalizeElementTransform(sideInput.imageTransform as Partial<ElementTransform>, side),
      finishTransform: normalizeElementTransform(sideInput.finishTransform as Partial<ElementTransform>, side),
    };
  };

  return {
    finishMode: input.finishMode === "finish" ? "finish" : "none",
    finishId: typeof input.finishId === "string" ? input.finishId as FlejeFinishId : "pattern-1",
    sides: {
      front: normalizeSide("front"),
      back: normalizeSide("back"),
    },
  };
}
