import { type SupabaseClient } from "npm:@supabase/supabase-js@2.117.1";
import { z } from "npm:zod@4.6.7";
import {
  catalogPurchaseAxes, formatVariantLabel, mateInteriorChoices, taxonomyOptionsFor, taxonomyRulesForProduct,
  type CatalogTaxonomy, type CatalogValue, type CatalogValueMap,
} from "../../../shared/catalog-taxonomy.ts";
import { amountMinor } from "./financeWrites.ts";

const code = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80);
const value = z.union([z.string().trim().min(1).max(160), z.number(), z.boolean(), z.array(code).min(1).max(30)]);
export const productInput = z.object({
  clave_alta: z.uuid().describe("Generá una clave UUID para la ficha y conservá la misma si hay que reintentar."),
  nombre: z.string().trim().min(1).max(160),
  categoria: code.describe("Código de categoría activa, consultado en listar_opciones_alta_producto."),
  descripcion: z.string().trim().max(4000).default(""),
  modalidad: z.enum(["standard", "made_to_order"]).default("standard"),
  peso_gramos: z.number().int().min(0).max(100000).default(0),
  atributos: z.array(z.object({ codigo: code, valor: value })).max(30).default([]),
  variantes: z.array(z.object({
    sku: z.string().regex(/^[1-9][0-9]{2,9}$/).describe("SKU numérico que Richard indique o confirme. No reutilices el de otro producto."),
    precio_base_uyu: z.string().describe("Precio base positivo en UYU sin separador de miles."),
    color: code.optional(),
  })).max(15).default([]),
  confirmado: z.literal(true).describe("Solo tras mostrar ficha, atributos y variantes y recibir confirmación explícita de Richard."),
});

export async function loadMcpCatalogTaxonomy(client: SupabaseClient): Promise<CatalogTaxonomy> {
  const [categories, attributes, options, rules] = await Promise.all([
    client.from("commerce_categories").select("code,label_es,parent_code,active,sort_order").order("code"),
    client.from("commerce_attribute_definitions").select("code,label_es,data_type,unit,input_style,active,sort_order").eq("active", true).order("code"),
    client.from("commerce_attribute_options").select("attribute_code,code,label_es,swatch_hex,active,sort_order").eq("active", true).order("attribute_code").order("code"),
    client.from("commerce_category_attributes").select("category_code,attribute_code,scope,required,filterable,purchase_selectable,sort_order").order("category_code").order("attribute_code"),
  ]);
  if ([categories, attributes, options, rules].some((entry) => entry.error)) throw new Error("No se pudo consultar la configuración del catálogo.");
  return {
    categories: categories.data ?? [], attributes: attributes.data ?? [],
    options: options.data ?? [], rules: rules.data ?? [],
  } as CatalogTaxonomy;
}

export function productOptions(taxonomy: CatalogTaxonomy, category: string, attributes: CatalogValueMap) {
  return (["product", "variant"] as const).flatMap((scope) =>
    taxonomyRulesForProduct(taxonomy, category, attributes, scope).flatMap((rule) => {
      const definition = taxonomy.attributes.find((entry) => entry.code === rule.attribute_code);
      if (!definition) return [];
      return [{
        codigo: definition.code, nombre: definition.label_es, tipo: definition.data_type,
        aplica_a: scope === "product" ? "producto" : "variante", requerido: rule.required,
        opciones: taxonomyOptionsFor(taxonomy, definition.code).map((entry) => ({ codigo: entry.code, nombre: entry.label_es })),
      }];
    })
  );
}

export function productAttributes(entries: { codigo: string; valor: CatalogValue }[]): CatalogValueMap {
  if (new Set(entries.map(({ codigo }) => codigo)).size !== entries.length) throw new Error("Cada atributo se puede indicar una sola vez.");
  return Object.fromEntries(entries.map(({ codigo, valor }) => [codigo, valor]));
}

export function catalogDraft(input: z.infer<typeof productInput>, taxonomy: CatalogTaxonomy) {
  const category = input.categoria;
  if (category === "servicios" || !taxonomy.categories.some((entry) => entry.code === category && entry.active)) {
    throw new Error("Elegí una categoría activa de productos.");
  }
  const attributes = productAttributes(input.atributos);
  const options = productOptions(taxonomy, category, attributes);
  for (const [attribute, attributeValue] of Object.entries(attributes)) {
    const definition = options.find((entry) => entry.codigo === attribute && entry.aplica_a === "producto");
    if (!definition) throw new Error(`El atributo ${attribute} no corresponde a la ficha de esta categoría.`);
    const valid = definition.tipo === "enum"
      ? (Array.isArray(attributeValue)
        ? ["talle", "tipo-cierre"].includes(attribute) && attributeValue.every((item) => definition.opciones.some((entry) => entry.codigo === item))
        : definition.opciones.some((entry) => entry.codigo === attributeValue))
      : typeof attributeValue === ({ number: "number", boolean: "boolean", text: "string" } as const)[definition.tipo];
    if (!valid) throw new Error(`Revisá el valor de ${definition.nombre}.`);
  }
  if (["botas", "zuecos", "zapatos"].includes(category) &&
    !catalogPurchaseAxes(taxonomy, category, attributes, input.nombre).some((axis) => axis.code === "talle" && axis.values.length > 0)) {
    throw new Error("Elegí al menos un número de calzado.");
  }
  const interiors = mateInteriorChoices(category, attributes, input.nombre);
  if (interiors.length === 1 && (attributes.interior === "todos" || attributes.interior === "ceramica")) {
    throw new Error("Este modelo admite solo interior de calabaza.");
  }
  const colorOption = options.find((entry) => entry.codigo === "color" && entry.aplica_a === "variante");
  const skus = new Set<string>();
  const colors = new Set<string>();
  const variants = input.variantes.map((variant) => {
    if (skus.has(variant.sku) || colors.has(variant.color ?? "")) throw new Error("No repitas el SKU ni el color de una variante.");
    if (variant.color ? !colorOption?.opciones.some((entry) => entry.codigo === variant.color) : colorOption?.requerido) {
      throw new Error("Indicá un color activo para la variante.");
    }
    skus.add(variant.sku);
    colors.add(variant.color ?? "");
    return {
      sku: variant.sku, price_minor: amountMinor(variant.precio_base_uyu), color: variant.color ?? null,
      name: formatVariantLabel(taxonomy, category, variant.color ? { color: variant.color } : {}),
    };
  });
  const slug = input.nombre.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-/, "").slice(0, 120).replace(/-$/, "") || "producto";
  return {
    product: { slug, category, name: input.nombre, description: input.descripcion, sale_mode: input.modalidad, peso: input.peso_gramos, attributes },
    variants,
  };
}
