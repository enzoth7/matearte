import type { Locale } from "@/types/catalog";
import type { CatalogAttributeDetail } from "../../../shared/catalog-taxonomy";
import { specLabel, specValue } from "@/lib/product-spec-labels";

export type ProductDescriptionInput = {
  name: string;
  category: string;
  details: CatalogAttributeDetail[];
  /** Colores ya traducidos a texto. */
  colors: string[];
  madeToOrder: boolean;
};

/** Categorías de reventa: no se afirma que MateArte las elabore. */
const notMadeByMateArte = new Set(["termos"]);

const copy: Record<Locale, { madeToOrder: string; features: string; colors: string }> = {
  es: { madeToOrder: "Se elabora por encargo.", features: "Características", colors: "Colores" },
  en: { madeToOrder: "Made to order.", features: "Specifications", colors: "Colors" },
  pt: { madeToOrder: "Feito sob encomenda.", features: "Características", colors: "Cores" },
};

/** Características que no describen el producto: "todos" es un eje de variante y el tipo repite la categoría. */
const skippedCodes = new Set(["color", "tipo-personalizado"]);

/** Orden en que se listan las características: primero lo que identifica al producto. */
const featureOrder = [
  "tipo-mate", "tipo-bombilla", "forma", "material-mate", "material", "material-cuerpo", "tipo-virola", "tipo-cuero",
  "diseno-fleje", "decoracion", "material-pico", "forma-pico", "pie", "posamate", "interior", "tamano", "coleccion",
  "genero", "talle", "capacidad-ml", "diametro-cano-mm", "largo-mm", "largo-cinto-cm", "tipo-cierre",
];

function featureRank(code: string) {
  const index = featureOrder.indexOf(code);
  return index === -1 ? featureOrder.length : index;
}

function featureText(detail: CatalogAttributeDetail, locale: Locale, category: string) {
  if (skippedCodes.has(detail.code) || detail.rawValue === "todos") return null;
  const value = detail.values.map(item => specValue(item, locale)).filter(Boolean).join(", ");
  if (!value) return null;
  return `${specLabel(detail.code, detail.label, locale, category)}: ${value}`;
}

/**
 * Texto de respaldo para metadatos y datos estructurados de productos sin descripción en Gestión.
 * No se muestra en la ficha: la descripción visible es la que se carga en Gestión.
 */
export function buildProductDescription(input: ProductDescriptionInput, locale: Locale) {
  const text = copy[locale];
  const order = input.madeToOrder ? text.madeToOrder : "";
  const features = input.details
    .map((detail, index) => ({ detail, index }))
    .sort((left, right) => featureRank(left.detail.code) - featureRank(right.detail.code) || left.index - right.index)
    .map(({ detail }) => featureText(detail, locale, input.category))
    .filter((item): item is string => Boolean(item));
  const colors = input.colors.map(color => specValue(color, locale)).filter(Boolean);

  const description = [
    `${input.name.trim()}.`,
    order,
    features.length ? `${text.features}: ${features.join("; ")}.` : "",
    colors.length ? `${text.colors}: ${colors.join(", ")}.` : "",
  ].filter(Boolean).join(" ");

  return { summary: "", description };
}

/** Recorta a un largo de meta description sin cortar palabras. */
export function truncateForMeta(text: string, max = 155) {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const slice = clean.slice(0, max - 1);
  // Se prefiere cortar al final de una oración solo si aprovecha casi todo el largo; si no, entre características.
  const sentenceEnd = slice.lastIndexOf(". ");
  if (sentenceEnd >= max - 35) return slice.slice(0, sentenceEnd + 1);
  const featureEnd = slice.lastIndexOf("; ");
  if (featureEnd >= max - 55) return `${slice.slice(0, featureEnd)}…`;
  const wordEnd = slice.lastIndexOf(" ");
  return `${slice.slice(0, wordEnd > 0 ? wordEnd : slice.length).replace(/[;,:.\s]+$/, "")}…`;
}

/** Las piezas de reventa no se presentan como producción propia. */
export function isMadeByMateArte(category: string) {
  return !notMadeByMateArte.has(category);
}
