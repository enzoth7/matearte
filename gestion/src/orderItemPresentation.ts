import {
  catalogAttributeLabel,
  catalogColorIds,
  catalogValueLabel,
  defaultCatalogTaxonomy,
} from "../../shared/catalog-taxonomy";
import type { OrderLine } from "./data";

type PresentableItem = Pick<OrderLine, "title" | "productName" | "variant" | "rim" | "leather" | "sku" | "options">;

const clean = (value: unknown) => typeof value === "string" ? value.trim() : "";
const normalized = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es");

export function orderColorLabel(value: string) {
  const candidate = clean(value);
  const color = catalogColorIds.find((id) => normalized(id) === normalized(candidate) || normalized(catalogValueLabel(defaultCatalogTaxonomy, "color", id)) === normalized(candidate));
  return color ? catalogValueLabel(defaultCatalogTaxonomy, "color", color) : candidate;
}

export function orderSizeLabel(value: string) {
  const candidate = clean(value);
  return candidate ? catalogValueLabel(defaultCatalogTaxonomy, "tamano", candidate) : "";
}

export function orderItemColor(item: PresentableItem) {
  const detail = orderItemDetailRows(item).find((row) => normalized(row.label) === "color");
  if (detail) return orderColorLabel(detail.value);
  const variant = clean(item.variant).split(/\s*[·—–]\s*/u)[0];
  const label = orderColorLabel(variant);
  if (catalogColorIds.some((id) => normalized(catalogValueLabel(defaultCatalogTaxonomy, "color", id)) === normalized(label))) return label;
  const matches = catalogColorIds.filter((id) => {
    const name = normalized(catalogValueLabel(defaultCatalogTaxonomy, "color", id));
    return new RegExp(`(?:^|\\W)${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:$|\\W)`, "u").test(normalized(variant));
  });
  return matches.length === 1 ? catalogValueLabel(defaultCatalogTaxonomy, "color", matches[0]) : "—";
}

export function compactOrderItemName(item: Pick<PresentableItem, "title" | "productName">) {
  const explicitName = clean(item.productName);
  if (explicitName) return explicitName;
  const title = clean(item.title);
  if (!title) return "Producto sin nombre";
  return title
    .replace(/\s+[—–]\s+.*$/u, "")
    .replace(/\s+·\s+(?:color|tama(?:ñ|n)o|talle|variante)\b.*$/iu, "")
    .trim() || title;
}

export function orderItemDetailRows(item: PresentableItem) {
  const rows: { label: string; value: string }[] = [];
  const seen = new Set<string>();
  const add = (label: string, value: unknown) => {
    const text = clean(value);
    if (!text || /^(sin especificar|sin variantes)$/i.test(text)) return;
    const key = `${normalized(label)}\u0000${normalized(text)}`;
    if (seen.has(key)) return;
    seen.add(key);
    rows.push({ label, value: text });
  };

  const optionValues = Object.entries(item.options || {})
    .filter(([key, value]) => !key.startsWith("cover_") && value !== "" && value != null)
    .map(([key, value]) => ({
      key,
      label: catalogAttributeLabel(defaultCatalogTaxonomy, key),
      value: catalogValueLabel(defaultCatalogTaxonomy, key, value as string | number | boolean),
    }));
  const normalizedOptionValues = new Set(optionValues.map((option) => normalized(option.value)));
  const variant = clean(item.variant);
  if (variant && !normalizedOptionValues.has(normalized(variant))) add("Variante", variant);
  for (const option of optionValues) add(option.label, option.value);
  if (!Object.keys(item.options || {}).some((key) => ["virola", "rim"].includes(normalized(key)))) add("Virola", item.rim);
  if (!Object.keys(item.options || {}).some((key) => ["cuero", "leather"].includes(normalized(key)))) add("Cuero", item.leather);
  add("SKU", item.sku);
  return rows;
}
