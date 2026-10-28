import { catalogValueLabel, defaultCatalogTaxonomy } from "../../shared/catalog-taxonomy";

export type SaleProductSearchFields = {
  name: string;
  sku?: string | null;
  variant?: string | null;
  category?: string | null;
  description?: string | null;
  material?: string | null;
  rim?: string | null;
  attributes?: Record<string, unknown>;
  options?: Record<string, unknown>;
  price?: number;
};

const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es");
const priceFormatter = new Intl.NumberFormat("es-UY", { maximumFractionDigits: 2 });

const catalogTerms = (values?: Record<string, unknown>) => Object.entries(values || {}).flatMap(([code, value]) => {
  const entries = Array.isArray(value) ? value : [value];
  return entries.flatMap((entry) => typeof entry === "string" || typeof entry === "number"
    ? [String(entry), catalogValueLabel(defaultCatalogTaxonomy, code, String(entry))]
    : []);
});

export function matchesSaleProductSearch(fields: SaleProductSearchFields, query: string) {
  const terms = normalize(query.trim()).split(/\s+/).filter(Boolean);
  if (!terms.length) return false;
  const price = fields.price !== undefined && Number.isFinite(fields.price) ? fields.price : undefined;
  const searchable = normalize([
    fields.name, fields.sku, fields.variant, fields.category, fields.description, fields.material, fields.rim,
    ...catalogTerms(fields.attributes), ...catalogTerms(fields.options),
    ...(price === undefined ? [] : [String(price), priceFormatter.format(price)]),
  ].filter(Boolean).join(" "));
  return terms.every((term) => searchable.includes(term));
}
