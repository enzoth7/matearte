export interface ProductPrice {
  nro: number;
  modelo: string;
  variante: string;
  virola: string;
  cuero?: string;
  priceARS: number;
  priceUYU: number;
}

export const rawGoogleSheetPrices: ProductPrice[] = [
  { nro: 1, modelo: "Camionero", variante: "Alpaca Cincelado", virola: "Alpaca Cincelada", priceARS: 29000, priceUYU: 786.76 },
  { nro: 2, modelo: "Camionero", variante: "Criolla Posa con Mate Vaqueta", virola: "Acero Liso", priceARS: 17500, priceUYU: 474.77 },
  { nro: 3, modelo: "Camionero", variante: "Acero Liso", virola: "Acero Liso", priceARS: 19100, priceUYU: 518.18 },
  { nro: 4, modelo: "Criollo", variante: "Natural con Posa Mate Copa Virola de Acero", virola: "Acero Liso", priceARS: 18500, priceUYU: 501.90 },
  { nro: 5, modelo: "Criollo", variante: "Virola de Acero con Posa Mate de Cuero Crudo", virola: "Acero Liso", priceARS: 22800, priceUYU: 618.56 },
  { nro: 6, modelo: "Criollo", variante: "Alpaca Grande Lisa con Posa Mate Cuero Crudo", virola: "Alpaca", priceARS: 28500, priceUYU: 773.20 },
  { nro: 7, modelo: "Criollo", variante: "Alpaca Grande Cincelada con Posa Mate Cuero Crudo", virola: "Alpaca", priceARS: 32200, priceUYU: 873.58 },
  { nro: 8, modelo: "Criollo", variante: "Natural con Posa Mate Cinta", virola: "Acero Liso", priceARS: 17100, priceUYU: 463.92 },
  { nro: 9, modelo: "Criollo", variante: "Oscuro Posa Mate Copa", virola: "Acero Liso", priceARS: 19800, priceUYU: 537.17 },
  { nro: 10, modelo: "Criollo", variante: "Alpaca Grande Cincelada Posa Mate Vaqueta", virola: "Alpaca", priceARS: 26500, priceUYU: 718.94 },
  { nro: 11, modelo: "Imperial", variante: "Cincelado Premium", virola: "Imperial", priceARS: 160000, priceUYU: 4340.75 },
  { nro: 12, modelo: "Imperial", variante: "Premium", virola: "Imperial", priceARS: 39900, priceUYU: 1082.47 },
  { nro: 13, modelo: "Imperial", variante: "Cuero Crudo", virola: "Imperial", cuero: "Crudo", priceARS: 47800, priceUYU: 1296.80 },
  { nro: 14, modelo: "Imperial", variante: "Criollo con Posa Mate de Cuero Crudo", virola: "Imperial", priceARS: 34200, priceUYU: 927.84 },
  { nro: 15, modelo: "Imperial", variante: "Virola Plata 900", virola: "Plata 900", priceARS: 500000, priceUYU: 13564.84 },
  { nro: 16, modelo: "Imperial", variante: "Print", virola: "Imperial", priceARS: 45600, priceUYU: 1237.11 },
  { nro: 17, modelo: "Torpedo", variante: "Alpaca Cincelado Premium", virola: "Alpaca Cincelado Premium", cuero: "Liso", priceARS: 90500, priceUYU: 2455.24 },
  { nro: 18, modelo: "Torpedo", variante: "Cuero Crudo Virola Grande Cincelada", virola: "Alpaca Grande Cincelada", cuero: "Crudo", priceARS: 37600, priceUYU: 1020.08 },
  { nro: 19, modelo: "Torpedo", variante: "Cuero Liso Alpaca Grande Lisa", virola: "Alpaca Grande Lisa", cuero: "Liso", priceARS: 27900, priceUYU: 756.92 },
  { nro: 20, modelo: "Torpedo", variante: "Alpaca Grande Cincelada con Cuero Croco/Pelos", virola: "Alpaca Grande Cincelada", cuero: "Croco / Pelos", priceARS: 36200, priceUYU: 982.09 },
  { nro: 21, modelo: "Torpedo", variante: "Alpaca Cuero Croco/Pelos", virola: "Alpaca Común", cuero: "Croco / Pelos", priceARS: 32800, priceUYU: 889.85 },
  { nro: 22, modelo: "Torpedo", variante: "Cuero Liso Virola Alpaca Grande", virola: "Alpaca Grande Cincelada", cuero: "Liso", priceARS: 30500, priceUYU: 827.46 },
  { nro: 23, modelo: "Torpedo", variante: "Alpaca y Bronce Cuero Estampado", virola: "Alpaca y Bronce", cuero: "Estampado", priceARS: 36400, priceUYU: 987.52 },
  { nro: 24, modelo: "Torpedo", variante: "Alpaca y Bronce Croco/Pelos", virola: "Alpaca y Bronce", cuero: "Croco / Pelos", priceARS: 39300, priceUYU: 1066.20 },
  { nro: 25, modelo: "Torpedo", variante: "Cuero Liso Virola Acero y Bronce Liso", virola: "Acero y Bronce Liso", cuero: "Liso", priceARS: 20700, priceUYU: 561.58 },
  { nro: 26, modelo: "Torpedo", variante: "Cuero Liso Alpaca y Bronce", virola: "Alpaca y Bronce", cuero: "Liso", priceARS: 33600, priceUYU: 911.56 },
  { nro: 27, modelo: "Torpedo", variante: "Cuero Liso Alpaca Cincelada", virola: "Alpaca Cincelada", cuero: "Liso", priceARS: 27100, priceUYU: 735.21 },
  { nro: 28, modelo: "Torpedo", variante: "Cuero Crudo Virola Alpaca y Bronce", virola: "Alpaca y Bronce", cuero: "Crudo", priceARS: 38700, priceUYU: 1049.92 },
  { nro: 29, modelo: "Torpedo", variante: "Cuero Crudo Virola Alpaca Cincelada", virola: "Alpaca Cincelada", cuero: "Crudo", priceARS: 34200, priceUYU: 927.84 },
  { nro: 30, modelo: "Torpedo", variante: "Cuero Estampado Virola Alpaca Comun", virola: "Alpaca Cincelada", cuero: "Estampado", priceARS: 31900, priceUYU: 865.44 },
  { nro: 31, modelo: "Torpedo", variante: "Cuero Estampado Virola Alpaca Grande", virola: "Alpaca Grande Cincelada", cuero: "Estampado", priceARS: 31600, priceUYU: 857.30 },
  { nro: 32, modelo: "Torpedo", variante: "Cuero Estampado Alpaca Lisa", virola: "Alpaca Grande Lisa", cuero: "Estampado", priceARS: 26900, priceUYU: 729.79 },
  { nro: 33, modelo: "Torpedo", variante: "Virola Acero Liso", virola: "Acero Liso", cuero: "Liso", priceARS: 17100, priceUYU: 463.92 },
  { nro: 34, modelo: "Bombilla", variante: "Con Aplique", virola: "-", priceARS: 14900, priceUYU: 404.23 },
  { nro: 35, modelo: "Bombillón", variante: "Alpaca", virola: "-", priceARS: 11500, priceUYU: 311.99 },
  { nro: 36, modelo: "Bombillón", variante: "Pico de Loro", virola: "-", priceARS: 13700, priceUYU: 371.68 },
  { nro: 37, modelo: "Bombillón", variante: "Con Aros", virola: "-", priceARS: 14800, priceUYU: 401.52 },
  { nro: 38, modelo: "Bombillón", variante: "Campeón del Mundo", virola: "-", priceARS: 28000, priceUYU: 759.63 },
  { nro: 39, modelo: "Bombilla", variante: "Cincelada", virola: "-", priceARS: 13700, priceUYU: 371.68 },
];

/**
 * Mapeo explícito por ID de Variante del configurador.
 */
export const variantPriceMap: Record<string, { priceARS: number; priceUYU: number }> = {
  // Camionero
  "camionero-artesanal": { priceARS: 29000, priceUYU: 787 },
  "camionero-criollo-posa-vaqueta": { priceARS: 17500, priceUYU: 475 },
  "camionero-liso": { priceARS: 19100, priceUYU: 518 },

  // Criollo
  "criollo-clasico": { priceARS: 26500, priceUYU: 719 },
  "criollo-natural-posa-cinta": { priceARS: 17100, priceUYU: 464 },
  "criollo-natural-posa-copa": { priceARS: 18500, priceUYU: 502 },
  "criollo-oscuro-posa-copa": { priceARS: 19800, priceUYU: 537 },
  "criollo-grande-lisa-posa-cuero-crudo": { priceARS: 28500, priceUYU: 773 },
  "criollo-grande-posa-cuero-crudo": { priceARS: 32200, priceUYU: 874 },
  "criollo-posa-cuero-crudo": { priceARS: 22800, priceUYU: 619 },

  // Imperial
  "imperial-lacre": { priceARS: 160000, priceUYU: 4341 },
  "imperial-criollo-posa-cuero-crudo": { priceARS: 34200, priceUYU: 928 },
  "imperial-cuero-crudo": { priceARS: 47800, priceUYU: 1297 },
  "imperial-premium": { priceARS: 39900, priceUYU: 1082 },
  "imperial-print": { priceARS: 45600, priceUYU: 1237 },
  "imperial-clasico": { priceARS: 500000, priceUYU: 13565 },

  // Torpedo (17 variantes)
  "torpedo-clasico": { priceARS: 90500, priceUYU: 2455 },
  "torpedo-cuero-crudo-grande-cincelada": { priceARS: 37600, priceUYU: 1020 },
  "torpedo-cuero-liso-grande-lisa": { priceARS: 27900, priceUYU: 757 },
  "torpedo-croco-pelo-grande": { priceARS: 36200, priceUYU: 982 },
  "torpedo-croco-pelo": { priceARS: 32800, priceUYU: 890 },
  "torpedo-cuero-liso-alpaca-grande": { priceARS: 30500, priceUYU: 827 },
  "torpedo-alpaca-bronce-estampado": { priceARS: 36400, priceUYU: 988 },
  "torpedo-croco-pelo-reforzado": { priceARS: 39300, priceUYU: 1066 },
  "torpedo-cuero-liso-acero-bronce": { priceARS: 20700, priceUYU: 562 },
  "torpedo-cuero-liso-alpaca-bronce": { priceARS: 33600, priceUYU: 912 },
  "torpedo-cuero-liso-alpaca-cincelada": { priceARS: 27100, priceUYU: 735 },
  "torpedo-cuero-crudo-alpaca-bronce": { priceARS: 38700, priceUYU: 1050 },
  "torpedo-cuero-crudo-alpaca-cincelada": { priceARS: 34200, priceUYU: 928 },
  "torpedo-cuero-estampado-alpaca-comun": { priceARS: 31900, priceUYU: 865 },
  "torpedo-cuero-estampado-alpaca-grande": { priceARS: 31600, priceUYU: 857 },
  "torpedo-cuero-croco": { priceARS: 26900, priceUYU: 730 },
  "torpedo-liso": { priceARS: 17100, priceUYU: 464 },
};

/**
 * Precios base de referencia por modelo (para mostrar un "Desde $X" en la selección)
 */
export const modelStartingPriceMap: Record<string, { priceARS: number; priceUYU: number }> = {
  camionero: { priceARS: 17500, priceUYU: 475 },
  criollo: { priceARS: 17100, priceUYU: 464 },
  imperial: { priceARS: 34200, priceUYU: 928 },
  torpedo: { priceARS: 17100, priceUYU: 464 },
};

export const customizationPrices: Record<string, number> = {
  rim_finish: 100,
  rim_text: 150,
  rim_image: 400,
  fleje_finish: 100,
  fleje_text: 150,
  fleje_image: 500,
};

const requiredCustomizationPrices: Record<string, number> = {
  rim_text: 150,
  rim_image: 400,
  fleje_text: 150,
  fleje_image: 500,
};

export const mercadoPagoCommissionPercent = Math.max(
  0,
  Number(import.meta.env.VITE_MERCADO_PAGO_COMMISSION_PERCENT ?? 0) || 0,
);

export function updateCustomizationPrice(id: string, priceUYU: number) {
  customizationPrices[id] = requiredCustomizationPrices[id] ?? priceUYU;
}

export function getCustomizationPrice(id: string): number {
  return customizationPrices[id] ?? 0;
}

export interface VariantDetails {
  name: string;
  virola: string;
  tipoCuero: string;
}

export const variantDetailsMap: Record<string, VariantDetails> = {};

export function updateVariantDetails(id: string, details: Partial<VariantDetails>) {
  variantDetailsMap[id] = {
    name: normalizeProductName(details.name || variantDetailsMap[id]?.name || ""),
    virola: details.virola || variantDetailsMap[id]?.virola || "",
    tipoCuero: details.tipoCuero || variantDetailsMap[id]?.tipoCuero || "",
  };
}

export function getVariantDetails(id: string): VariantDetails | undefined {
  return variantDetailsMap[id];
}

export function updateVariantPrice(id: string, priceARS: number, priceUYU: number) {
  variantPriceMap[id] = { priceARS, priceUYU };
}

export function getVariantPrice(variantId: string, size: MateSize = "medio") {
  const basePrice = variantPriceMap[variantId] || { priceARS: 0, priceUYU: 0 };
  const adjustmentUYU = getVariantDefinition(variantId)?.sizePriceAdjustments[size] ?? 0;
  const price = { ...basePrice, priceUYU: basePrice.priceUYU + adjustmentUYU };
  return {
    ...price,
    formattedUYU: `$ ${price.priceUYU.toLocaleString('es-UY')} UYU`,
    formattedARS: `$ ${price.priceARS.toLocaleString('es-AR')} ARS`,
  };
}

export interface OrderPriceItem {
  id: string;
  label: string;
  quantity: number;
  unitPriceUYU: number;
  totalUYU: number;
}

export interface OrderPricing {
  basePriceUYU: number;
  items: OrderPriceItem[];
  extrasUYU: number;
  totalUYU: number;
}

export function calculateOrderPricing(
  configuration: MateConfiguration,
  flejeConfig: FlejeCustomization,
): OrderPricing {
  const basePriceUYU = getVariantPrice(configuration.variantId, configuration.size).priceUYU;
  const model = getModelDefinition(configuration.modelId);
  const items: OrderPriceItem[] = [];

  const addItem = (id: string, label: string, quantity = 1) => {
    if (quantity <= 0) return;
    const unitPriceUYU = getCustomizationPrice(id);
    items.push({ id, label, quantity, unitPriceUYU, totalUYU: unitPriceUYU * quantity });
  };

  if (configuration.rim.finishMode === "finish") addItem("rim_finish", "Terminación de virola");
  if (configuration.rim.textMode === "text" && configuration.rim.text.trim()) addItem("rim_text", "Texto en virola");
  if (configuration.rim.imageMode === "image" && configuration.rim.icons.length > 0) addItem("rim_image", "Imagen o escudo en virola");

  if (model.hasFleje) {
    if (flejeConfig.finishMode === "finish") addItem("fleje_finish", "Terminación de fleje");
    const sides = Object.values(flejeConfig.sides);
    const textCount = sides.filter((side) => side.textMode === "text" && side.text.trim()).length;
    const imageCount = sides.filter((side) => side.imageMode === "image" && side.selectedImageId).length;
    addItem("fleje_text", "Texto en fleje", textCount);
    addItem("fleje_image", "Imagen o escudo en fleje", imageCount);
  }

  const extrasUYU = items.reduce((total, item) => total + item.totalUYU, 0);
  return { basePriceUYU, items, extrasUYU, totalUYU: basePriceUYU + extrasUYU };
}

export function getModelStartingPrice(modelId: string) {
  const price = modelStartingPriceMap[modelId] || { priceARS: 0, priceUYU: 0 };
  return {
    ...price,
    formattedUYU: `$ ${price.priceUYU.toLocaleString('es-UY')} UYU`,
    formattedARS: `$ ${price.priceARS.toLocaleString('es-AR')} ARS`,
  };
}
import { getModelDefinition, getVariantDefinition, normalizeProductName, type MateSize } from "./mateCatalog";
import type { FlejeCustomization, MateConfiguration } from "../types/customizer";
