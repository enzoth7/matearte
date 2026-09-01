type Json = Record<string, unknown>;
type PricingCatalog = { versionId: string; version: number; rules: Record<string, number> };

const record = (value: unknown): Json => value && typeof value === "object" && !Array.isArray(value) ? value as Json : {};
const list = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const text = (value: unknown) => typeof value === "string" ? value : "";
const chargeable = (value: string) => value.match(/[\p{L}\p{N}]/gu)?.length || 0;

function selectionIsAllowed(selection: Json) {
  const family = text(selection.familyId), texture = text(selection.textureId), color = text(selection.colorId), metal = text(selection.metalId), size = text(selection.sizeId);
  if (!["chico", "medio", "grande"].includes(size)) return false;
  if (family === "camionero") return texture === "alpaca-cincelado-patas" && ["natural", "cuero-crudo", "marron", "negro"].includes(color) && metal === "alpaca-comun";
  if (family === "imperial") {
    if (["cincelado-premium", "imperial-clasico"].includes(texture)) return ["natural", "negro", "marron", "animal-print-premium", "marron-blanco-premium", "negro-blanco-premium", "cuero-crudo"].includes(color) && metal === "original-imperial";
    return texture === "virola-plata-900" && ["cuero-crudo", "negro", "marron", "natural", "print", "criollo"].includes(color) && metal === "plata-900";
  }
  if (family === "torpedo") {
    const colors: Record<string, string[]> = { "cuero-liso": ["natural", "negro", "marron"], "cuero-estampado": ["marron"], "cuero-crudo": ["cuero-crudo"], "print-pelos": ["marron-blanco", "negro-blanco", "animal-print"] };
    return Boolean(colors[texture]?.includes(color)) && ["alpaca-bronce", "alpaca-comun", "alpaca-grande"].includes(metal);
  }
  if (family === "criollo") {
    if (!['torpedo-criollo-posa-mate', 'imperial-criollo-posa-mate', 'camionero-criollo-posa-mate'].includes(texture) || !['vaqueta', 'cuero-crudo-criollo'].includes(color)) return false;
    if (texture === 'torpedo-criollo-posa-mate') return ['alpaca-grande-criollo', 'alpaca-grande-lacre-torpedo'].includes(metal);
    if (texture === 'imperial-criollo-posa-mate') return ['alpaca-grande-criollo', 'alpaca-grande-lacre-imperial'].includes(metal);
    return metal === 'original-camionero';
  }
  return false;
}

function selectionRuleKeys(selection: Json) {
  if (!selectionIsAllowed(selection)) throw new Error("La combinación del diseño no pertenece al catálogo vigente.");
  const family = text(selection.familyId), texture = text(selection.textureId), color = text(selection.colorId), metal = text(selection.metalId);
  const keys = [`family:${family}`];
  const tree = `tree:${family}:${texture}`;
  if (family === "criollo" || texture === "cincelado-premium") keys.push(tree);
  if (texture === "cuero-estampado") keys.push("leather:stamped");
  else if (color === "cuero-crudo") keys.push("leather:raw");
  else if (color === "cuero-crudo-criollo") keys.push("leather:raw-posa-mate");
  else if (color === "vaqueta") keys.push("leather:vaqueta");
  else if (texture === "print-pelos" || color.includes("print")) keys.push("leather:print-pelos");
  if (["alpaca-bronce", "alpaca-grande", "plata-900"].includes(metal)) keys.push(`metal:${metal}`);
  if (metal.includes("alpaca-grande-lacre")) keys.push(`metal:criollo:${texture}:alpaca-grande-lacre`);
  return keys;
}

export function calculateDesignPriceMinor(configurationValue: unknown, flejeValue: unknown, catalog: PricingCatalog) {
  const configuration = record(configurationValue);
  if (!text(configuration.skuId)) throw new Error("El diseño todavía no tiene un SKU completo.");
  const selection = record(configuration.selection);
  const rules = catalog.rules;
  const price = (key: string) => {
    const value = rules[key];
    if (!Number.isFinite(value) || value < 0) throw new Error(`Falta publicar la regla de precio ${key}.`);
    return value;
  };
  let total = selectionRuleKeys(selection).reduce((sum, key) => sum + price(key), 0);
  const technique = text(configuration.engravingTypeId || selection.engravingTypeId);
  if (!['laser', 'bronze-applique', 'alpaca-applique'].includes(technique)) throw new Error("Falta elegir la técnica de personalización.");
  const rim = record(configuration.rim);
  const rimTexts = list(rim.texts).map((entry) => text(record(entry).text)).join("") || text(rim.text);
  const rimTextCharacterCount = rim.textMode === "text" ? chargeable(rimTexts) : 0;
  const rimTextQuantity = technique === "laser" && rimTextCharacterCount > 0 ? 1 : rimTextCharacterCount;
  const rimImageQuantity = rim.imageMode === "image" ? list(rim.icons).filter((entry) => Boolean(text(record(entry).selectedImageId) || record(entry).customImage)).length : 0;
  if (rimTextQuantity) total += price(`customization:${technique}:rim_text`) * rimTextQuantity;
  if (rimImageQuantity) total += price(`customization:${technique}:rim_image`) * rimImageQuantity;

  const capabilities = record(configuration.capabilities);
  if (capabilities.hasFleje === true) {
    const flejeTechnique = text(configuration.flejeEngravingTypeId);
    if (!['bronze-applique', 'alpaca-applique'].includes(flejeTechnique)) throw new Error("Falta elegir la técnica del fleje.");
    const sides = Object.values(record(record(flejeValue).sides)).map(record);
    const textCount = sides.reduce((sum, side) => sum + (side.textMode === "text" ? chargeable(text(side.text)) : 0), 0);
    const imageCount = sides.reduce((sum, side) => {
      if (side.imageMode !== "image") return sum;
      const icons = list(side.icons).filter((entry) => Boolean(text(record(entry).selectedImageId) || record(entry).customImage)).length;
      return sum + (icons || (text(side.selectedImageId) || side.customImage ? 1 : 0));
    }, 0);
    if (textCount) total += price(`customization:${flejeTechnique}:fleje_text`) * textCount;
    if (imageCount) total += price(`customization:${flejeTechnique}:fleje_image`) * imageCount;
  }
  return { priceMinor: Math.round(total * 100), pricingVersionId: catalog.versionId, pricingVersion: catalog.version };
}
