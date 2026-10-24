export type SpecLocale = "es" | "en" | "pt";

const labels: Record<string, Partial<Record<SpecLocale, string>>> = {
  material: { es: "Material", en: "Material", pt: "Material" },
  forma: { en: "Shape", pt: "Forma" },
  "tipo-mate": { en: "Mate style", pt: "Modelo de cuia" },
  "material-mate": { en: "Mate material", pt: "Material da cuia" },
  "tipo-virola": { en: "Rim type", pt: "Tipo de virola" },
  "tipo-cuero": { en: "Leather type", pt: "Tipo de couro" },
  "diseno-fleje": { en: "Rim design", pt: "Desenho da faixa" },
  "tipo-bombilla": { en: "Straw type", pt: "Tipo de bomba" },
  "material-cuerpo": { en: "Body material", pt: "Material do corpo" },
  "material-pico": { en: "Tip material", pt: "Material do bico" },
  "forma-pico": { en: "Tip shape", pt: "Formato do bico" },
  "tamano": { en: "Size", pt: "Tamanho" },
  "interior": { en: "Interior", pt: "Interior" },
  "talle": { es: "Talle", en: "Boot size", pt: "Número da bota" },
  "tipo-cierre": { es: "Cierre y sujeción", en: "Fastening", pt: "Fecho e ajuste" },
  "largo-mm": { en: "Length", pt: "Comprimento" },
  "largo-cinto-cm": { en: "Belt length", pt: "Comprimento do cinto" },
  "capacidad-ml": { en: "Capacity", pt: "Capacidade" },
  "genero": { en: "Gender", pt: "Gênero" },
  "posamate": { en: "Mate coaster", pt: "Apoio para cuia" },
  "pie": { en: "Base", pt: "Base" },
  "coleccion": { en: "Collection", pt: "Coleção" },
  "decoracion": { en: "Decoration", pt: "Decoração" },
  "diametro-cano-mm": { en: "Tube diameter", pt: "Diâmetro do tubo" },
  color: { en: "Color", pt: "Cor" },
};

const footwearSizeLabels: Record<string, Record<SpecLocale, string>> = {
  zuecos: { es: "Número de zueco", en: "Clog size", pt: "Número do tamanco" },
  zapatos: { es: "Número de zapato", en: "Shoe size", pt: "Número do sapato" },
};

const valueNames: Record<string, Record<SpecLocale, string>> = {
  Cuero: { es: "Cuero", en: "Leather", pt: "Couro" },
  Ovalada: { es: "Ovalada", en: "Oval", pt: "Ovalada" },
  Cuadrada: { es: "Cuadrada", en: "Square", pt: "Quadrada" },
  Hombre: { es: "Hombre", en: "Men", pt: "Masculino" },
  Mujer: { es: "Mujer", en: "Women", pt: "Feminino" },
  Unisex: { es: "Unisex", en: "Unisex", pt: "Unissex" },
  Chico: { es: "Chico", en: "Small", pt: "Pequeno" },
  Mediano: { es: "Mediano", en: "Medium", pt: "Médio" },
  Grande: { es: "Grande", en: "Large", pt: "Grande" },
  Calabaza: { es: "Calabaza", en: "Gourd", pt: "Cabaça" },
  "Cerámica": { es: "Cerámica", en: "Ceramic", pt: "Cerâmica" },
  "Larga (19 cm)": { es: "Larga (19 cm)", en: "Long (19 cm)", pt: "Longa (19 cm)" },
  "Corta (16 cm)": { es: "Corta (16 cm)", en: "Short (16 cm)", pt: "Curta (16 cm)" },
  "Con cierre": { es: "Con cierre", en: "With zipper", pt: "Com zíper" },
  "Con cordones": { es: "Con cordones", en: "With laces", pt: "Com cadarços" },
  "Con hebilla": { es: "Con hebilla", en: "With buckle", pt: "Com fivela" },
  "Con elástico": { es: "Con elástico", en: "With elastic", pt: "Com elástico" },
  "Común": { es: "Común", en: "Standard", pt: "Comum" },
  "Con posamate": { es: "Con posamate", en: "With coaster", pt: "Com apoio" },
  "Sin posamate": { es: "Sin posamate", en: "Without coaster", pt: "Sem apoio" },
  Liso: { es: "Liso", en: "Smooth", pt: "Liso" },
  Crudo: { es: "Crudo", en: "Raw", pt: "Cru" },
  Estampado: { es: "Estampado", en: "Embossed", pt: "Estampado" },
  Croco: { es: "Croco", en: "Croc", pt: "Croco" },
  Pelos: { es: "Pelos", en: "Hair-on", pt: "Com pelo" },
  "Sin cuero": { es: "Sin cuero", en: "No leather", pt: "Sem couro" },
  Bronce: { es: "Bronce", en: "Bronze", pt: "Bronze" },
  Acero: { es: "Acero", en: "Steel", pt: "Aço" },
  "Acero inoxidable": { es: "Acero inoxidable", en: "Stainless steel", pt: "Aço inoxidável" },
  Plata: { es: "Plata", en: "Silver", pt: "Prata" },
  "Clásica": { es: "Clásica", en: "Classic", pt: "Clássica" },
  Cincelada: { es: "Cincelada", en: "Chiseled", pt: "Cinzelada" },
  "Marrón": { es: "Marrón", en: "Brown", pt: "Marrom" },
  Negro: { es: "Negro", en: "Black", pt: "Preto" },
  Rosado: { es: "Rosado", en: "Pink", pt: "Rosa" },
  "Metálico": { es: "Metálico", en: "Metallic", pt: "Metálico" },
};

/** Etiqueta de una característica en el idioma pedido; `fallback` es la etiqueta de la taxonomía (español). */
export function specLabel(code: string, fallback: string, locale: SpecLocale, category?: string) {
  if (code === "talle" && category && footwearSizeLabels[category]) return footwearSizeLabels[category][locale];
  return labels[code]?.[locale] ?? fallback;
}

/** Valor de una característica traducido cuando existe traducción; si no, queda el valor de la taxonomía. */
export function specValue(value: string, locale: SpecLocale) {
  return valueNames[value]?.[locale] ?? value;
}
