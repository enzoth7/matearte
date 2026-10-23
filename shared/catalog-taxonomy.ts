/** Stable storage/query contracts shared by Commerce Admin and the storefront. */
export const catalogCategoryIds = [
  "bandolera", "billeteras", "bombillas", "botas", "carteras", "cintos", "cuchillos",
  "kits-materos", "materas", "mates", "personalizados", "servicios", "termos", "zuecos",
] as const;
export const catalogMaterialIds = ["cuero", "plata", "alpaca", "acero-inoxidable", "otros-metales", "madera", "estampado", "cuero-crudo", "croco", "pelos", "gamuza", "charol"] as const;
export const catalogProductTypeIds = ["imperial", "camionero", "criollo", "torpedo"] as const;
export const catalogColorIds = ["marron", "negro", "natural", "cuero-crudo", "rojo", "blanco", "rosado", "gris", "dorado", "celeste", "azul", "beige", "metalico", "marron-claro", "chocolate", "negro-dorado", "marron-dorado", "blanco-plateado", "blanco-dorado", "marron-blanco", "negro-marron", "beige-dorado", "negro-blanco", "dorado-natural", "marron-rojo"] as const;
export const catalogCollectionIds = ["estribo", "uruguay", "alfonsina", "sonia"] as const;

export type CatalogCategoryId = (typeof catalogCategoryIds)[number];
export type CatalogMaterialId = (typeof catalogMaterialIds)[number];
export type CatalogProductTypeId = (typeof catalogProductTypeIds)[number];
export type CatalogColorId = (typeof catalogColorIds)[number];
export type CatalogCollectionId = (typeof catalogCollectionIds)[number];
export type CatalogValue = string | number | boolean | string[];
export type CatalogValueMap = Record<string, CatalogValue>;
export type CatalogAttributeDataType = "enum" | "number" | "boolean" | "text";
export type CatalogAttributeInputStyle = "select" | "swatch" | "buttons" | "number" | "checkbox" | "text";
export type CatalogAttributeScope = "product" | "variant";

export type CatalogCategoryDefinition = { code: string; label_es: string; parent_code: string | null; active: boolean; sort_order: number };
export type CatalogAttributeDefinition = { code: string; label_es: string; data_type: CatalogAttributeDataType; unit: string | null; input_style: CatalogAttributeInputStyle; active: boolean; sort_order: number };
export type CatalogAttributeOption = { attribute_code: string; code: string; label_es: string; swatch_hex: string | null; active: boolean; sort_order: number };
export type CatalogCategoryAttribute = { category_code: string; attribute_code: string; scope: CatalogAttributeScope; required: boolean; filterable: boolean; purchase_selectable: boolean; sort_order: number };
export type CatalogTaxonomy = { categories: CatalogCategoryDefinition[]; attributes: CatalogAttributeDefinition[]; options: CatalogAttributeOption[]; rules: CatalogCategoryAttribute[] };
export type CatalogAttributeDetail = { code: string; label: string; values: string[]; rawValue: CatalogValue };
export type CatalogPurchaseAxis = { code: string; label: string; values: Array<{ value: string; label: string }> };

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
  return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, CatalogValue] =>
    ["string", "number", "boolean"].includes(typeof entry[1])
    || (entry[0] === "talle" && Array.isArray(entry[1]) && entry[1].every(item => typeof item === "string"))));
}
export function canonicalCategoryCode(value: string) {
  return ({ bombillones: "bombillas", "kit-matero": "kits-materos", cuchillo: "cuchillos", calzado: "botas", marroquineria: "cintos", "mates-personalizados": "personalizados", "materas-personalizadas": "personalizados" } as Record<string, string>)[value] ?? value;
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
  return [...byAttribute.values()]
    .filter(rule => rule.scope !== "variant" || rule.attribute_code === "color")
    .sort((a, b) => a.sort_order - b.sort_order || a.attribute_code.localeCompare(b.attribute_code));
}
/** El diseño de fleje (opcional) aplica a los mates imperiales y a todos los criollos. */
export function allowsFlejeDesign(values: CatalogValueMap) {
  return values["tipo-mate"] === "imperial" || values["tipo-mate"] === "criollo";
}
/** A Criollo Imperial or Criollo Camionero offers the same interiors as its named model. */
export function mateInteriorChoices(categoryCode: string, values: CatalogValueMap, productName = ""): Array<"calabaza" | "ceramica"> {
  const category = canonicalCategoryCode(categoryCode);
  if (category !== "mates" && !(category === "personalizados" && values["tipo-personalizado"] === "mate")) return [];
  const model = String(values["tipo-mate"] ?? "");
  if (model === "torpedo" || /\btorpedo\b/i.test(productName)) return ["calabaza"];
  if (model === "imperial" || model === "camionero" || /\b(imperial|camionero)\b/i.test(productName)) return ["calabaza", "ceramica"];
  return ["calabaza"];
}
export function taxonomyRulesForProduct(taxonomy: CatalogTaxonomy, categoryCode: string, values: CatalogValueMap, scope: CatalogAttributeScope) {
  const imperialOnly = (rules: CatalogCategoryAttribute[]) => allowsFlejeDesign(values) ? rules : rules.filter(rule => rule.attribute_code !== "diseno-fleje");
  const base = taxonomyRulesForCategory(taxonomy, categoryCode, scope);
  if (canonicalCategoryCode(categoryCode) !== "personalizados" || scope !== "product") return imperialOnly(base);
  const subtype = values["tipo-personalizado"];
  if (subtype !== "mate" && subtype !== "matera") return base.filter(rule => rule.attribute_code !== "diseno-matera");
  const extra = taxonomyRulesForCategory(taxonomy, subtype === "mate" ? "mates" : "materas", scope)
    .filter(rule => rule.attribute_code !== "coleccion" && (subtype !== "mate" || rule.attribute_code !== "material"));
  const materaDesign = subtype === "matera" ? base.filter(rule => rule.attribute_code === "diseno-matera") : [];
  return imperialOnly([...base.filter(rule => rule.attribute_code !== "diseno-matera"), ...extra, ...materaDesign]).sort((a, b) => a.sort_order - b.sort_order || a.attribute_code.localeCompare(b.attribute_code));
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
export function catalogPurchaseAxes(taxonomy: CatalogTaxonomy, categoryCode: string, attributes: CatalogValueMap, productName = ""): CatalogPurchaseAxis[] {
  return taxonomyRulesForProduct(taxonomy, categoryCode, attributes, "product")
    .filter(rule => rule.purchase_selectable)
    .map(rule => {
      const definition = taxonomy.attributes.find(item => item.code === rule.attribute_code && item.active);
      const allowedInteriors = rule.attribute_code === "interior" ? mateInteriorChoices(categoryCode, attributes, productName) : null;
      const options = taxonomyOptionsFor(taxonomy, rule.attribute_code).filter(item => item.code !== "todos" && (!allowedInteriors || allowedInteriors.includes(item.code as "calabaza" | "ceramica")));
      const raw = attributes[rule.attribute_code];
      const selected = rule.attribute_code === "talle" && Array.isArray(raw) ? raw : [String(raw)];
      const available = raw === "todos" ? options
        : selected.length > 0 && selected.every(code => options.some(item => item.code === code))
          ? options.filter(item => selected.includes(item.code))
          : [];
      return {
        code: rule.attribute_code,
        label: definition?.label_es ?? rule.attribute_code,
        values: definition && available.length ? available.map(item => ({ value: item.code, label: item.label_es })) : [],
      };
    });
}
export function catalogAttributeDetails(taxonomy: CatalogTaxonomy, attributes: CatalogValueMap): CatalogAttributeDetail[] {
  return Object.entries(attributes)
    .filter(([, value]) => value !== "" && value !== null && value !== undefined)
    .map(([code, rawValue]) => {
      const definition = taxonomy.attributes.find(item => item.code === code);
      const options = taxonomyOptionsFor(taxonomy, code).filter(item => item.code !== "todos");
      const resolved = typeof rawValue === "boolean" ? rawValue ? "Sí" : "No" : catalogValueLabel(taxonomy, code, rawValue);
      const values = code === "talle" && Array.isArray(rawValue)
        ? options.filter(item => rawValue.includes(item.code)).map(item => item.label_es)
        : rawValue === "todos" && options.length
        ? options.map(item => item.label_es)
        : [typeof rawValue === "string" && resolved === rawValue ? rawValue.replaceAll("-", " ").replace(/^./, letter => letter.toUpperCase()) : resolved];
      return { code, label: definition?.label_es ?? code.replaceAll("-", " "), values, rawValue };
    });
}
export function formatVariantLabel(taxonomy: CatalogTaxonomy, categoryCode: string, optionValues: CatalogValueMap) {
  const labels = taxonomyRulesForCategory(taxonomy, categoryCode, "variant")
    // "todos" (Todos los talles/tamaños) es un comodín: no distingue variantes, así que no se muestra.
    .filter(rule => optionValues[rule.attribute_code] !== undefined && optionValues[rule.attribute_code] !== "" && String(optionValues[rule.attribute_code]) !== "todos")
    .map(rule => {
      const value = catalogValueLabel(taxonomy, rule.attribute_code, optionValues[rule.attribute_code]);
      return rule.attribute_code === "color" ? value : `${catalogAttributeLabel(taxonomy, rule.attribute_code)} ${value}`;
    });
  return labels.join(" · ") || "Única";
}
export function formatPurchaseSelectionLabel(taxonomy: CatalogTaxonomy, optionValues: CatalogValueMap) {
  const ordered = Object.entries(optionValues)
    .filter(([, value]) => value !== "" && value !== "todos")
    .sort(([left], [right]) => left === "color" ? -1 : right === "color" ? 1 : left.localeCompare(right));
  return ordered.map(([code, value]) => {
    const label = catalogValueLabel(taxonomy, code, value);
    return code === "color" ? label : `${catalogAttributeLabel(taxonomy, code)}: ${label}`;
  }).join(" · ") || "Única";
}
export function colorOnlyVariantValues(optionValues: CatalogValueMap): CatalogValueMap {
  const color = optionValues.color;
  return color === undefined || color === "" ? {} : { color };
}
export function optionSignature(values: CatalogValueMap) {
  return JSON.stringify(Object.fromEntries(Object.entries(values).filter(([, value]) => value !== "").sort(([a], [b]) => a.localeCompare(b))));
}

const category = (code: string, label_es: string, parent_code: string | null, sort_order: number): CatalogCategoryDefinition => ({ code, label_es, parent_code, active: true, sort_order });
const attribute = (code: string, label_es: string, data_type: CatalogAttributeDataType, input_style: CatalogAttributeInputStyle, unit: string | null = null): CatalogAttributeDefinition => ({ code, label_es, data_type, input_style, unit, active: true, sort_order: 0 });
const option = (attribute_code: string, code: string, label_es: string, sort_order: number, swatch_hex: string | null = null): CatalogAttributeOption => ({ attribute_code, code, label_es, sort_order, swatch_hex, active: true });
const rule = (category_code: string, attribute_code: string, scope: CatalogAttributeScope, sort_order: number, required = false, filterable = true, purchase_selectable = false): CatalogCategoryAttribute => ({ category_code, attribute_code, scope, sort_order, required, filterable, purchase_selectable });
const labels = {
  material: { cuero: "Cuero", plata: "Plata", alpaca: "Alpaca", "acero-inoxidable": "Acero inoxidable", "otros-metales": "Otros metales", madera: "Madera", estampado: "Estampado", "cuero-crudo": "Cuero Crudo", croco: "Croco", pelos: "Pelos", gamuza: "Gamuza", charol: "Charol" },
  color: { marron: "Marrón", negro: "Negro", natural: "Natural", "cuero-crudo": "Cuero crudo", rojo: "Rojo", blanco: "Blanco", rosado: "Rosado", gris: "Gris", dorado: "Dorado", celeste: "Celeste", azul: "Azul", beige: "Beige", metalico: "Metálico", "marron-claro": "Marrón claro", chocolate: "Chocolate", "negro-dorado": "Negro/Dorado", "marron-dorado": "Marrón/Dorado", "blanco-plateado": "Blanco/Plateado", "blanco-dorado": "Blanco/Dorado", "marron-blanco": "Marrón/Blanco", "negro-marron": "Negro/Marrón", "beige-dorado": "Beige/Dorado", "negro-blanco": "Negro/Blanco", "dorado-natural": "Dorado/Natural", "marron-rojo": "Marrón/Rojo" },
  swatch: { marron: "#6C4530", negro: "#241D1A", natural: "#CFAF79", "cuero-crudo": "#E8D9BB", rojo: "#A83232", blanco: "#F5F5F5", rosado: "#E8A4A4", gris: "#8C8C8C", dorado: "#C9A859", celeste: "#74ACDF", azul: "#1E3A8A", beige: "#DFD1B8", metalico: "#9B9B95", "marron-claro": "#A67B5B", chocolate: "#4B2E24", "negro-dorado": "#241D1A", "marron-dorado": "#6C4530", "blanco-plateado": "#F5F5F5", "blanco-dorado": "#F5F5F5", "marron-blanco": "#6C4530", "negro-marron": "#241D1A", "beige-dorado": "#DFD1B8", "negro-blanco": "#241D1A", "dorado-natural": "#C9A859", "marron-rojo": "#6C4530" },
} as const;

export const defaultCatalogTaxonomy: CatalogTaxonomy = {
  categories: [
    category("billeteras", "Billeteras", null, 10), category("bombillas", "Bombillas", null, 20), category("botas", "Botas", null, 30), category("zuecos", "Zuecos", null, 35),
    category("carteras", "Carteras", null, 40), category("bandolera", "Bandolera", null, 45), category("cintos", "Cintos", null, 50), category("cuchillos", "Cuchillos", null, 60),
    category("kits-materos", "Kits materos", null, 70), category("materas", "Materas", null, 80), category("mates", "Mates", null, 90),
    category("personalizados", "Personalizados", null, 100), category("servicios", "Servicios", null, 105), category("termos", "Termos", null, 110),
  ],
  attributes: [
    attribute("coleccion", "Colección", "enum", "select"), attribute("tipo-personalizado", "Tipo", "enum", "select"), attribute("diseno-matera", "Diseño de la matera", "enum", "select"),
    attribute("tipo-mate", "Modelo de mate", "enum", "select"), attribute("material-mate", "Material del mate", "enum", "select"), attribute("tipo-virola", "Tipo de virola", "enum", "select"), attribute("tipo-cuero", "Tipo de cuero", "enum", "select"), attribute("diseno-fleje", "Diseño de fleje", "enum", "select"), attribute("posamate", "Posamate", "enum", "select"), attribute("pie", "Pie", "enum", "select"), attribute("material", "Material exterior", "enum", "select"),
    attribute("forma", "Forma", "enum", "select"), attribute("tamano", "Tamaño", "enum", "select"), attribute("interior", "Interior", "enum", "select"), attribute("acabado", "Acabado", "text", "text"),
    attribute("color", "Color", "enum", "swatch"), attribute("talle", "Talle", "enum", "buttons"), attribute("capacidad-ml", "Capacidad", "number", "number", "ml"),
    attribute("tipo-bombilla", "Tipo de bombilla", "enum", "select"), attribute("diametro-cano-mm", "Diámetro del caño", "number", "number", "cm"),
    attribute("largo-mm", "Largo", "enum", "select"), attribute("material-cuerpo", "Material del cuerpo", "enum", "select"),
    attribute("forma-pico", "Forma del pico", "enum", "select"), attribute("material-pico", "Material del pico", "enum", "select"),
    attribute("decoracion", "Decoración", "enum", "select"), attribute("tipo-cuchillo", "Tipo de cuchillo", "enum", "select"),
    attribute("largo-hoja-mm", "Largo de hoja", "number", "number", "mm"), attribute("ancho-hoja-mm", "Ancho de hoja", "number", "number", "mm"),
    attribute("configuracion-filo", "Configuración del filo", "enum", "select"), attribute("tiene-gavilan", "Tiene gavilán", "boolean", "checkbox"),
    attribute("forma-gavilan", "Forma del gavilán", "enum", "select"), attribute("material-hoja", "Material de hoja", "enum", "select"),
    attribute("material-cabo", "Material del cabo", "enum", "select"), attribute("material-vaina", "Material de la vaina", "enum", "select"),
    attribute("genero", "Género", "enum", "select"),
    attribute("largo-cinto-cm", "Largo del cinto", "enum", "select"),
  ],
  options: [
    ...catalogCollectionIds.map((code, index) => option("coleccion", code, ({ estribo: "Estribo", uruguay: "Uruguay", alfonsina: "Alfonsina", sonia: "Sonia" } as Record<string, string>)[code], (index + 1) * 10)),
    option("tipo-personalizado", "mate", "Mate", 10), option("tipo-personalizado", "matera", "Matera", 20),
    option("diseno-matera", "logo", "Logo", 10), option("diseno-matera", "texto", "Texto", 20), option("diseno-matera", "logo-y-texto", "Logo y texto", 30),
    ...catalogProductTypeIds.map((code, index) => option("tipo-mate", code, ({ imperial: "Imperial", camionero: "Camionero", criollo: "Criollo", torpedo: "Torpedo" } as Record<string, string>)[code], index * 10)),
    ...["calabaza|Calabaza", "ceramica|Cerámica", "cuero|Cuero", "madera|Madera", "acero-inoxidable|Acero inoxidable"].map((item, index) => { const [code, label] = item.split("|"); return option("material-mate", code, label, (index + 1) * 10); }),
    ...["acero|Acero", "acero-cincelado|Acero Cincelado", "acero-liso|Acero Liso", "acero-y-bronce-liso|Acero y Bronce Liso", "alpaca|Alpaca", "alpaca-cincelada|Alpaca Cincelada", "alpaca-comun|Alpaca Común", "alpaca-grande-cincelada|Alpaca Grande Cincelada", "alpaca-grande-cincelada-premium|Alpaca Grande Cincelada Premium", "alpaca-grande-lisa|Alpaca Grande Lisa", "alpaca-y-bronce|Alpaca y Bronce", "imperial|Imperial", "acero-inoxidable|Imperial Acero Inoxidable", "imperial-premium|Imperial Premium", "plata|Plata", "sin-virola|Sin Virola"].map((item, index) => { const [code, label] = item.split("|"); return option("tipo-virola", code, label, (index + 1) * 10); }),
    ...["liso|Liso", "crudo|Crudo", "estampado|Estampado", "croco|Croco", "pelos|Pelos"].map((item, index) => { const [code, label] = item.split("|"); return option("tipo-cuero", code, label, (index + 1) * 10); }),
    option("tipo-cuero", "sin-cuero", "Sin Cuero", 5),
    ...["pampa|Pampa", "griego|Griego", "rupestre|Rupestre", "flores|Flores", "abstracto|Abstracto", "liso|Liso", "premium|Premium", "manos|Manos", "laureles|Laureles"].map((item, index) => { const [code, label] = item.split("|"); return option("diseno-fleje", code, label, (index + 1) * 10); }),
    option("posamate", "sin-posamate", "Sin posamate", 10), option("posamate", "con-posamate", "Con posamate", 20),
    option("pie", "comun", "Común", 10), option("pie", "sin-pie", "Sin Pie", 20), option("pie", "alpaca", "Alpaca", 30),
    ...catalogMaterialIds.map((code, index) => option("material", code, labels.material[code], index * 10)),
    option("forma", "ovalada", "Ovalada", 10), option("forma", "cuadrada", "Cuadrada", 20),
    option("tamano", "todos", "Todos los tamaños", 5), option("tamano", "chico", "Chico", 10), option("tamano", "mediano", "Mediano", 20), option("tamano", "grande", "Grande", 30),
    option("interior", "todos", "Todos los interiores", 5), option("interior", "calabaza", "Calabaza", 10), option("interior", "ceramica", "Cerámica", 20),
    ...catalogColorIds.map((code, index) => option("color", code, labels.color[code], index * 10, labels.swatch[code])),
    option("talle", "todos", "Todos los tamaños", 5), ...Array.from({ length: 13 }, (_, index) => option("talle", String(index + 34), String(index + 34), (index + 1) * 10)),
    option("largo-cinto-cm", "todos", "Todos los tamaños", 5),
    ...Array.from({ length: 14 }, (_, index) => option("largo-cinto-cm", String(85 + index * 5), `${85 + index * 5} cm`, (index + 1) * 10)),
    option("genero", "hombre", "Hombre", 10), option("genero", "mujer", "Mujer", 20), option("genero", "unisex", "Unisex", 30),
    option("largo-mm", "todos", "Todos los largos", 5), option("largo-mm", "larga", "Larga (19 cm)", 10), option("largo-mm", "corta", "Corta (16 cm)", 20),
    option("tipo-bombilla", "clasica", "Clásica", 10), option("tipo-bombilla", "bombillon", "Bombillón", 20),
    option("forma-pico", "pico-loro", "Pico loro", 10), option("material-cuerpo", "alpaca", "Alpaca", 10), option("material-cuerpo", "bronce", "Bronce", 20), option("material-cuerpo", "acero-inoxidable", "Acero inoxidable", 30),
    option("material-pico", "acero", "Acero", 10), option("material-pico", "alpaca", "Alpaca", 20), option("material-pico", "bronce", "Bronce", 30),
    option("decoracion", "con-aros", "Con aros", 10), option("decoracion", "cincelada", "Cincelada", 20), option("decoracion", "con-aplique", "Con aplique", 30),
    ...["cuchillo-criollo|Cuchillo criollo o de cintura", "facon|Facón", "daga|Daga", "verijero|Verijero o fillingo", "caronero|Caronero"].map((item, index) => { const [code, label] = item.split("|"); return option("tipo-cuchillo", code, label, index * 10); }),
    option("configuracion-filo", "un-filo", "Un filo", 10), option("configuracion-filo", "doble-filo", "Doble filo", 20), option("configuracion-filo", "filo-con-contrafilo", "Filo con contrafilo", 30),
    option("forma-gavilan", "recto", "Recto", 10), option("forma-gavilan", "s", "En S", 20), option("forma-gavilan", "u", "En U", 30),
    option("material-hoja", "acero", "Acero", 10), option("material-hoja", "acero-inoxidable", "Acero inoxidable", 20),
    ...["madera|Madera", "asta-guampa|Asta o guampa", "bronce|Bronce", "plata|Plata", "alpaca|Alpaca", "combinado|Combinado"].map((item, index) => { const [code, label] = item.split("|"); return option("material-cabo", code, label, index * 10); }),
    ...["cuero-crudo|Cuero crudo", "suela|Suela", "metal|Metal", "combinada|Combinada"].map((item, index) => { const [code, label] = item.split("|"); return option("material-vaina", code, label, index * 10); }),
  ],
  rules: [
    ...catalogCategoryIds.filter(code => code !== "servicios").map(code => rule(code,"coleccion","product",5)),
    rule("mates","tipo-mate","product",10), rule("mates","material-mate","product",15,true), rule("mates","tipo-virola","product",16,true), rule("mates","tipo-cuero","product",17,true), rule("mates","diseno-fleje","product",19), rule("mates","posamate","product",18,true), rule("mates","pie","product",18), rule("mates","material","product",20), rule("mates","tamano","product",25,false,true,true), rule("mates","interior","product",26,false,true,true), rule("mates","acabado","product",30), rule("mates","color","variant",100),
    rule("personalizados","tipo-personalizado","product",1,true), rule("personalizados","diseno-matera","product",30,true), rule("personalizados","color","variant",100),
    rule("bombillas","tipo-bombilla","product",10,true), rule("bombillas","diametro-cano-mm","product",20), rule("bombillas","largo-mm","product",30,false,false,true), rule("bombillas","material-cuerpo","product",40), rule("bombillas","forma-pico","product",50), rule("bombillas","material-pico","product",60), rule("bombillas","decoracion","product",70), rule("bombillas","color","variant",100),
    rule("termos","material","product",10), rule("termos","acabado","product",20), rule("termos","capacidad-ml","product",30), rule("termos","color","variant",100,true),
    rule("materas","forma","product",10,true), rule("materas","material","product",20), rule("materas","acabado","product",40), rule("materas","color","variant",100,true),
    rule("kits-materos","material","product",10), rule("kits-materos","color","variant",100),
    rule("cuchillos","tipo-cuchillo","product",10,true), rule("cuchillos","largo-hoja-mm","product",20,true), rule("cuchillos","ancho-hoja-mm","product",30,false,false), rule("cuchillos","configuracion-filo","product",40,true), rule("cuchillos","tiene-gavilan","product",50), rule("cuchillos","forma-gavilan","product",60), rule("cuchillos","material-hoja","product",70), rule("cuchillos","material-cabo","product",80), rule("cuchillos","material-vaina","product",90), rule("cuchillos","acabado","product",100),
    rule("botas","material","product",10), rule("botas","genero","product",20), rule("botas","talle","product",30,true,true,true), rule("botas","color","variant",100,true),
    rule("zuecos","material","product",10), rule("zuecos","genero","product",20), rule("zuecos","talle","product",30,true,true,true), rule("zuecos","color","variant",100,true),
    rule("cintos","material","product",10), rule("cintos","largo-cinto-cm","product",20,false,true,true), rule("cintos","acabado","product",30), rule("cintos","color","variant",100,true),
    rule("billeteras","material","product",10), rule("billeteras","acabado","product",30), rule("billeteras","color","variant",100,true),
    rule("carteras","material","product",10), rule("carteras","acabado","product",30), rule("carteras","color","variant",100,true),
    rule("bandolera","material","product",10), rule("bandolera","acabado","product",30), rule("bandolera","color","variant",100,true),
  ],
};
