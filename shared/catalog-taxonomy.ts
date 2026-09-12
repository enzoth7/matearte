/** Stable storage/query contracts shared by Commerce Admin and the storefront. */
export const catalogCategoryIds = [
  "mates", "bombillas", "termos", "materas", "kits-materos", "cuchillos",
  "calzado", "botas", "marroquineria", "cintos", "billeteras", "carteras",
] as const;
export const catalogMaterialIds = ["cuero", "plata", "alpaca", "acero-inoxidable", "otros-metales", "madera", "estampado"] as const;
export const catalogProductTypeIds = ["imperial", "camionero", "criollo", "torpedo"] as const;
export const catalogColorIds = ["marron", "negro", "natural", "cuero-crudo", "rojo", "blanco", "rosado", "gris", "dorado", "celeste", "azul", "beige", "metalico"] as const;

export type CatalogCategoryId = (typeof catalogCategoryIds)[number];
export type CatalogMaterialId = (typeof catalogMaterialIds)[number];
export type CatalogProductTypeId = (typeof catalogProductTypeIds)[number];
export type CatalogColorId = (typeof catalogColorIds)[number];
export type CatalogValue = string | number | boolean;
export type CatalogValueMap = Record<string, CatalogValue>;
export type CatalogAttributeDataType = "enum" | "number" | "boolean" | "text";
export type CatalogAttributeInputStyle = "select" | "swatch" | "buttons" | "number" | "checkbox" | "text";
export type CatalogAttributeScope = "product" | "variant";

export type CatalogCategoryDefinition = { code: string; label_es: string; parent_code: string | null; active: boolean; sort_order: number };
export type CatalogAttributeDefinition = { code: string; label_es: string; data_type: CatalogAttributeDataType; unit: string | null; input_style: CatalogAttributeInputStyle; active: boolean; sort_order: number };
export type CatalogAttributeOption = { attribute_code: string; code: string; label_es: string; swatch_hex: string | null; active: boolean; sort_order: number };
export type CatalogCategoryAttribute = { category_code: string; attribute_code: string; scope: CatalogAttributeScope; required: boolean; filterable: boolean; sort_order: number };
export type CatalogTaxonomy = { categories: CatalogCategoryDefinition[]; attributes: CatalogAttributeDefinition[]; options: CatalogAttributeOption[]; rules: CatalogCategoryAttribute[] };

/** Legacy filter shape retained during the additive migration. */
export type CatalogAttributes = { materials: CatalogMaterialId[]; productTypes: CatalogProductTypeId[]; finishes: string[]; colors: CatalogColorId[] };
export const emptyCatalogAttributes = (): CatalogAttributes => ({ materials: [], productTypes: [], finishes: [], colors: [] });

function isOneOf<T extends readonly string[]>(value: unknown, values: T): value is T[number] {
  return typeof value === "string" && (values as readonly string[]).includes(value);
}
function knownValues<T extends readonly string[]>(value: unknown, values: T): T[number][] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is T[number] => isOneOf(item, values)))];
}
export function normalizeCatalogAttributes(value: unknown): CatalogAttributes {
  if (!value || typeof value !== "object" || Array.isArray(value)) return emptyCatalogAttributes();
  const record = value as Record<string, unknown>;
  return {
    materials: knownValues(record.materials, catalogMaterialIds),
    productTypes: knownValues(record.productTypes, catalogProductTypeIds),
    finishes: Array.isArray(record.finishes) ? record.finishes.filter((item): item is string => typeof item === "string") : [],
    colors: knownValues(record.colors, catalogColorIds),
  };
}
export function normalizeCatalogValueMap(value: unknown): CatalogValueMap {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, CatalogValue] => ["string", "number", "boolean"].includes(typeof entry[1])));
}
export function canonicalCategoryCode(value: string) {
  return ({ bombillones: "bombillas", "kit-matero": "kits-materos", cuchillo: "cuchillos" } as Record<string, string>)[value] ?? value;
}
export function taxonomyRulesForCategory(taxonomy: CatalogTaxonomy, categoryCode: string, scope?: CatalogAttributeScope) {
  const lineage: string[] = [];
  let current: string | null = canonicalCategoryCode(categoryCode);
  const visited = new Set<string>();
  while (current && !visited.has(current)) {
    visited.add(current); lineage.unshift(current);
    current = taxonomy.categories.find(category => category.code === current)?.parent_code ?? null;
  }
  const byAttribute = new Map<string, CatalogCategoryAttribute>();
  taxonomy.rules.filter(rule => lineage.includes(rule.category_code) && (!scope || rule.scope === scope))
    .sort((a, b) => lineage.indexOf(a.category_code) - lineage.indexOf(b.category_code))
    .forEach(rule => byAttribute.set(`${rule.scope}:${rule.attribute_code}`, rule));
  return [...byAttribute.values()].sort((a, b) => a.sort_order - b.sort_order || a.attribute_code.localeCompare(b.attribute_code));
}
export function taxonomyOptionsFor(taxonomy: CatalogTaxonomy, attributeCode: string) {
  return taxonomy.options.filter(option => option.attribute_code === attributeCode && option.active)
    .sort((a, b) => a.sort_order - b.sort_order || a.label_es.localeCompare(b.label_es, "es"));
}
export function catalogAttributeLabel(taxonomy: CatalogTaxonomy, attributeCode: string) {
  return taxonomy.attributes.find(attribute => attribute.code === attributeCode)?.label_es ?? attributeCode;
}
export function catalogValueLabel(taxonomy: CatalogTaxonomy, attributeCode: string, value: CatalogValue) {
  const option = taxonomy.options.find(item => item.attribute_code === attributeCode && item.code === String(value));
  const unit = taxonomy.attributes.find(item => item.code === attributeCode)?.unit;
  return `${option?.label_es ?? String(value)}${unit ? ` ${unit}` : ""}`;
}
export function formatVariantLabel(taxonomy: CatalogTaxonomy, categoryCode: string, optionValues: CatalogValueMap) {
  const labels = taxonomyRulesForCategory(taxonomy, categoryCode, "variant")
    .filter(rule => optionValues[rule.attribute_code] !== undefined && optionValues[rule.attribute_code] !== "")
    .map(rule => {
      const value = catalogValueLabel(taxonomy, rule.attribute_code, optionValues[rule.attribute_code]);
      return rule.attribute_code === "color" ? value : `${catalogAttributeLabel(taxonomy, rule.attribute_code)} ${value}`;
    });
  return labels.join(" · ") || "Única";
}
export function optionSignature(values: CatalogValueMap) {
  return JSON.stringify(Object.fromEntries(Object.entries(values).filter(([, value]) => value !== "").sort(([a], [b]) => a.localeCompare(b))));
}

const category = (code: string, label_es: string, parent_code: string | null, sort_order: number): CatalogCategoryDefinition => ({ code, label_es, parent_code, active: true, sort_order });
const attribute = (code: string, label_es: string, data_type: CatalogAttributeDataType, input_style: CatalogAttributeInputStyle, unit: string | null = null): CatalogAttributeDefinition => ({ code, label_es, data_type, input_style, unit, active: true, sort_order: 0 });
const option = (attribute_code: string, code: string, label_es: string, sort_order: number, swatch_hex: string | null = null): CatalogAttributeOption => ({ attribute_code, code, label_es, sort_order, swatch_hex, active: true });
const rule = (category_code: string, attribute_code: string, scope: CatalogAttributeScope, sort_order: number, required = false, filterable = true): CatalogCategoryAttribute => ({ category_code, attribute_code, scope, sort_order, required, filterable });
const labels = {
  material: { cuero: "Cuero", plata: "Plata", alpaca: "Alpaca", "acero-inoxidable": "Acero inoxidable", "otros-metales": "Otros metales", madera: "Madera", estampado: "Estampado" },
  color: { marron: "Marrón", negro: "Negro", natural: "Natural", "cuero-crudo": "Cuero crudo", rojo: "Rojo", blanco: "Blanco", rosado: "Rosado", gris: "Gris", dorado: "Dorado", celeste: "Celeste", azul: "Azul", beige: "Beige", metalico: "Metálico" },
  swatch: { marron: "#6C4530", negro: "#241D1A", natural: "#CFAF79", "cuero-crudo": "#E8D9BB", rojo: "#A83232", blanco: "#F5F5F5", rosado: "#E8A4A4", gris: "#8C8C8C", dorado: "#C9A859", celeste: "#74ACDF", azul: "#1E3A8A", beige: "#DFD1B8", metalico: "#9B9B95" },
} as const;

export const defaultCatalogTaxonomy: CatalogTaxonomy = {
  categories: [
    category("mates", "Mates", null, 10), category("bombillas", "Bombillas", null, 20), category("termos", "Termos", null, 30),
    category("materas", "Materas", null, 40), category("kits-materos", "Kits materos", null, 50), category("cuchillos", "Cuchillos", null, 60),
    category("calzado", "Calzado", null, 70), category("botas", "Botas", "calzado", 71), category("marroquineria", "Marroquinería", null, 80),
    category("cintos", "Cintos", "marroquineria", 81), category("billeteras", "Billeteras", "marroquineria", 82), category("carteras", "Carteras", "marroquineria", 83),
  ],
  attributes: [
    attribute("tipo-mate", "Modelo de mate", "enum", "select"), attribute("material", "Material", "enum", "select"),
    attribute("forma", "Forma", "enum", "select"), attribute("tamano", "Tamaño", "enum", "select"), attribute("acabado", "Acabado", "text", "text"),
    attribute("color", "Color", "enum", "swatch"), attribute("talle", "Talle", "enum", "buttons"), attribute("capacidad-ml", "Capacidad", "number", "number", "ml"),
    attribute("tipo-bombilla", "Tipo de bombilla", "enum", "select"), attribute("diametro-cano-mm", "Diámetro del caño", "number", "number", "mm"),
    attribute("largo-mm", "Largo", "number", "number", "mm"), attribute("material-cuerpo", "Material del cuerpo", "enum", "select"),
    attribute("forma-pico", "Forma del pico", "enum", "select"), attribute("material-pico", "Material del pico", "enum", "select"),
    attribute("decoracion", "Decoración", "enum", "select"), attribute("tipo-cuchillo", "Tipo de cuchillo", "enum", "select"),
    attribute("largo-hoja-mm", "Largo de hoja", "number", "number", "mm"), attribute("ancho-hoja-mm", "Ancho de hoja", "number", "number", "mm"),
    attribute("configuracion-filo", "Configuración del filo", "enum", "select"), attribute("tiene-gavilan", "Tiene gavilán", "boolean", "checkbox"),
    attribute("forma-gavilan", "Forma del gavilán", "enum", "select"), attribute("material-hoja", "Material de hoja", "enum", "select"),
    attribute("material-cabo", "Material del cabo", "enum", "select"), attribute("material-vaina", "Material de la vaina", "enum", "select"),
    attribute("genero", "Género", "enum", "select"),
    attribute("largo-cinto-cm", "Largo del cinto", "number", "number", "cm"),
  ],
  options: [
    ...catalogProductTypeIds.map((code, index) => option("tipo-mate", code, ({ imperial: "Imperial", camionero: "Camionero", criollo: "Criollo", torpedo: "Torpedo" } as Record<string, string>)[code], index * 10)),
    ...catalogMaterialIds.map((code, index) => option("material", code, labels.material[code], index * 10)),
    option("forma", "ovalada", "Ovalada", 10), option("forma", "cuadrada", "Cuadrada", 20),
    option("tamano", "chico", "Chico", 10), option("tamano", "mediano", "Mediano", 20), option("tamano", "grande", "Grande", 30),
    ...catalogColorIds.map((code, index) => option("color", code, labels.color[code], index * 10, labels.swatch[code])),
    ...Array.from({ length: 13 }, (_, index) => option("talle", String(index + 34), String(index + 34), (index + 1) * 10)),
    option("genero", "hombre", "Hombre", 10), option("genero", "mujer", "Mujer", 20), option("genero", "unisex", "Unisex", 30),
    option("tipo-bombilla", "clasica", "Clásica", 10), option("tipo-bombilla", "bombillon", "Bombillón", 20), option("tipo-bombilla", "apaga", "Apaga", 30),
    option("forma-pico", "pico-loro", "Pico loro", 10), option("material-cuerpo", "alpaca", "Alpaca", 10), option("material-cuerpo", "bronce", "Bronce", 20), option("material-cuerpo", "acero-inoxidable", "Acero inoxidable", 30),
    option("material-pico", "alpaca", "Alpaca", 10), option("material-pico", "bronce", "Bronce", 20),
    option("decoracion", "con-aros", "Con aros", 10), option("decoracion", "cincelada", "Cincelada", 20), option("decoracion", "con-aplique", "Con aplique", 30),
    ...["cuchillo-criollo|Cuchillo criollo o de cintura", "facon|Facón", "daga|Daga", "verijero|Verijero o fillingo", "caronero|Caronero"].map((item, index) => { const [code, label] = item.split("|"); return option("tipo-cuchillo", code, label, index * 10); }),
    option("configuracion-filo", "un-filo", "Un filo", 10), option("configuracion-filo", "doble-filo", "Doble filo", 20), option("configuracion-filo", "filo-con-contrafilo", "Filo con contrafilo", 30),
    option("forma-gavilan", "recto", "Recto", 10), option("forma-gavilan", "s", "En S", 20), option("forma-gavilan", "u", "En U", 30),
    option("material-hoja", "acero", "Acero", 10), option("material-hoja", "acero-inoxidable", "Acero inoxidable", 20),
    ...["madera|Madera", "asta-guampa|Asta o guampa", "bronce|Bronce", "plata|Plata", "alpaca|Alpaca", "combinado|Combinado"].map((item, index) => { const [code, label] = item.split("|"); return option("material-cabo", code, label, index * 10); }),
    ...["cuero-crudo|Cuero crudo", "suela|Suela", "metal|Metal", "combinada|Combinada"].map((item, index) => { const [code, label] = item.split("|"); return option("material-vaina", code, label, index * 10); }),
  ],
  rules: [
    rule("mates","tipo-mate","product",10), rule("mates","material","product",20), rule("mates","acabado","product",30), rule("mates","color","variant",100), rule("mates","tamano","variant",110),
    rule("bombillas","tipo-bombilla","product",10,true), rule("bombillas","diametro-cano-mm","product",20), rule("bombillas","largo-mm","product",30,false,false), rule("bombillas","material-cuerpo","product",40), rule("bombillas","forma-pico","product",50), rule("bombillas","material-pico","product",60), rule("bombillas","decoracion","product",70), rule("bombillas","color","variant",100),
    rule("termos","material","product",10), rule("termos","acabado","product",20), rule("termos","color","variant",100,true), rule("termos","capacidad-ml","variant",110),
    rule("materas","forma","product",10,true), rule("materas","material","product",20), rule("materas","acabado","product",40), rule("materas","color","variant",100,true),
    rule("kits-materos","material","product",10), rule("kits-materos","color","variant",100),
    rule("cuchillos","tipo-cuchillo","product",10,true), rule("cuchillos","largo-hoja-mm","product",20,true), rule("cuchillos","ancho-hoja-mm","product",30,false,false), rule("cuchillos","configuracion-filo","product",40,true), rule("cuchillos","tiene-gavilan","product",50), rule("cuchillos","forma-gavilan","product",60), rule("cuchillos","material-hoja","product",70), rule("cuchillos","material-cabo","product",80), rule("cuchillos","material-vaina","product",90), rule("cuchillos","acabado","product",100),
    rule("calzado","material","product",10), rule("calzado","genero","product",20), rule("calzado","color","variant",100,true), rule("calzado","talle","variant",110,true),
    rule("marroquineria","material","product",10), rule("marroquineria","acabado","product",30), rule("marroquineria","color","variant",100,true),
    rule("cintos", "largo-cinto-cm", "product", 20),
  ],
};
