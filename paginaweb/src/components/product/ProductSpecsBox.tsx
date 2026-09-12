"use client";

import { useLocale } from "next-intl";
import type { Product, ProductVariant } from "@/types/catalog";

type Locale = "es" | "en" | "pt";

export interface ProductSpecsBoxProps {
  product: Product;
  selectedOptions?: Record<string, string | number | boolean>;
  activeVariant?: ProductVariant;
}

interface SpecItem {
  key: string;
  label: string;
  value: string;
}

const titles: Record<Locale, string> = {
  es: "Características",
  en: "Specifications",
  pt: "Características",
};

const materialMap: Record<string, Record<Locale, string>> = {
  cuero: { es: "Cuero", en: "Leather", pt: "Couro" },
  plata: { es: "Plata", en: "Silver", pt: "Prata" },
  alpaca: { es: "Alpaca", en: "Alpaca", pt: "Alpaca" },
  "acero-inoxidable": { es: "Acero inoxidable", en: "Stainless steel", pt: "Aço inoxidável" },
  "otros-metales": { es: "Otros metales", en: "Other metals", pt: "Outros metais" },
  madera: { es: "Madera", en: "Wood", pt: "Madeira" },
  "cuero-crudo": { es: "Cuero crudo", en: "Rawhide", pt: "Couro cru" },
  estampado: { es: "Estampado", en: "Patterned", pt: "Estampado" },
};

const colorMap: Record<string, Record<Locale, string>> = {
  marron: { es: "Marrón", en: "Brown", pt: "Marrom" },
  negro: { es: "Negro", en: "Black", pt: "Preto" },
  natural: { es: "Natural", en: "Natural", pt: "Natural" },
  "cuero-crudo": { es: "Cuero crudo", en: "Rawhide", pt: "Couro cru" },
  rojo: { es: "Rojo", en: "Red", pt: "Vermelho" },
  blanco: { es: "Blanco", en: "White", pt: "Branco" },
  rosado: { es: "Rosado", en: "Pink", pt: "Rosa" },
  gris: { es: "Gris", en: "Gray", pt: "Cinza" },
  dorado: { es: "Dorado", en: "Gold", pt: "Dourado" },
  celeste: { es: "Celeste", en: "Light blue", pt: "Azul celeste" },
  azul: { es: "Azul", en: "Blue", pt: "Azul" },
  beige: { es: "Beige", en: "Beige", pt: "Bege" },
  metalico: { es: "Metálico", en: "Metallic", pt: "Metálico" },
};

const tamanoMap: Record<string, Record<Locale, string>> = {
  todos: { es: "Chico, Mediano, Grande", en: "Small, Medium, Large", pt: "Pequeno, Médio, Grande" },
  chico: { es: "Chico", en: "Small", pt: "Pequeno" },
  mediano: { es: "Mediano", en: "Medium", pt: "Médio" },
  grande: { es: "Grande", en: "Large", pt: "Grande" },
};

const formaMap: Record<string, Record<Locale, string>> = {
  ovalada: { es: "Ovalada", en: "Oval", pt: "Oval" },
  cuadrada: { es: "Cuadrada", en: "Square", pt: "Quadrada" },
};

const generoMap: Record<string, Record<Locale, string>> = {
  hombre: { es: "Hombre", en: "Men", pt: "Masculino" },
  mujer: { es: "Mujer", en: "Women", pt: "Feminino" },
  unisex: { es: "Unisex", en: "Unisex", pt: "Unissex" },
};

const tipoMateMap: Record<string, Record<Locale, string>> = {
  imperial: { es: "Imperial", en: "Imperial", pt: "Imperial" },
  camionero: { es: "Camionero", en: "Camionero", pt: "Camionero" },
  torpedo: { es: "Torpedo", en: "Torpedo", pt: "Torpedo" },
  criollo: { es: "Criollo", en: "Criollo", pt: "Crioulo" },
};

const tipoCuchilloMap: Record<string, Record<Locale, string>> = {
  "cuchillo-criollo": { es: "Cuchillo criollo o de cintura", en: "Criollo / Waist knife", pt: "Faca crioula ou de cintura" },
  facon: { es: "Facón", en: "Facón", pt: "Facão" },
  daga: { es: "Daga", en: "Dagger", pt: "Adaga" },
  verijero: { es: "Verijero o fillingo", en: "Verijero knife", pt: "Verijero" },
  caronero: { es: "Caronero", en: "Caronero", pt: "Caronero" },
};

const materialCaboMap: Record<string, Record<Locale, string>> = {
  madera: { es: "Madera", en: "Wood", pt: "Madeira" },
  "asta-guampa": { es: "Asta o guampa", en: "Horn", pt: "Chifre / Guampa" },
  bronce: { es: "Bronce", en: "Bronze", pt: "Bronze" },
  plata: { es: "Plata", en: "Silver", pt: "Prata" },
  alpaca: { es: "Alpaca", en: "Alpaca", pt: "Alpaca" },
  combinado: { es: "Combinado", en: "Combined", pt: "Combinado" },
};

const materialVainaMap: Record<string, Record<Locale, string>> = {
  "cuero-crudo": { es: "Cuero crudo", en: "Rawhide", pt: "Couro cru" },
  suela: { es: "Suela", en: "Leather sole", pt: "Sola" },
  metal: { es: "Metal", en: "Metal", pt: "Metal" },
  combinada: { es: "Combinada", en: "Combined", pt: "Combinada" },
};

const tipoBombillaMap: Record<string, Record<Locale, string>> = {
  clasica: { es: "Clásica", en: "Classic", pt: "Clássica" },
  bombillon: { es: "Bombillón", en: "Large straw", pt: "Bombilhão" },
  apaga: { es: "Apaga", en: "Apaga", pt: "Apaga" },
};

const formaPicoMap: Record<string, Record<Locale, string>> = {
  "pico-loro": { es: "Pico loro", en: "Parrot beak", pt: "Bico de papagaio" },
};

const materialCuerpoMap: Record<string, Record<Locale, string>> = {
  alpaca: { es: "Alpaca", en: "Alpaca", pt: "Alpaca" },
  bronce: { es: "Bronce", en: "Bronze", pt: "Bronze" },
  "acero-inoxidable": { es: "Acero inoxidable", en: "Stainless steel", pt: "Aço inoxidável" },
};

const decoracionMap: Record<string, Record<Locale, string>> = {
  "con-aros": { es: "Con aros", en: "With rings", pt: "Com anéis" },
  cincelada: { es: "Cincelada", en: "Chiseled", pt: "Cinzelada" },
  "con-aplique": { es: "Con aplique", en: "With applique", pt: "Com aplique" },
};

function lookup(dict: Record<string, Record<Locale, string>>, rawVal: unknown, locale: Locale): string {
  if (rawVal === undefined || rawVal === null) return "";
  const str = String(rawVal).trim();
  if (!str) return "";
  const normalized = str.toLowerCase().replace(/\s+/g, "-");
  if (dict[normalized]?.[locale]) {
    return dict[normalized][locale];
  }
  const lower = str.toLowerCase();
  if (dict[lower]?.[locale]) {
    return dict[lower][locale];
  }
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function ProductSpecsBox({ product, selectedOptions, activeVariant }: ProductSpecsBoxProps) {
  const rawLocale = useLocale();
  const locale: Locale = rawLocale === "en" || rawLocale === "pt" ? rawLocale : "es";

  const specs: SpecItem[] = [];

  // 1. Modelo de mate
  const rawTipoMate =
    product.attributes?.["tipo-mate"] ??
    selectedOptions?.["tipo-mate"] ??
    (product.category === "mates" ? (product.filterData?.mateType || product.filterData?.productTypes?.[0]) : undefined);
  if (rawTipoMate) {
    specs.push({
      key: "tipo-mate",
      label: locale === "en" ? "Mate style" : locale === "pt" ? "Modelo de cuia" : "Modelo de mate",
      value: lookup(tipoMateMap, rawTipoMate, locale),
    });
  }

  // 2. Tipo de cuchillo
  const rawTipoCuchillo = product.attributes?.["tipo-cuchillo"] ?? selectedOptions?.["tipo-cuchillo"];
  if (rawTipoCuchillo) {
    specs.push({
      key: "tipo-cuchillo",
      label: locale === "en" ? "Knife type" : locale === "pt" ? "Tipo de faca" : "Tipo de cuchillo",
      value: lookup(tipoCuchilloMap, rawTipoCuchillo, locale),
    });
  }

  // 3. Tipo de bombilla
  const rawTipoBombilla = product.attributes?.["tipo-bombilla"] ?? selectedOptions?.["tipo-bombilla"];
  if (rawTipoBombilla) {
    specs.push({
      key: "tipo-bombilla",
      label: locale === "en" ? "Straw type" : locale === "pt" ? "Tipo de bomba" : "Tipo de bombilla",
      value: lookup(tipoBombillaMap, rawTipoBombilla, locale),
    });
  }

  // 4. Material
  const rawMaterial = product.attributes?.material ?? product.materials?.[0];
  if (rawMaterial) {
    specs.push({
      key: "material",
      label: "Material",
      value: lookup(materialMap, rawMaterial, locale),
    });
  }

  // 5. Material del cuerpo (bombillas)
  const rawMaterialCuerpo = product.attributes?.["material-cuerpo"] ?? selectedOptions?.["material-cuerpo"];
  if (rawMaterialCuerpo) {
    specs.push({
      key: "material-cuerpo",
      label: locale === "en" ? "Body material" : locale === "pt" ? "Material do corpo" : "Material del cuerpo",
      value: lookup(materialCuerpoMap, rawMaterialCuerpo, locale),
    });
  }

  // 6. Material del cabo (cuchillos)
  const rawMaterialCabo = product.attributes?.["material-cabo"] ?? selectedOptions?.["material-cabo"];
  if (rawMaterialCabo) {
    specs.push({
      key: "material-cabo",
      label: locale === "en" ? "Handle material" : locale === "pt" ? "Material do cabo" : "Material del cabo",
      value: lookup(materialCaboMap, rawMaterialCabo, locale),
    });
  }

  // 7. Material de la vaina (cuchillos)
  const rawMaterialVaina = product.attributes?.["material-vaina"] ?? selectedOptions?.["material-vaina"];
  if (rawMaterialVaina) {
    specs.push({
      key: "material-vaina",
      label: locale === "en" ? "Sheath material" : locale === "pt" ? "Material da bainha" : "Material de la vaina",
      value: lookup(materialVainaMap, rawMaterialVaina, locale),
    });
  }

  // 8. Color
  let colorValue = "";
  if (selectedOptions?.color) {
    colorValue = lookup(colorMap, selectedOptions.color, locale);
  } else if (activeVariant?.color || activeVariant?.options?.color) {
    colorValue = lookup(colorMap, activeVariant.color || activeVariant.options?.color, locale);
  } else {
    const variantColors = (product.variants ?? [])
      .map((v) => v.options?.color ?? v.color)
      .filter((c): c is string => typeof c === "string" && c.trim().length > 0);
    const filterColors = product.filterData?.colors ?? [];
    const attrColor = product.attributes?.color ? [String(product.attributes.color)] : [];
    const allColors = [...new Set([...variantColors, ...filterColors, ...attrColor])];
    if (allColors.length > 0) {
      colorValue = allColors.map((c) => lookup(colorMap, c, locale)).join(", ");
    }
  }
  if (colorValue) {
    specs.push({
      key: "color",
      label: locale === "pt" ? "Cor" : "Color",
      value: colorValue,
    });
  }

  // 9. Forma
  const rawForma = product.attributes?.forma ?? selectedOptions?.forma ?? activeVariant?.options?.forma;
  if (rawForma) {
    specs.push({
      key: "forma",
      label: locale === "en" ? "Shape" : "Forma",
      value: lookup(formaMap, rawForma, locale),
    });
  }

  // 10. Forma del pico (bombillas)
  const rawFormaPico = product.attributes?.["forma-pico"] ?? selectedOptions?.["forma-pico"];
  if (rawFormaPico) {
    specs.push({
      key: "forma-pico",
      label: locale === "en" ? "Spout shape" : locale === "pt" ? "Formato do bico" : "Forma del pico",
      value: lookup(formaPicoMap, rawFormaPico, locale),
    });
  }

  // 11. Decoración (bombillas)
  const rawDecoracion = product.attributes?.decoracion ?? selectedOptions?.decoracion;
  if (rawDecoracion) {
    specs.push({
      key: "decoracion",
      label: locale === "en" ? "Decoration" : locale === "pt" ? "Decoração" : "Decoración",
      value: lookup(decoracionMap, rawDecoracion, locale),
    });
  }

  // 12. Tamaño
  let tamanoValue = "";
  if (selectedOptions?.tamano) {
    tamanoValue = lookup(tamanoMap, selectedOptions.tamano, locale);
  } else if (activeVariant?.options?.tamano) {
    tamanoValue = lookup(tamanoMap, activeVariant.options.tamano, locale);
  } else if (product.attributes?.tamano) {
    tamanoValue = lookup(tamanoMap, product.attributes.tamano, locale);
  } else {
    const variantTamanos = (product.variants ?? [])
      .map((v) => v.options?.tamano)
      .filter((t): t is string => typeof t === "string" && t.trim().length > 0);
    const uniqueTamanos = [...new Set(variantTamanos)];
    if (uniqueTamanos.length > 0) {
      tamanoValue = uniqueTamanos.map((t) => lookup(tamanoMap, t, locale)).join(", ");
    }
  }
  if (tamanoValue) {
    specs.push({
      key: "tamano",
      label: locale === "en" ? "Size" : locale === "pt" ? "Tamanho" : "Tamaño",
      value: tamanoValue,
    });
  }

  // 13. Capacidad
  const rawCapacidad =
    selectedOptions?.["capacidad-ml"] ??
    activeVariant?.options?.["capacidad-ml"] ??
    product.attributes?.["capacidad-ml"];
  if (rawCapacidad !== undefined && rawCapacidad !== null && rawCapacidad !== "") {
    const capStr = String(rawCapacidad).trim();
    specs.push({
      key: "capacidad-ml",
      label: locale === "en" ? "Capacity" : locale === "pt" ? "Capacidade" : "Capacidad",
      value: capStr.toLowerCase().endsWith("ml") ? capStr : `${capStr} ml`,
    });
  }

  // 14. Largo de hoja (cuchillos)
  const rawLargoHoja = product.attributes?.["largo-hoja-mm"] ?? selectedOptions?.["largo-hoja-mm"];
  if (rawLargoHoja !== undefined && rawLargoHoja !== null && rawLargoHoja !== "") {
    const hojaStr = String(rawLargoHoja).trim();
    specs.push({
      key: "largo-hoja-mm",
      label: locale === "en" ? "Blade length" : locale === "pt" ? "Comprimento da lâmina" : "Largo de hoja",
      value: hojaStr.toLowerCase().endsWith("mm") ? hojaStr : `${hojaStr} mm`,
    });
  }

  // 15. Largo del cinto
  const rawLargoCinto = product.attributes?.["largo-cinto-cm"] ?? selectedOptions?.["largo-cinto-cm"];
  if (rawLargoCinto !== undefined && rawLargoCinto !== null && rawLargoCinto !== "") {
    const cintoStr = String(rawLargoCinto).trim();
    specs.push({
      key: "largo-cinto-cm",
      label: locale === "en" ? "Belt length" : locale === "pt" ? "Comprimento do cinto" : "Largo del cinto",
      value: cintoStr.toLowerCase().endsWith("cm") ? cintoStr : `${cintoStr} cm`,
    });
  }

  // 16. Talle
  let talleValue = "";
  if (selectedOptions?.talle !== undefined && selectedOptions.talle !== "") {
    talleValue = String(selectedOptions.talle);
  } else if (activeVariant?.options?.talle !== undefined && activeVariant.options.talle !== "") {
    talleValue = String(activeVariant.options.talle);
  } else if (product.attributes?.talle !== undefined && product.attributes.talle !== "") {
    talleValue = String(product.attributes.talle);
  } else {
    const variantTalles = (product.variants ?? [])
      .map((v) => v.options?.talle)
      .filter((t): t is string | number => t !== undefined && t !== "");
    const uniqueTalles = [...new Set(variantTalles.map(String))];
    if (uniqueTalles.length > 0) {
      talleValue = uniqueTalles.join(", ");
    }
  }
  if (talleValue) {
    specs.push({
      key: "talle",
      label: locale === "en" ? "Size" : locale === "pt" ? "Tamanho" : "Talle",
      value: talleValue,
    });
  }

  // 17. Género
  const rawGenero = product.attributes?.genero ?? selectedOptions?.genero;
  if (rawGenero) {
    specs.push({
      key: "genero",
      label: locale === "en" ? "Gender" : locale === "pt" ? "Gênero" : "Género",
      value: lookup(generoMap, rawGenero, locale),
    });
  }

  if (specs.length === 0) {
    return null;
  }

  return (
    <div className="product-specs-card">
      <h3 className="product-specs-title">{titles[locale]}</h3>
      <ul className="product-specs-list">
        {specs.map((item) => (
          <li key={item.key} className="product-specs-item">
            <strong className="product-specs-label">{item.label}:</strong>{" "}
            <span className="product-specs-value">{item.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
