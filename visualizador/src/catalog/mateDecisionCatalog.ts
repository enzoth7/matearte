import type { MateModel, MateSize } from "./mateCatalog";

export type MateFamilyId = "camionero" | "imperial" | "torpedo" | "criollo";
export type MateSelectionStage = "model" | "texture" | "metal" | "size";
export type CatalogOptionStatus = "ready" | "pending";

export interface MateSelection {
  familyId: MateFamilyId | null;
  textureId: string | null;
  colorId: string | null;
  metalId: string | null;
  sizeId: MateSize | null;
}

export interface MateCapabilities {
  hasRim: boolean;
  hasFleje: boolean;
}

export interface DecisionColorOption {
  id: string;
  label: string;
  swatch: string;
  status?: CatalogOptionStatus;
  priceDeltaUYU: number | null;
}

export interface DecisionMetalOption {
  id: string;
  label: string;
  rimId: string;
  /** Asset del material/virola aislado. Nunca debe apuntar a la foto del mate. */
  previewImage?: string;
  status?: CatalogOptionStatus;
  priceDeltaUYU: number | null;
}

export interface DecisionTextureOption {
  id: string;
  label: string;
  description: string;
  shapeId: MateModel;
  capabilities: MateCapabilities;
  colors: DecisionColorOption[];
  metals: DecisionMetalOption[];
  /** El metal forma parte del producto, pero el árbol no muestra una pregunta para elegirlo. */
  skipMetalSelection?: boolean;
  sizes: MateSize[];
  representativeVariantId: string;
  /** Previews específicos de esta textura y color, independientes del nombre del archivo. */
  colorPreviewImages?: Record<string, string>;
  legacyVariantId?: string;
  legacyVariantByColor?: Record<string, string>;
  legacyVariantByMetal?: Record<string, string>;
  legacyVariantByCombination?: Record<string, string>;
  status?: CatalogOptionStatus;
  priceDeltaUYU: number | null;
}

export interface MateFamilyDefinition {
  id: MateFamilyId;
  label: string;
  description: string;
  representativeVariantId: string;
  textures: DecisionTextureOption[];
  basePriceUYU: number | null;
}

export interface ResolvedMateProduct {
  productId: string;
  skuId: string | null;
  legacyVariantId: string;
  displayName: string;
  familyId: MateFamilyId;
  familyLabel: string;
  shapeId: MateModel;
  textureId: string;
  textureLabel: string;
  colorId: string;
  colorLabel: string;
  metalId: string;
  metalLabel: string;
  rimId: string;
  sizeId: MateSize;
  capabilities: MateCapabilities;
  price: {
    baseUYU: number | null;
    textureDeltaUYU: number | null;
    colorDeltaUYU: number | null;
    metalDeltaUYU: number | null;
    sizeDeltaUYU: number | null;
  };
  status: CatalogOptionStatus;
}

const PENDING_PRICE = null;
const SIZES: MateSize[] = ["chico", "medio", "grande"];

const colors = {
  natural: { id: "natural", label: "Natural", swatch: "#d8b67c", priceDeltaUYU: PENDING_PRICE },
  cueroCrudo: { id: "cuero-crudo", label: "Cuero crudo", swatch: "#ead6ac", priceDeltaUYU: PENDING_PRICE },
  marron: { id: "marron", label: "Marrón", swatch: "#70452f", priceDeltaUYU: PENDING_PRICE },
  negro: { id: "negro", label: "Negro", swatch: "#27211e", priceDeltaUYU: PENDING_PRICE },
  vacuno: { id: "vacuno", label: "Vacuno", swatch: "#9a6848", priceDeltaUYU: PENDING_PRICE },
  printPelos: { id: "print-pelos", label: "Print / pelos", swatch: "linear-gradient(135deg,#5f3826 0 45%,#f3e1b9 45% 55%,#2d1d14 55%)", priceDeltaUYU: PENDING_PRICE },
  print: { id: "print", label: "Print", swatch: "linear-gradient(135deg,#5f3826 0 45%,#f3e1b9 45% 55%,#2d1d14 55%)", priceDeltaUYU: PENDING_PRICE },
  criollo: { id: "criollo", label: "Criollo", swatch: "#b88a5a", priceDeltaUYU: PENDING_PRICE },
  vaqueta: { id: "vaqueta", label: "Vaqueta", swatch: "#c69c6d", priceDeltaUYU: PENDING_PRICE },
  marronBlanco: { id: "marron-blanco", label: "Marrón y blanco", swatch: "linear-gradient(135deg,#70452f 0 50%,#f4efe5 50%)", priceDeltaUYU: PENDING_PRICE },
  negroBlanco: { id: "negro-blanco", label: "Negro y blanco", swatch: "linear-gradient(135deg,#27211e 0 50%,#f4efe5 50%)", priceDeltaUYU: PENDING_PRICE },
  animalPrint: { id: "animal-print", label: "Animal print", swatch: "repeating-linear-gradient(135deg,#c69c6d 0 6px,#2d1d14 6px 10px)", priceDeltaUYU: PENDING_PRICE },
  cuerosPendientes: { id: "cueros-pendientes", label: "Cueros por confirmar", swatch: "#d9cbb7", status: "pending" as const, priceDeltaUYU: PENDING_PRICE },
  variantePendiente: { id: "variante-pendiente", label: "Color de la variante por confirmar", swatch: "#d9cbb7", status: "pending" as const, priceDeltaUYU: PENDING_PRICE },
};

const metals = {
  alpacaCincelada: { id: "alpaca-cincelada", label: "Alpaca cincelada", rimId: "alpaca", priceDeltaUYU: PENDING_PRICE },
  alpacaGrandeCincelada: { id: "alpaca-grande-cincelada", label: "Alpaca grande cincelada", rimId: "alpaca-grande", priceDeltaUYU: PENDING_PRICE },
  alpacaBronce: { id: "alpaca-bronce", label: "Alpaca y bronce", rimId: "alpaca-bronce", priceDeltaUYU: PENDING_PRICE },
  alpacaComun: { id: "alpaca-comun", label: "Alpaca común", rimId: "alpaca", priceDeltaUYU: PENDING_PRICE },
  alpacaGrande: { id: "alpaca-grande", label: "Alpaca grande", rimId: "alpaca-grande", priceDeltaUYU: PENDING_PRICE },
  originalImperial: { id: "original-imperial", label: "Virola original del Imperial", rimId: "original", priceDeltaUYU: PENDING_PRICE },
  originalCamionero: { id: "original-camionero", label: "Virola original del Camionero", rimId: "original", priceDeltaUYU: PENDING_PRICE },
  plata900: { id: "plata-900", label: "Plata 900", rimId: "plata-900", priceDeltaUYU: PENDING_PRICE },
};

function texture(
  value: Omit<DecisionTextureOption, "sizes" | "priceDeltaUYU"> & Partial<Pick<DecisionTextureOption, "sizes" | "priceDeltaUYU">>,
): DecisionTextureOption {
  return {
    ...value,
    sizes: value.sizes ?? [...SIZES],
    priceDeltaUYU: value.priceDeltaUYU ?? PENDING_PRICE,
  };
}

export const mateDecisionCatalog: MateFamilyDefinition[] = [
  {
    id: "camionero",
    label: "Camionero",
    description: "Boca amplia y cuerpo con patas.",
    representativeVariantId: "camionero-artesanal",
    basePriceUYU: PENDING_PRICE,
    textures: [
      texture({
        id: "alpaca-cincelado-patas",
        label: "Camionero alpaca cincelado con patas",
        description: "La única construcción indicada en el árbol Camionero.",
        shapeId: "camionero",
        capabilities: { hasRim: true, hasFleje: false },
        colors: [colors.natural, colors.cueroCrudo, colors.marron, colors.negro],
        metals: [metals.alpacaCincelada],
        representativeVariantId: "camionero-artesanal",
        legacyVariantId: "camionero-artesanal",
      }),
    ],
  },
  {
    id: "imperial",
    label: "Imperial",
    description: "Silueta clásica con virola y fleje personalizable.",
    representativeVariantId: "imperial-lacre",
    basePriceUYU: PENDING_PRICE,
    textures: [
      texture({
        id: "cincelado-premium",
        label: "Cincelado Premium",
        description: "Terminación premium del árbol Imperial.",
        shapeId: "imperial",
        capabilities: { hasRim: true, hasFleje: true },
        colors: [colors.vacuno, colors.negro, colors.marron, colors.natural, colors.printPelos, colors.cueroCrudo],
        metals: [metals.originalImperial],
        skipMetalSelection: true,
        representativeVariantId: "imperial-lacre",
        legacyVariantId: "imperial-lacre",
      }),
      texture({
        id: "imperial-clasico",
        label: "Imperial clásico",
        description: "Cuero clásico en los colores definidos por el árbol.",
        shapeId: "imperial",
        capabilities: { hasRim: true, hasFleje: true },
        colors: [colors.natural, colors.negro, colors.marron],
        metals: [metals.originalImperial],
        skipMetalSelection: true,
        representativeVariantId: "imperial-premium",
        legacyVariantId: "imperial-premium",
      }),
      texture({
        id: "imperial-print-pelos",
        label: "Imperial print / pelos",
        description: "El catálogo de cueros todavía no fue informado.",
        shapeId: "imperial",
        capabilities: { hasRim: true, hasFleje: true },
        colors: [colors.cuerosPendientes],
        metals: [metals.originalImperial],
        skipMetalSelection: true,
        representativeVariantId: "imperial-print",
        legacyVariantId: "imperial-print",
        status: "pending",
      }),
      texture({
        id: "imperial-cuero-crudo",
        label: "Imperial cuero crudo",
        description: "Cuero crudo según la rama Imperial.",
        shapeId: "imperial",
        capabilities: { hasRim: true, hasFleje: true },
        colors: [colors.cueroCrudo],
        metals: [metals.originalImperial],
        skipMetalSelection: true,
        representativeVariantId: "imperial-cuero-crudo",
        legacyVariantId: "imperial-cuero-crudo",
      }),
      texture({
        id: "imperial-criollo",
        label: "Imperial criollo",
        description: "La rama no informa un color independiente.",
        shapeId: "imperial",
        capabilities: { hasRim: true, hasFleje: true },
        colors: [colors.variantePendiente],
        metals: [metals.originalImperial],
        skipMetalSelection: true,
        representativeVariantId: "imperial-criollo-posa-cuero-crudo",
        legacyVariantId: "imperial-criollo-posa-cuero-crudo",
        status: "pending",
      }),
      texture({
        id: "virola-plata-900",
        label: "Virola Plata 900",
        description: "Imperial con virola de plata 900.",
        shapeId: "imperial",
        capabilities: { hasRim: true, hasFleje: true },
        colors: [colors.negro, colors.marron, colors.natural, colors.print, colors.cueroCrudo, colors.criollo],
        metals: [metals.plata900],
        representativeVariantId: "imperial-clasico",
        legacyVariantId: "imperial-clasico",
      }),
    ],
  },
  {
    id: "torpedo",
    label: "Torpedo",
    description: "Cuerpo estilizado sin fleje.",
    representativeVariantId: "torpedo-cuero-liso-alpaca-cincelada",
    basePriceUYU: PENDING_PRICE,
    textures: [
      texture({
        id: "cuero-liso",
        label: "Cuero liso",
        description: "Cuero liso en tonos natural, negro o marrón.",
        shapeId: "torpedo",
        capabilities: { hasRim: true, hasFleje: false },
        colors: [colors.natural, colors.negro, colors.marron],
        metals: [metals.alpacaBronce, metals.alpacaComun, metals.alpacaGrande],
        representativeVariantId: "torpedo-cuero-liso-alpaca-cincelada",
        legacyVariantByMetal: {
          "alpaca-bronce": "torpedo-cuero-liso-alpaca-bronce",
          "alpaca-comun": "torpedo-cuero-liso-alpaca-cincelada",
          "alpaca-grande": "torpedo-cuero-liso-alpaca-grande",
        },
      }),
      texture({
        id: "cuero-estampado",
        label: "Cuero estampado",
        description: "Cuero estampado marrón o negro.",
        shapeId: "torpedo",
        capabilities: { hasRim: true, hasFleje: false },
        colors: [colors.marron, colors.negro],
        metals: [metals.alpacaBronce, metals.alpacaComun, metals.alpacaGrande],
        representativeVariantId: "torpedo-alpaca-bronce-estampado",
        legacyVariantByMetal: {
          "alpaca-bronce": "torpedo-alpaca-bronce-estampado",
          "alpaca-comun": "torpedo-cuero-estampado-alpaca-comun",
          "alpaca-grande": "torpedo-cuero-estampado-alpaca-grande",
        },
      }),
      texture({
        id: "cuero-crudo",
        label: "Cuero crudo",
        description: "Cuero crudo sin una paleta adicional en el árbol.",
        shapeId: "torpedo",
        capabilities: { hasRim: true, hasFleje: false },
        colors: [colors.cueroCrudo],
        metals: [metals.alpacaBronce, metals.alpacaComun, metals.alpacaGrande],
        representativeVariantId: "torpedo-cuero-crudo-alpaca-cincelada",
        legacyVariantByMetal: {
          "alpaca-bronce": "torpedo-cuero-crudo-alpaca-bronce",
          "alpaca-comun": "torpedo-cuero-crudo-alpaca-cincelada",
          "alpaca-grande": "torpedo-cuero-crudo-grande-cincelada",
        },
      }),
      texture({
        id: "print-pelos",
        label: "Print / pelos",
        description: "Croco, pelos y animal print.",
        shapeId: "torpedo",
        capabilities: { hasRim: true, hasFleje: false },
        colors: [colors.marronBlanco, colors.negroBlanco, colors.animalPrint],
        metals: [metals.alpacaBronce, metals.alpacaComun, metals.alpacaGrande],
        representativeVariantId: "torpedo-croco-pelo",
        legacyVariantByMetal: {
          "alpaca-bronce": "torpedo-croco-pelo-reforzado",
          "alpaca-comun": "torpedo-croco-pelo",
          "alpaca-grande": "torpedo-croco-pelo-grande",
        },
      }),
    ],
  },
  {
    id: "criollo",
    label: "Criollo",
    description: "Familia criolla con silueta Torpedo, Imperial o Camionero.",
    representativeVariantId: "criollo-clasico",
    basePriceUYU: PENDING_PRICE,
    textures: [
      texture({
        id: "torpedo-criollo-posa-mate",
        label: "Torpedo criollo posa mate",
        description: "Silueta Torpedo con posa mate.",
        shapeId: "torpedo",
        capabilities: { hasRim: true, hasFleje: false },
        colors: [colors.vaqueta, colors.cueroCrudo],
        metals: [metals.alpacaGrandeCincelada],
        representativeVariantId: "criollo-clasico",
        legacyVariantByColor: {
          vaqueta: "criollo-clasico",
          "cuero-crudo": "criollo-grande-posa-cuero-crudo",
        },
      }),
      texture({
        id: "imperial-criollo-posa-mate",
        label: "Imperial criollo posa mate",
        description: "Silueta Imperial con posa mate.",
        shapeId: "imperial",
        capabilities: { hasRim: true, hasFleje: true },
        colors: [colors.vaqueta, colors.cueroCrudo],
        metals: [metals.originalImperial],
        skipMetalSelection: true,
        representativeVariantId: "imperial-criollo-posa-cuero-crudo",
        legacyVariantByColor: {
          "cuero-crudo": "imperial-criollo-posa-cuero-crudo",
        },
      }),
      texture({
        id: "camionero-criollo-posa-mate",
        label: "Camionero criollo posa mate",
        description: "Silueta Camionero con posa mate.",
        shapeId: "camionero",
        capabilities: { hasRim: true, hasFleje: false },
        colors: [colors.vaqueta, colors.cueroCrudo],
        metals: [metals.originalCamionero],
        skipMetalSelection: true,
        representativeVariantId: "camionero-criollo-posa-vaqueta",
        legacyVariantByColor: {
          vaqueta: "camionero-criollo-posa-vaqueta",
        },
      }),
    ],
  },
];

export const EMPTY_MATE_SELECTION: MateSelection = {
  familyId: null,
  textureId: null,
  colorId: null,
  metalId: null,
  sizeId: null,
};

export const mateSizeDecisionLabels: Record<MateSize, string> = {
  chico: "Chico",
  medio: "Medio",
  grande: "Grande",
};

export function getMateFamily(familyId: MateFamilyId | null | undefined) {
  return mateDecisionCatalog.find((family) => family.id === familyId);
}

export function getSelectedTexture(selection: Partial<MateSelection>) {
  return getMateFamily(selection.familyId)?.textures.find((item) => item.id === selection.textureId);
}

export function shouldAskForMetal(selection: Partial<MateSelection>) {
  const selectedTexture = getSelectedTexture(selection);
  return selectedTexture ? selectedTexture.skipMetalSelection !== true : true;
}

function getEffectiveMetalId(textureOption: DecisionTextureOption, metalId: string | null | undefined) {
  if (textureOption.metals.some((item) => item.id === metalId)) return metalId as string;
  return textureOption.skipMetalSelection ? textureOption.metals[0]?.id ?? null : null;
}

export function isCompleteMateSelection(selection: Partial<MateSelection>): selection is MateSelection & {
  familyId: MateFamilyId;
  textureId: string;
  colorId: string;
  metalId: string;
  sizeId: MateSize;
} {
  const family = getMateFamily(selection.familyId);
  const selectedTexture = family?.textures.find((item) => item.id === selection.textureId);
  return Boolean(
    family
      && selectedTexture
      && selectedTexture.colors.some((item) => item.id === selection.colorId)
      && selectedTexture.metals.some((item) => item.id === selection.metalId)
      && selectedTexture.sizes.includes(selection.sizeId as MateSize),
  );
}

export function getFirstIncompleteStage(selection: Partial<MateSelection>): MateSelectionStage | null {
  const family = getMateFamily(selection.familyId);
  if (!family) return "model";
  const selectedTexture = family.textures.find((item) => item.id === selection.textureId);
  if (!selectedTexture || !selectedTexture.colors.some((item) => item.id === selection.colorId)) return "texture";
  if (!getEffectiveMetalId(selectedTexture, selection.metalId)) return "metal";
  if (!selectedTexture.sizes.includes(selection.sizeId as MateSize)) return "size";
  return null;
}

function getLegacyVariantId(textureOption: DecisionTextureOption, colorId: string, metalId: string) {
  return textureOption.legacyVariantByCombination?.[`${colorId}:${metalId}`]
    ?? textureOption.legacyVariantByColor?.[colorId]
    ?? textureOption.legacyVariantByMetal?.[metalId]
    ?? textureOption.legacyVariantId
    ?? null;
}

export function resolveMateSelection(selection: Partial<MateSelection>): ResolvedMateProduct | null {
  const family = getMateFamily(selection.familyId);
  const textureOption = family?.textures.find((item) => item.id === selection.textureId);
  if (!family || !textureOption) return null;
  const effectiveSelection = {
    ...selection,
    metalId: getEffectiveMetalId(textureOption, selection.metalId),
  };
  if (!isCompleteMateSelection(effectiveSelection)) return null;
  const color = textureOption.colors.find((item) => item.id === effectiveSelection.colorId)!;
  const metal = textureOption.metals.find((item) => item.id === effectiveSelection.metalId)!;
  const mappedLegacyVariantId = getLegacyVariantId(textureOption, color.id, metal.id);
  const productId = [family.id, textureOption.id, color.id, metal.id, effectiveSelection.sizeId].join("--");
  const status: CatalogOptionStatus = mappedLegacyVariantId && textureOption.status !== "pending" && color.status !== "pending" && metal.status !== "pending"
    ? "ready"
    : "pending";
  const skuId = status === "ready" ? mappedLegacyVariantId : null;

  return {
    productId,
    skuId,
    legacyVariantId: mappedLegacyVariantId ?? textureOption.representativeVariantId,
    displayName: `${textureOption.label} · ${color.label} · ${metal.label}`,
    familyId: family.id,
    familyLabel: family.label,
    shapeId: textureOption.shapeId,
    textureId: textureOption.id,
    textureLabel: textureOption.label,
    colorId: color.id,
    colorLabel: color.label,
    metalId: metal.id,
    metalLabel: metal.label,
    rimId: metal.rimId,
    sizeId: effectiveSelection.sizeId,
    capabilities: textureOption.capabilities,
    price: {
      baseUYU: family.basePriceUYU,
      textureDeltaUYU: textureOption.priceDeltaUYU,
      colorDeltaUYU: color.priceDeltaUYU,
      metalDeltaUYU: metal.priceDeltaUYU,
      sizeDeltaUYU: null,
    },
    status,
  };
}

export function sanitizeMateSelection(value: unknown): MateSelection {
  const input = (value && typeof value === "object" ? value : {}) as Partial<MateSelection>;
  const family = getMateFamily(input.familyId);
  if (!family) return { ...EMPTY_MATE_SELECTION };
  const textureOption = family.textures.find((item) => item.id === input.textureId);
  if (!textureOption) return { ...EMPTY_MATE_SELECTION, familyId: family.id };
  const colorId = textureOption.colors.some((item) => item.id === input.colorId) ? input.colorId! : null;
  if (!colorId) return { familyId: family.id, textureId: textureOption.id, colorId: null, metalId: null, sizeId: null };
  const metalId = getEffectiveMetalId(textureOption, input.metalId);
  if (!metalId) return { familyId: family.id, textureId: textureOption.id, colorId, metalId: null, sizeId: null };
  const sizeId = textureOption.sizes.includes(input.sizeId as MateSize) ? input.sizeId as MateSize : null;
  return { familyId: family.id, textureId: textureOption.id, colorId, metalId, sizeId };
}

const legacySelectionMap: Record<string, MateSelection> = {
  "camionero-artesanal": { familyId: "camionero", textureId: "alpaca-cincelado-patas", colorId: "natural", metalId: "alpaca-cincelada", sizeId: "medio" },
  "camionero-criollo-posa-vaqueta": { familyId: "criollo", textureId: "camionero-criollo-posa-mate", colorId: "vaqueta", metalId: "original-camionero", sizeId: "medio" },
  "criollo-clasico": { familyId: "criollo", textureId: "torpedo-criollo-posa-mate", colorId: "vaqueta", metalId: "alpaca-grande-cincelada", sizeId: "medio" },
  "criollo-grande-posa-cuero-crudo": { familyId: "criollo", textureId: "torpedo-criollo-posa-mate", colorId: "cuero-crudo", metalId: "alpaca-grande-cincelada", sizeId: "medio" },
  "imperial-lacre": { familyId: "imperial", textureId: "cincelado-premium", colorId: "vacuno", metalId: "original-imperial", sizeId: "medio" },
  "imperial-premium": { familyId: "imperial", textureId: "imperial-clasico", colorId: "natural", metalId: "original-imperial", sizeId: "medio" },
  "imperial-cuero-crudo": { familyId: "imperial", textureId: "imperial-cuero-crudo", colorId: "cuero-crudo", metalId: "original-imperial", sizeId: "medio" },
  "imperial-criollo-posa-cuero-crudo": { familyId: "criollo", textureId: "imperial-criollo-posa-mate", colorId: "cuero-crudo", metalId: "original-imperial", sizeId: "medio" },
  "imperial-print": { familyId: "imperial", textureId: "imperial-print-pelos", colorId: "cueros-pendientes", metalId: "original-imperial", sizeId: "medio" },
  "imperial-clasico": { familyId: "imperial", textureId: "virola-plata-900", colorId: "natural", metalId: "plata-900", sizeId: "medio" },
  "torpedo-cuero-liso-alpaca-bronce": { familyId: "torpedo", textureId: "cuero-liso", colorId: "marron", metalId: "alpaca-bronce", sizeId: "medio" },
  "torpedo-cuero-liso-alpaca-cincelada": { familyId: "torpedo", textureId: "cuero-liso", colorId: "marron", metalId: "alpaca-comun", sizeId: "medio" },
  "torpedo-cuero-liso-alpaca-grande": { familyId: "torpedo", textureId: "cuero-liso", colorId: "marron", metalId: "alpaca-grande", sizeId: "medio" },
  "torpedo-alpaca-bronce-estampado": { familyId: "torpedo", textureId: "cuero-estampado", colorId: "marron", metalId: "alpaca-bronce", sizeId: "medio" },
  "torpedo-cuero-estampado-alpaca-comun": { familyId: "torpedo", textureId: "cuero-estampado", colorId: "marron", metalId: "alpaca-comun", sizeId: "medio" },
  "torpedo-cuero-estampado-alpaca-grande": { familyId: "torpedo", textureId: "cuero-estampado", colorId: "marron", metalId: "alpaca-grande", sizeId: "medio" },
  "torpedo-cuero-crudo-alpaca-bronce": { familyId: "torpedo", textureId: "cuero-crudo", colorId: "cuero-crudo", metalId: "alpaca-bronce", sizeId: "medio" },
  "torpedo-cuero-crudo-alpaca-cincelada": { familyId: "torpedo", textureId: "cuero-crudo", colorId: "cuero-crudo", metalId: "alpaca-comun", sizeId: "medio" },
  "torpedo-cuero-crudo-grande-cincelada": { familyId: "torpedo", textureId: "cuero-crudo", colorId: "cuero-crudo", metalId: "alpaca-grande", sizeId: "medio" },
  "torpedo-croco-pelo-reforzado": { familyId: "torpedo", textureId: "print-pelos", colorId: "animal-print", metalId: "alpaca-bronce", sizeId: "medio" },
  "torpedo-croco-pelo": { familyId: "torpedo", textureId: "print-pelos", colorId: "animal-print", metalId: "alpaca-comun", sizeId: "medio" },
  "torpedo-croco-pelo-grande": { familyId: "torpedo", textureId: "print-pelos", colorId: "animal-print", metalId: "alpaca-grande", sizeId: "medio" },
};

export function getSelectionFromLegacyVariant(variantId: string, size: MateSize = "medio"): MateSelection | null {
  const mapped = legacySelectionMap[variantId];
  return mapped ? { ...mapped, sizeId: size } : null;
}

export function getSelectionLabels(selection: Partial<MateSelection>) {
  const family = getMateFamily(selection.familyId);
  const textureOption = family?.textures.find((item) => item.id === selection.textureId);
  const color = textureOption?.colors.find((item) => item.id === selection.colorId);
  const metal = textureOption?.metals.find((item) => item.id === selection.metalId);
  return {
    family: family?.label ?? "Configuración anterior",
    texture: textureOption?.label ?? "Sin definir",
    color: color?.label ?? "Sin definir",
    metal: metal?.label ?? "Sin definir",
    size: selection.sizeId ? mateSizeDecisionLabels[selection.sizeId] : "Sin definir",
  };
}
