import { getMateAssetPath } from "./mateAssetCatalog";

export type MateModel = "torpedo" | "criollo" | "imperial" | "camionero";
export type MateSize = "chico" | "medio" | "grande";

export interface ProductColorOption {
  id: string;
  name: string;
  swatch: string;
}

export type TorpedoLeatherType = "cuero-liso" | "cuero-estampado" | "cuero-crudo" | "croco-pelos";
export type TorpedoRimType = "alpaca-grande" | "alpaca-comun" | "alpaca-bronce" | "otros";

export interface EngravingArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface MateVariant {
  id: string;
  model: MateModel;
  name: string;
  image: string;
  sourceProducts?: string[];
  isDefault?: boolean;
  compatibleRimIds: string[];
  defaultRimId?: string;
  leatherType: string;
  rimType: TorpedoRimType;
  colors: ProductColorOption[];
  defaultColorId: string;
  availableSizes: MateSize[];
  defaultSize: MateSize;
  sizePriceAdjustments: Partial<Record<MateSize, number>>;
}

type BaseMateVariant = Omit<
  MateVariant,
  | "image"
  | "compatibleRimIds"
  | "defaultRimId"
  | "leatherType"
  | "rimType"
  | "colors"
  | "defaultColorId"
  | "availableSizes"
  | "defaultSize"
  | "sizePriceAdjustments"
>;

export interface MateModelDefinition {
  id: MateModel;
  name: string;
  hasFleje: boolean;
  engravingArea: EngravingArea | null;
}

export const mateModels: MateModelDefinition[] = [
  { id: "torpedo", name: "Torpedo", hasFleje: true, engravingArea: { x: 33, y: 21, width: 34, height: 12 } },
  { id: "criollo", name: "Criollo", hasFleje: true, engravingArea: { x: 27, y: 26, width: 46, height: 12 } },
  { id: "imperial", name: "Imperial", hasFleje: true, engravingArea: { x: 27, y: 26, width: 46, height: 12 } },
  { id: "camionero", name: "Camionero", hasFleje: false, engravingArea: null },
];

const baseMateVariants: BaseMateVariant[] = [
  { id: "torpedo-clasico", model: "torpedo", name: "Alpaca Cincelado Premium", sourceProducts: ["Torpedo Alpaca Cincelado al Lacre"], isDefault: true },
  { id: "torpedo-cuero-crudo-grande-cincelada", model: "torpedo", name: "Cuero Crudo Virola Grande Cincelada", sourceProducts: ["Torpedo Cuero Crudo Virola Grande Cincelada"] },
  { id: "torpedo-cuero-liso-grande-lisa", model: "torpedo", name: "Cuero Liso Alpaca Grande Lisa", sourceProducts: ["Torpedo Cuero Liso Alpaca Grande Lisa"] },
  { id: "torpedo-croco-pelo-grande", model: "torpedo", name: "Alpaca Grande Cincelada con Cuero Croco/Pelos", sourceProducts: ["Torpedo Alpaca Grande Cincelada con Cuero Croco Pelos"] },
  { id: "torpedo-croco-pelo", model: "torpedo", name: "Alpaca Cuero Croco/Pelos", sourceProducts: ["Torpedo Alpaca Cuero Croco Pelos"] },
  { id: "torpedo-cuero-liso-alpaca-grande", model: "torpedo", name: "Cuero Liso Virola Alpaca Grande", sourceProducts: ["Torpedo Cuero Liso Virola Alpaca Grande"] },
  { id: "torpedo-alpaca-bronce-estampado", model: "torpedo", name: "Alpaca y Bronce Cuero Estampado", sourceProducts: ["Torpedo Alpaca y Bronce Cuero Estampado"] },
  { id: "torpedo-croco-pelo-reforzado", model: "torpedo", name: "Alpaca y Bronce Croco/Pelos", sourceProducts: ["Torpedo Alpaca y Bronce Croco Pelos"] },
  { id: "torpedo-cuero-liso-acero-bronce", model: "torpedo", name: "Cuero Liso Virola Acero y Bronce Liso", sourceProducts: ["Torpedo Cuero Liso Virola Acero y Bronce Liso"] },
  { id: "torpedo-cuero-liso-alpaca-bronce", model: "torpedo", name: "Cuero Liso Alpaca y Bronce", sourceProducts: ["Torpedo Cuero Liso Alpaca y Bronce"] },
  { id: "torpedo-cuero-liso-alpaca-cincelada", model: "torpedo", name: "Cuero Liso Alpaca Cincelada", sourceProducts: ["Torpedo Cuero Liso Alpaca Cincelada"] },
  { id: "torpedo-cuero-crudo-alpaca-bronce", model: "torpedo", name: "Cuero Crudo Virola Alpaca y Bronce", sourceProducts: ["Torpedo Cuero Crudo Virola Alpaca y Bronce"] },
  { id: "torpedo-cuero-crudo-alpaca-cincelada", model: "torpedo", name: "Cuero Crudo Virola Alpaca Cincelada", sourceProducts: ["Torpedo Cuero Crudo Virola Alpaca Cincelada"] },
  { id: "torpedo-cuero-estampado-alpaca-comun", model: "torpedo", name: "Cuero Estampado Virola Alpaca Comun", sourceProducts: ["Torpedo Cuero Estampado Virola Alpaca Comun"] },
  { id: "torpedo-cuero-estampado-alpaca-grande", model: "torpedo", name: "Cuero Estampado Virola Alpaca Grande", sourceProducts: ["Torpedo Cuero Estampado Virola Alpaca Grande"] },
  { id: "torpedo-cuero-croco", model: "torpedo", name: "Cuero Estampado Alpaca Lisa", sourceProducts: ["Torpedo Cuero Estampado Alpaca Lisa"] },
  { id: "torpedo-liso", model: "torpedo", name: "Virola Acero Liso", sourceProducts: ["Torpedo Virola Acero Liso"] },

  { id: "criollo-clasico", model: "criollo", name: "Grande cincelado con posa mate de vaqueta", sourceProducts: ["Criollo Alpaca Grande Cincelada Posa Mate Vaqueta"], isDefault: true },
  { id: "criollo-natural-posa-cinta", model: "criollo", name: "Natural con posa mate de cinta", sourceProducts: ["Criollo Natural con Posa Mate Cinta"] },
  { id: "criollo-natural-posa-copa", model: "criollo", name: "Natural con posa mate copa", sourceProducts: ["Criollo Natural con Posa Mate Copa Virola de Acero"] },
  { id: "criollo-oscuro-posa-copa", model: "criollo", name: "Oscuro con posa mate copa", sourceProducts: ["Criollo Oscuro Posa Mate Copa"] },
  {
    id: "criollo-grande-lisa-posa-cuero-crudo",
    model: "criollo",
    name: "Alpaca Grande Lisa con posa mate de cuero crudo",
    sourceProducts: ["Criollo Alpaca Grande Lisa con Posa Mate Cuero Crudo"],
  },
  {
    id: "criollo-grande-posa-cuero-crudo",
    model: "criollo",
    name: "Grande con posa mate de cuero crudo",
    sourceProducts: ["Criollo Alpaca Grande Cincelada con Posa Mate Cuero Crudo"],
  },
  { id: "criollo-posa-cuero-crudo", model: "criollo", name: "Con posa mate de cuero crudo", sourceProducts: ["Criollo Virola de Acero con Posa Mate de Cuero Crudo"] },

  { id: "imperial-lacre", model: "imperial", name: "Cincelado Premium", sourceProducts: ["Imperial Cincelado a Lacre"], isDefault: true },
  { id: "imperial-criollo-posa-cuero-crudo", model: "imperial", name: "Imperial Criollo con Posa Mate", sourceProducts: ["Imperial Criollo con Posa Mate de Cuero Crudo"] },
  { id: "imperial-cuero-crudo", model: "imperial", name: "Cuero crudo", sourceProducts: ["Imperial Cuero Crudo"] },
  { id: "imperial-premium", model: "imperial", name: "Premium", sourceProducts: ["Imperial Premium"] },
  { id: "imperial-print", model: "imperial", name: "Print", sourceProducts: ["Imperial Print"] },
  { id: "imperial-clasico", model: "imperial", name: "Virola Plata 900", sourceProducts: ["Imperial Virola Plata 900"] },

  { id: "camionero-liso", model: "camionero", name: "Cuerpo liso", sourceProducts: ["Camionero Acero Liso"], isDefault: true },
  { id: "camionero-artesanal", model: "camionero", name: "Cuerpo artesanal", sourceProducts: ["Camionero Alpaca Cincelado"] },
  { id: "camionero-criollo-posa-vaqueta", model: "camionero", name: "Criollo con posa mate de vaqueta", sourceProducts: ["Camionero Criolla Posa con Mate Vaqueta"] },
];

const rimCompatibility: Record<string, { ids: string[]; defaultId: string }> = {
  "torpedo-clasico": { ids: ["alpaca"], defaultId: "alpaca" },
  "torpedo-cuero-crudo-grande-cincelada": { ids: ["alpaca-grande"], defaultId: "alpaca-grande" },
  "torpedo-cuero-liso-grande-lisa": { ids: ["alpaca-grande"], defaultId: "alpaca-grande" },
  "torpedo-croco-pelo-grande": { ids: ["alpaca-grande"], defaultId: "alpaca-grande" },
  "torpedo-croco-pelo": { ids: ["alpaca"], defaultId: "alpaca" },
  "torpedo-cuero-liso-alpaca-grande": { ids: ["alpaca-grande"], defaultId: "alpaca-grande" },
  "torpedo-alpaca-bronce-estampado": { ids: ["alpaca-bronce"], defaultId: "alpaca-bronce" },
  "torpedo-croco-pelo-reforzado": { ids: ["alpaca-bronce"], defaultId: "alpaca-bronce" },
  "torpedo-cuero-liso-acero-bronce": { ids: ["acero-bronce"], defaultId: "acero-bronce" },
  "torpedo-cuero-liso-alpaca-bronce": { ids: ["alpaca-bronce"], defaultId: "alpaca-bronce" },
  "torpedo-cuero-liso-alpaca-cincelada": { ids: ["alpaca"], defaultId: "alpaca" },
  "torpedo-cuero-crudo-alpaca-bronce": { ids: ["alpaca-bronce"], defaultId: "alpaca-bronce" },
  "torpedo-cuero-crudo-alpaca-cincelada": { ids: ["alpaca"], defaultId: "alpaca" },
  "torpedo-cuero-estampado-alpaca-comun": { ids: ["alpaca"], defaultId: "alpaca" },
  "torpedo-cuero-estampado-alpaca-grande": { ids: ["alpaca-grande"], defaultId: "alpaca-grande" },
  "torpedo-cuero-croco": { ids: ["alpaca-grande"], defaultId: "alpaca-grande" },
  "torpedo-liso": { ids: ["acero"], defaultId: "acero" },
  "criollo-clasico": { ids: ["alpaca-grande"], defaultId: "alpaca-grande" },
  "criollo-natural-posa-cinta": { ids: ["original"], defaultId: "original" },
  "criollo-natural-posa-copa": { ids: ["acero"], defaultId: "acero" },
  "criollo-oscuro-posa-copa": { ids: ["original"], defaultId: "original" },
  "criollo-grande-lisa-posa-cuero-crudo": { ids: ["alpaca-grande"], defaultId: "alpaca-grande" },
  "criollo-grande-posa-cuero-crudo": { ids: ["alpaca-grande"], defaultId: "alpaca-grande" },
  "criollo-posa-cuero-crudo": { ids: ["acero"], defaultId: "acero" },
  "imperial-lacre": { ids: ["original"], defaultId: "original" },
  "imperial-criollo-posa-cuero-crudo": { ids: ["original"], defaultId: "original" },
  "imperial-cuero-crudo": { ids: ["original"], defaultId: "original" },
  "imperial-premium": { ids: ["original"], defaultId: "original" },
  "imperial-print": { ids: ["original"], defaultId: "original" },
  "imperial-clasico": { ids: ["plata-900"], defaultId: "plata-900" },
  "camionero-liso": { ids: ["acero"], defaultId: "acero" },
  "camionero-artesanal": { ids: ["alpaca"], defaultId: "alpaca" },
  "camionero-criollo-posa-vaqueta": { ids: ["original"], defaultId: "original" },
};

const COLORS = {
  marron: { id: "marron", name: "Marrón", swatch: "#70452f" },
  negro: { id: "negro", name: "Negro", swatch: "#27211e" },
  natural: { id: "natural", name: "Natural", swatch: "#d8b67c" },
  crudo: { id: "cuero-crudo", name: "Cuero crudo", swatch: "#ead6ac" },
  rosa: { id: "rosa", name: "Rosa", swatch: "#cb8f96" },
  blanco: { id: "blanco", name: "Blanco", swatch: "#f4efe5" },
  print: { id: "print", name: "Print", swatch: "linear-gradient(135deg, #5f3826 0 45%, #f3e1b9 45% 55%, #2d1d14 55%)" },
} satisfies Record<string, ProductColorOption>;

export const mateSizeLabels: Record<MateSize, string> = {
  chico: "Chico",
  medio: "Medio",
  grande: "Grande",
};

export const allMateSizes: MateSize[] = ["chico", "medio", "grande"];

export function normalizeProductName(value: string): string {
  return value
    .replace(/cincelado\s+(?:a|al)\s+lacre/gi, "Cincelado Premium")
    .replace(/cuerpo\s+lacre/gi, "Cincelado Premium");
}

function getTorpedoLeatherType(name: string): TorpedoLeatherType {
  const normalized = name.toLowerCase();
  if (normalized.includes("croco") || normalized.includes("pelo")) return "croco-pelos";
  if (normalized.includes("crudo")) return "cuero-crudo";
  if (normalized.includes("estampado")) return "cuero-estampado";
  return "cuero-liso";
}

function getTorpedoRimType(name: string): TorpedoRimType {
  const normalized = name.toLowerCase();
  if (normalized.includes("alpaca y bronce") || normalized.includes("acero y bronce")) return "alpaca-bronce";
  if (normalized.includes("grande")) return "alpaca-grande";
  if (normalized.includes("alpaca")) return "alpaca-comun";
  return "otros";
}

function getVariantMetadata(variant: BaseMateVariant) {
  const name = normalizeProductName(variant.name);
  const lowerName = name.toLowerCase();
  let colors: ProductColorOption[] = [COLORS.natural];

  if (variant.id === "camionero-liso") colors = [COLORS.marron, COLORS.negro, COLORS.crudo, COLORS.natural];
  else if (variant.id === "imperial-print") colors = [COLORS.negro, COLORS.marron];
  else if (variant.id === "imperial-premium") colors = [COLORS.blanco, COLORS.marron, COLORS.negro, COLORS.rosa, COLORS.natural];
  else if (variant.model === "torpedo") {
    const leatherType = getTorpedoLeatherType(name);
    if (leatherType === "cuero-liso") colors = [COLORS.marron, COLORS.negro, COLORS.natural, COLORS.rosa];
    else if (leatherType === "croco-pelos") colors = [COLORS.print, COLORS.negro, COLORS.marron];
    else if (leatherType === "cuero-crudo") colors = [COLORS.crudo];
    else colors = [COLORS.print];
  } else if (lowerName.includes("negro") || lowerName.includes("oscuro")) colors = [COLORS.negro];
  else if (lowerName.includes("crudo")) colors = [COLORS.crudo];
  else if (lowerName.includes("marrón") || lowerName.includes("marron")) colors = [COLORS.marron];

  return {
    name,
    leatherType: variant.model === "torpedo" ? getTorpedoLeatherType(name) : "producto-terminado",
    rimType: getTorpedoRimType(name),
    colors,
    defaultColorId: colors[0].id,
    // Hasta recibir la matriz comercial, los tres tamaños conservan el precio base.
    availableSizes: [...allMateSizes],
    defaultSize: "medio" as MateSize,
    sizePriceAdjustments: { chico: 0, medio: 0, grande: 0 },
  };
}

export const mateVariants: MateVariant[] = baseMateVariants.map((variant) => {
  const compatibility = rimCompatibility[variant.id];
  if (!compatibility) throw new Error(`Falta configurar la compatibilidad de virola para ${variant.id}`);
  return {
    ...variant,
    image: getMateAssetPath(variant.id, ""),
    ...getVariantMetadata(variant),
    compatibleRimIds: compatibility.ids,
    defaultRimId: compatibility.defaultId,
  };
});

export function getVariantsByModel(model: MateModel): MateVariant[] {
  return mateVariants.filter((variant) => variant.model === model);
}

export function getDefaultVariant(model: MateModel): MateVariant {
  const variants = getVariantsByModel(model);
  const defaultVariant = variants.find((variant) => variant.isDefault) ?? variants[0];
  if (!defaultVariant) throw new Error(`No hay variantes configuradas para ${model}`);
  return defaultVariant;
}

export function getModelDefinition(model: MateModel): MateModelDefinition {
  const definition = mateModels.find((item) => item.id === model);
  if (!definition) throw new Error(`No hay configuración para ${model}`);
  return definition;
}

export function getVariantDefinition(variantId: string): MateVariant | undefined {
  return mateVariants.find((variant) => variant.id === variantId);
}

export function getDefaultColor(variant: MateVariant): ProductColorOption {
  return variant.colors.find((color) => color.id === variant.defaultColorId) ?? variant.colors[0];
}
