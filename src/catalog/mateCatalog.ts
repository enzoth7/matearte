export type MateModel = "torpedo" | "criollo" | "imperial" | "camionero";

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
}

type BaseMateVariant = Omit<MateVariant, "compatibleRimIds" | "defaultRimId">;

export interface MateModelDefinition {
  id: MateModel;
  name: string;
  hasFleje: boolean;
  engravingArea: EngravingArea | null;
}

const CATALOG_PATH = "/assets/catalogo/0. PNG";

export const mateModels: MateModelDefinition[] = [
  { id: "torpedo", name: "Torpedo", hasFleje: true, engravingArea: { x: 33, y: 21, width: 34, height: 12 } },
  { id: "criollo", name: "Criollo", hasFleje: true, engravingArea: { x: 27, y: 26, width: 46, height: 12 } },
  { id: "imperial", name: "Imperial", hasFleje: true, engravingArea: { x: 27, y: 26, width: 46, height: 12 } },
  { id: "camionero", name: "Camionero", hasFleje: false, engravingArea: null },
];

const baseMateVariants: BaseMateVariant[] = [
  { id: "torpedo-clasico", model: "torpedo", name: "Alpaca Cincelado al Lacre", image: `${CATALOG_PATH}/Torpedo Alpaca Cincelado al Lacre.png`, sourceProducts: ["Torpedo Alpaca Cincelado al Lacre"], isDefault: true },
  { id: "torpedo-cuero-crudo-grande-cincelada", model: "torpedo", name: "Cuero Crudo Virola Grande Cincelada", image: `${CATALOG_PATH}/Torpedo Cuero Crudo Virola Grande Cincelada.png`, sourceProducts: ["Torpedo Cuero Crudo Virola Grande Cincelada"] },
  { id: "torpedo-cuero-liso-grande-lisa", model: "torpedo", name: "Cuero Liso Alpaca Grande Lisa", image: `${CATALOG_PATH}/Torpedo Cuero Liso Alpaca Grande Lisa.png`, sourceProducts: ["Torpedo Cuero Liso Alpaca Grande Lisa"] },
  { id: "torpedo-croco-pelo-grande", model: "torpedo", name: "Alpaca Grande Cincelada con Cuero Croco/Pelos", image: `${CATALOG_PATH}/Torpedo Alpaca Grande Cincelada con Cuero Croco Pelos.png`, sourceProducts: ["Torpedo Alpaca Grande Cincelada con Cuero Croco Pelos"] },
  { id: "torpedo-croco-pelo", model: "torpedo", name: "Alpaca Cuero Croco/Pelos", image: `${CATALOG_PATH}/Torpedo Alpaca Cuero Croco Pelos.png`, sourceProducts: ["Torpedo Alpaca Cuero Croco Pelos"] },
  { id: "torpedo-cuero-liso-alpaca-grande", model: "torpedo", name: "Cuero Liso Virola Alpaca Grande", image: `${CATALOG_PATH}/Torpedo Cuero Liso Virola Alpaca Grande.png`, sourceProducts: ["Torpedo Cuero Liso Virola Alpaca Grande"] },
  { id: "torpedo-alpaca-bronce-estampado", model: "torpedo", name: "Alpaca y Bronce Cuero Estampado", image: `${CATALOG_PATH}/Torpedo Alpaca y Bronce Cuero Estampado.png`, sourceProducts: ["Torpedo Alpaca y Bronce Cuero Estampado"] },
  { id: "torpedo-croco-pelo-reforzado", model: "torpedo", name: "Alpaca y Bronce Croco/Pelos", image: `${CATALOG_PATH}/Torpedo Alpaca y Bronce Croco Pelos.png`, sourceProducts: ["Torpedo Alpaca y Bronce Croco Pelos"] },
  { id: "torpedo-cuero-liso-acero-bronce", model: "torpedo", name: "Cuero Liso Virola Acero y Bronce Liso", image: `${CATALOG_PATH}/Torpedo Cuero Liso Virola Acero y Bronce Liso.png`, sourceProducts: ["Torpedo Cuero Liso Virola Acero y Bronce Liso"] },
  { id: "torpedo-cuero-liso-alpaca-bronce", model: "torpedo", name: "Cuero Liso Alpaca y Bronce", image: `${CATALOG_PATH}/Torpedo Cuero Liso Alpaca y Bronce.png`, sourceProducts: ["Torpedo Cuero Liso Alpaca y Bronce"] },
  { id: "torpedo-cuero-liso-alpaca-cincelada", model: "torpedo", name: "Cuero Liso Alpaca Cincelada", image: `${CATALOG_PATH}/Torpedo Cuero Liso Alpaca Cincelada.png`, sourceProducts: ["Torpedo Cuero Liso Alpaca Cincelada"] },
  { id: "torpedo-cuero-crudo-alpaca-bronce", model: "torpedo", name: "Cuero Crudo Virola Alpaca y Bronce", image: `${CATALOG_PATH}/Torpedo Cuero Crudo Virola Alpaca y Bronce.png`, sourceProducts: ["Torpedo Cuero Crudo Virola Alpaca y Bronce"] },
  { id: "torpedo-cuero-crudo-alpaca-cincelada", model: "torpedo", name: "Cuero Crudo Virola Alpaca Cincelada", image: `${CATALOG_PATH}/Torpedo Cuero Crudo Virola Alpaca Cincelada.png`, sourceProducts: ["Torpedo Cuero Crudo Virola Alpaca Cincelada"] },
  { id: "torpedo-cuero-estampado-alpaca-comun", model: "torpedo", name: "Cuero Estampado Virola Alpaca Comun", image: `${CATALOG_PATH}/Torpedo Cuero Estampado Virola Alpaca Comun.png`, sourceProducts: ["Torpedo Cuero Estampado Virola Alpaca Comun"] },
  { id: "torpedo-cuero-estampado-alpaca-grande", model: "torpedo", name: "Cuero Estampado Virola Alpaca Grande", image: `${CATALOG_PATH}/Torpedo Cuero Estampado Virola Alpaca Grande.png`, sourceProducts: ["Torpedo Cuero Estampado Virola Alpaca Grande"] },
  { id: "torpedo-cuero-croco", model: "torpedo", name: "Cuero Estampado Alpaca Lisa", image: `${CATALOG_PATH}/Torpedo Cuero Estampado Alpaca Lisa.png`, sourceProducts: ["Torpedo Cuero Estampado Alpaca Lisa"] },
  { id: "torpedo-liso", model: "torpedo", name: "Virola Acero Liso", image: `${CATALOG_PATH}/Torpedo Virola Acero Liso.png`, sourceProducts: ["Torpedo Virola Acero Liso"] },

  { id: "criollo-clasico", model: "criollo", name: "Grande cincelado con posa mate de vaqueta", image: `${CATALOG_PATH}/Criollo Alpaca Grande Cincelada Posa Mate Vaqueta.png`, sourceProducts: ["Criollo Alpaca Grande Cincelada Posa Mate Vaqueta"], isDefault: true },
  { id: "criollo-natural-posa-cinta", model: "criollo", name: "Natural con posa mate de cinta", image: `${CATALOG_PATH}/Criollo Natural con Posa Mate Cinta.png`, sourceProducts: ["Criollo Natural con Posa Mate Cinta"] },
  { id: "criollo-natural-posa-copa", model: "criollo", name: "Natural con posa mate copa", image: `${CATALOG_PATH}/Criollo Natural con Posa Mate Copa Virola de Acero.png`, sourceProducts: ["Criollo Natural con Posa Mate Copa Virola de Acero"] },
  { id: "criollo-oscuro-posa-copa", model: "criollo", name: "Oscuro con posa mate copa", image: `${CATALOG_PATH}/Criollo Oscuro Posa Mate Copa.png`, sourceProducts: ["Criollo Oscuro Posa Mate Copa"] },
  {
    id: "criollo-grande-lisa-posa-cuero-crudo",
    model: "criollo",
    name: "Alpaca Grande Lisa con posa mate de cuero crudo",
    image: `${CATALOG_PATH}/Criollo Alpaca Grande Lisa con Posa Mate Cuero Crudo.png`,
    sourceProducts: ["Criollo Alpaca Grande Lisa con Posa Mate Cuero Crudo"],
  },
  {
    id: "criollo-grande-posa-cuero-crudo",
    model: "criollo",
    name: "Grande con posa mate de cuero crudo",
    image: `${CATALOG_PATH}/Criollo Alpaca Grande Cincelada con Posa Mate Cuero Crudo.png`,
    sourceProducts: ["Criollo Alpaca Grande Cincelada con Posa Mate Cuero Crudo"],
  },
  { id: "criollo-posa-cuero-crudo", model: "criollo", name: "Con posa mate de cuero crudo", image: `${CATALOG_PATH}/Criollo Virola de Acero con Posa Mate de Cuero Crudo.png`, sourceProducts: ["Criollo Virola de Acero con Posa Mate de Cuero Crudo"] },

  { id: "imperial-lacre", model: "imperial", name: "Cuerpo lacre", image: `${CATALOG_PATH}/Imperial Cincelado a Lacre.png`, sourceProducts: ["Imperial Cincelado a Lacre"], isDefault: true },
  { id: "imperial-criollo-posa-cuero-crudo", model: "imperial", name: "Criollo con posa mate de cuero crudo", image: `${CATALOG_PATH}/Imperial Criollo con Posa Mate de Cuero Crudo.png`, sourceProducts: ["Imperial Criollo con Posa Mate de Cuero Crudo"] },
  { id: "imperial-cuero-crudo", model: "imperial", name: "Cuero crudo", image: `${CATALOG_PATH}/Imperial Cuero Crudo.png`, sourceProducts: ["Imperial Cuero Crudo"] },
  { id: "imperial-premium", model: "imperial", name: "Premium", image: `${CATALOG_PATH}/Imperial Premium.png`, sourceProducts: ["Imperial Premium"] },
  { id: "imperial-print", model: "imperial", name: "Print", image: `${CATALOG_PATH}/Imperial Print.png`, sourceProducts: ["Imperial Print"] },
  { id: "imperial-clasico", model: "imperial", name: "Virola Plata 900", image: `${CATALOG_PATH}/Imperial Virola Plata 900.png`, sourceProducts: ["Imperial Virola Plata 900"] },

  { id: "camionero-liso", model: "camionero", name: "Cuerpo liso", image: `${CATALOG_PATH}/Camionero Acero Liso.png`, sourceProducts: ["Camionero Acero Liso"], isDefault: true },
  { id: "camionero-artesanal", model: "camionero", name: "Cuerpo artesanal", image: `${CATALOG_PATH}/Camionero Alpaca Cincelado.png`, sourceProducts: ["Camionero Alpaca Cincelado"] },
  { id: "camionero-criollo-posa-vaqueta", model: "camionero", name: "Criollo con posa mate de vaqueta", image: `${CATALOG_PATH}/Camionero Criolla Posa con Mate Vaqueta.png`, sourceProducts: ["Camionero Criolla Posa con Mate Vaqueta"] },
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

export const mateVariants: MateVariant[] = baseMateVariants.map((variant) => {
  const compatibility = rimCompatibility[variant.id];
  if (!compatibility) throw new Error(`Falta configurar la compatibilidad de virola para ${variant.id}`);
  return { ...variant, compatibleRimIds: compatibility.ids, defaultRimId: compatibility.defaultId };
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
