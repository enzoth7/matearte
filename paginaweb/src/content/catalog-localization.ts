import { categories, editorialMedia, presentationMedia, products } from "@/data/catalog";
import type { Category, Locale, MediaAsset, Product, ProductVariant } from "@/types/catalog";

type ProductCopy = Pick<Product, "name" | "eyebrow" | "summary" | "description">;

const enProducts: Record<string, ProductCopy> = {
  "mate-imperial": {
    name: "Mate Imperial",
    eyebrow: "Leather & alpaca",
    summary: "An iconic silhouette with worked metal and deep-toned leather.",
    description: "A visual reference from the MateArte catalog. Availability, measurements and finishes will be confirmed when the commercial catalog is connected.",
  },
  "imperial-animal-print": {
    name: "Imperial animal print",
    eyebrow: "A bold piece",
    summary: "The imperial shape with an expressive, contemporary finish.",
    description: "A reference from MateArte's public catalog. Colors, customization and availability will be validated against the commercial catalog.",
  },
  "criollo-posa-mate": {
    name: "Criollo with mate stand",
    eyebrow: "Everyday tradition",
    summary: "A criollo mate paired with a leather stand.",
    description: "A piece shown in the public catalog. Material and size options will be added from the definitive commercial source.",
  },
  "camionero-acero": {
    name: "Camionero with smooth steel",
    eyebrow: "Generous shape",
    summary: "A camionero silhouette with a clean stainless-steel rim.",
    description: "A visual reference without current price or availability. This product page is ready to receive real variants.",
  },
  "mate-torpedo": {
    name: "Mate Torpedo",
    eyebrow: "Streamlined profile",
    summary: "A recognizable shape wrapped in leather and ready to personalize.",
    description: "A model from the public catalog. Finishes and commercial information will be connected later.",
  },
  "bombilla-acero-desarmable": {
    name: "Detachable steel bombilla",
    eyebrow: "Stainless steel",
    summary: "A practical, detachable bombilla designed for easier care.",
    description: "A product from the public catalog. Size and availability are pending commercial integration.",
  },
  "bombilla-alpaca-pico-loro": {
    name: "Alpaca parrot-beak bombilla",
    eyebrow: "Alpaca",
    summary: "The classic parrot-beak profile in an alpaca piece.",
    description: "A reference from the public catalog. Selectable sizes will be added when inventory is connected.",
  },
  "limpia-bombillas": {
    name: "Bombilla cleaning brush",
    eyebrow: "Care",
    summary: "A simple accessory for regular bombilla maintenance.",
    description: "A visual reference from the MateArte catalog, without current price or availability.",
  },
  "matera-colgar-cuero": {
    name: "Leather hanging matera",
    eyebrow: "Leather on the go",
    summary: "A compact matera with a strap, made to move with you.",
    description: "A piece from the public catalog. Colors and availability will be confirmed against commercial inventory.",
  },
  "matera-cuadrada-cuero": {
    name: "Square leather matera",
    eyebrow: "Practical craft",
    summary: "A structured format for organizing a mate, thermos and accessories.",
    description: "A visual reference from the public catalog. It does not represent current stock or pricing.",
  },
  "matera-ovalada-cuero": {
    name: "Oval leather matera",
    eyebrow: "Worked leather",
    summary: "A wraparound format for carrying your mate set.",
    description: "A product from the public catalog. Finishes and availability will be confirmed later.",
  },
  "termo-stanley-800": {
    name: "Stanley 800 ml thermos",
    eyebrow: "Mate gear",
    summary: "A compact format for enjoying mate away from home.",
    description: "A visual reference from the public catalog. The trade name, stock and variants must be validated when the supplier is connected.",
  },
  "termo-stanley-12": {
    name: "Stanley 1.2 l thermos",
    eyebrow: "More capacity",
    summary: "A larger thermos for gatherings, trips and long days.",
    description: "A reference from the public catalog without current price or availability.",
  },
  "termo-termolar-1l": {
    name: "Termolar 1 l thermos",
    eyebrow: "Everyday classic",
    summary: "A one-liter thermos designed for daily use.",
    description: "A visual catalog reference. Stock, color and pricing will come from the real commercial source.",
  },
  "set-premium": {
    name: "Premium set",
    eyebrow: "A gift idea",
    summary: "A composition of MateArte pieces in natural tones.",
    description: "Editorial inspiration based on the brand's public material. The exact contents and availability must be confirmed.",
  },
  "box-matero": {
    name: "Mate box",
    eyebrow: "A gift idea",
    summary: "A mate selection presented as gift inspiration.",
    description: "Editorial brand content, subject to validation of its contents and rights before publication.",
  },
};

const ptProducts: Record<string, ProductCopy> = {
  "mate-imperial": {
    name: "Mate Imperial",
    eyebrow: "Couro & alpaca",
    summary: "Uma silhueta emblemática com metal trabalhado e couro em tom profundo.",
    description: "Referência visual do catálogo MateArte. A disponibilidade, as medidas e os acabamentos serão confirmados quando o catálogo comercial estiver conectado.",
  },
  "imperial-animal-print": {
    name: "Imperial animal print",
    eyebrow: "Peça de personalidade",
    summary: "O formato imperial com um acabamento expressivo e contemporâneo.",
    description: "Uma referência do catálogo público da MateArte. Cores, personalização e disponibilidade serão validadas com o catálogo comercial.",
  },
  "criollo-posa-mate": {
    name: "Crioulo com apoio para mate",
    eyebrow: "Tradição cotidiana",
    summary: "Mate crioulo acompanhado por uma base de couro.",
    description: "Peça apresentada no catálogo público. As opções de material e tamanho serão incorporadas com a fonte comercial definitiva.",
  },
  "camionero-acero": {
    name: "Camionero com aço liso",
    eyebrow: "Formato amplo",
    summary: "Silhueta camionera com uma borda sóbria de aço inoxidável.",
    description: "Referência visual sem preço ou disponibilidade vigentes. A página está preparada para receber variantes reais.",
  },
  "mate-torpedo": {
    name: "Mate Torpedo",
    eyebrow: "Perfil estilizado",
    summary: "Um formato reconhecível, revestido em couro e pronto para personalizar.",
    description: "Modelo do catálogo público. Os acabamentos e as informações comerciais serão conectados posteriormente.",
  },
  "bombilla-acero-desarmable": {
    name: "Bombilla desmontável de aço",
    eyebrow: "Aço inoxidável",
    summary: "Uma bombilla prática e desmontável para facilitar o cuidado.",
    description: "Produto observado no catálogo público. A medida e a disponibilidade dependem da integração comercial.",
  },
  "bombilla-alpaca-pico-loro": {
    name: "Bombilla de alpaca bico de papagaio",
    eyebrow: "Alpaca",
    summary: "O perfil clássico de bico de papagaio em uma peça de alpaca.",
    description: "Referência do catálogo público. As medidas selecionáveis serão incorporadas ao conectar o estoque.",
  },
  "limpia-bombillas": {
    name: "Escova para bombillas",
    eyebrow: "Cuidado",
    summary: "Um acessório simples para a manutenção habitual da bombilla.",
    description: "Referência visual do catálogo MateArte, sem preço ou disponibilidade vigentes.",
  },
  "matera-colgar-cuero": {
    name: "Matera de couro com alça",
    eyebrow: "Couro para levar",
    summary: "Uma matera compacta com alça para acompanhar seus movimentos.",
    description: "Peça do catálogo público. As cores e a disponibilidade serão confirmadas com o estoque comercial.",
  },
  "matera-cuadrada-cuero": {
    name: "Matera quadrada de couro",
    eyebrow: "Ofício prático",
    summary: "Formato estruturado para organizar mate, garrafa térmica e acessórios.",
    description: "Referência visual do catálogo público. Não representa estoque ou preço vigente.",
  },
  "matera-ovalada-cuero": {
    name: "Matera oval de couro",
    eyebrow: "Couro trabalhado",
    summary: "Um formato envolvente para transportar o conjunto de mate.",
    description: "Produto observado no catálogo público. Acabamentos e disponibilidade serão confirmados mais adiante.",
  },
  "termo-stanley-800": {
    name: "Garrafa térmica Stanley 800 ml",
    eyebrow: "Equipamento para mate",
    summary: "Formato compacto para acompanhar o mate fora de casa.",
    description: "Referência visual do catálogo público. O nome comercial, o estoque e as variantes deverão ser validados ao conectar o fornecedor.",
  },
  "termo-stanley-12": {
    name: "Garrafa térmica Stanley 1,2 l",
    eyebrow: "Maior capacidade",
    summary: "Garrafa de maior volume para encontros, viagens e dias longos.",
    description: "Referência do catálogo público sem preço ou disponibilidade vigentes.",
  },
  "termo-termolar-1l": {
    name: "Garrafa térmica Termolar 1 l",
    eyebrow: "Clássico cotidiano",
    summary: "Uma garrafa térmica de um litro pensada para o uso diário.",
    description: "Referência visual do catálogo. Estoque, cor e preço virão da fonte comercial real.",
  },
  "set-premium": {
    name: "Conjunto premium",
    eyebrow: "Ideia para presentear",
    summary: "Uma composição de peças MateArte em tons naturais.",
    description: "Inspiração editorial baseada em material público da marca. A composição exata e sua disponibilidade devem ser confirmadas.",
  },
  "box-matero": {
    name: "Box de mate",
    eyebrow: "Ideia para presentear",
    summary: "Uma seleção para mate apresentada como inspiração de presente.",
    description: "Conteúdo editorial da marca, sujeito à validação de composição e direitos antes da publicação.",
  },
};

const materialTranslations = {
  en: {
    "Cuero": "Leather",
    "Metal trabajado": "Worked metal",
    "Alpaca": "Alpaca",
    "Metal": "Metal",
    "Acero inoxidable": "Stainless steel",
    "Madera": "Wood",
    "Materiales a confirmar": "Materials to be confirmed",
    "Selección a confirmar": "Selection to be confirmed",
  },
  pt: {
    "Cuero": "Couro",
    "Metal trabajado": "Metal trabalhado",
    "Alpaca": "Alpaca",
    "Metal": "Metal",
    "Acero inoxidable": "Aço inoxidável",
    "Madera": "Madeira",
    "Materiales a confirmar": "Materiais a confirmar",
    "Selección a confirmar": "Seleção a confirmar",
  },
} as const;

const variantTranslations = {
  en: {
    "Terminación": "Finish",
    "Tamaño": "Size",
    "Color": "Color",
    "Cuero": "Leather",
    "Acabado": "Finish",
    "Medida": "Size",
    "A confirmar": "To be confirmed",
    "8 mm o 10 mm, a confirmar": "8 mm or 10 mm, to be confirmed",
  },
  pt: {
    "Terminación": "Acabamento",
    "Tamaño": "Tamanho",
    "Color": "Cor",
    "Cuero": "Couro",
    "Acabado": "Acabamento",
    "Medida": "Medida",
    "A confirmar": "A confirmar",
    "8 mm o 10 mm, a confirmar": "8 mm ou 10 mm, a confirmar",
  },
} as const;

const categoryCopies: Record<Locale, Record<string, { name: string; description: string; alt: string }>> = {
  es: Object.fromEntries(categories.map((category) => [category.slug, { name: category.name, description: category.description, alt: category.image.alt }])),
  en: {
    mates: { name: "Mates", description: "Imperial, camionero, criollo and torpedo styles in noble materials.", alt: "Handcrafted MateArte Mate Imperial" },
    bombillas: { name: "Bombillas", description: "Classic shapes in steel and alpaca for the everyday ritual.", alt: "Metal bombillas" },
    materas: { name: "Materas & kits", description: "Worked leather made to carry mate to every gathering.", alt: "Leather matera" },
    termos: { name: "Thermoses", description: "Durable companions for travel, work and gatherings.", alt: "Thermos for mate" },
    regalos: { name: "Custom gifts", description: "Pieces and sets designed to tell a story of their own.", alt: "Premium mate, thermos and accessory set" },
  },
  pt: {
    mates: { name: "Mates", description: "Imperiais, camioneros, crioulos e torpedos em materiais nobres.", alt: "Mate Imperial artesanal MateArte" },
    bombillas: { name: "Bombillas", description: "Formatos clássicos em aço e alpaca para o ritual cotidiano.", alt: "Bombillas de metal" },
    materas: { name: "Materas & kits", description: "Couro trabalhado para levar o mate a cada encontro.", alt: "Matera de couro" },
    termos: { name: "Garrafas térmicas", description: "Companheiras resistentes para viagens, trabalho e encontros.", alt: "Garrafa térmica para mate" },
    regalos: { name: "Presentes personalizados", description: "Peças e conjuntos pensados para contar uma história própria.", alt: "Conjunto premium de mate, garrafa térmica e acessórios" },
  },
};

const altTranslations: Record<string, { en: string; pt: string }> = {
  "Mate Imperial de cuero oscuro con virola trabajada": { en: "Mate Imperial in dark leather with a worked rim", pt: "Mate Imperial de couro escuro com borda trabalhada" },
  "Detalle frontal del Mate Imperial": { en: "Front detail of the Mate Imperial", pt: "Detalhe frontal do Mate Imperial" },
  "Vista lateral del Mate Imperial": { en: "Side view of the Mate Imperial", pt: "Vista lateral do Mate Imperial" },
  "Detalle de cuero y metal del Mate Imperial": { en: "Leather and metal detail on the Mate Imperial", pt: "Detalhe de couro e metal do Mate Imperial" },
  "Mate Imperial con cuero animal print": { en: "Mate Imperial with animal-print leather", pt: "Mate Imperial com couro animal print" },
  "Mate criollo con posa mate de cuero": { en: "Criollo mate with a leather stand", pt: "Mate crioulo com apoio de couro" },
  "Mate camionero con virola de acero": { en: "Camionero mate with a steel rim", pt: "Mate camionero com borda de aço" },
  "Mate Torpedo de cuero": { en: "Leather Mate Torpedo", pt: "Mate Torpedo de couro" },
  "Bombilla de acero inoxidable desarmable": { en: "Detachable stainless-steel bombilla", pt: "Bombilla desmontável de aço inoxidável" },
  "Bombilla de alpaca pico de loro": { en: "Alpaca parrot-beak bombilla", pt: "Bombilla de alpaca bico de papagaio" },
  "Cepillo limpia bombillas": { en: "Bombilla cleaning brush", pt: "Escova para limpeza de bombillas" },
  "Matera de colgar confeccionada en cuero": { en: "Hanging matera made of leather", pt: "Matera com alça confeccionada em couro" },
  "Matera cuadrada de cuero": { en: "Square leather matera", pt: "Matera quadrada de couro" },
  "Matera ovalada confeccionada en cuero": { en: "Oval matera made of leather", pt: "Matera oval confeccionada em couro" },
  "Termo Stanley de 800 mililitros": { en: "Stanley 800-milliliter thermos", pt: "Garrafa térmica Stanley de 800 mililitros" },
  "Termo Stanley de 1,2 litros": { en: "Stanley 1.2-liter thermos", pt: "Garrafa térmica Stanley de 1,2 litro" },
  "Termo Termolar de un litro": { en: "One-liter Termolar thermos", pt: "Garrafa térmica Termolar de um litro" },
  "Set premium MateArte sobre una mesa de madera": { en: "Premium MateArte set on a wooden table", pt: "Conjunto premium MateArte sobre uma mesa de madeira" },
  "Box matero presentado para regalo": { en: "Mate box presented as a gift", pt: "Box de mate apresentado para presente" },
};

function localizeMedia(media: MediaAsset, locale: Locale): MediaAsset {
  if (locale === "es") return media;
  return { ...media, alt: altTranslations[media.alt]?.[locale] ?? media.alt };
}

function localizeVariant(variant: ProductVariant, locale: Locale): ProductVariant {
  if (locale === "es") return variant;
  const translations = variantTranslations[locale];
  return {
    ...variant,
    label: translations[variant.label as keyof typeof translations] ?? variant.label,
    value: translations[variant.value as keyof typeof translations] ?? variant.value,
  };
}

export function getLocalizedProducts(locale: Locale): Product[] {
  if (locale === "es") return products;
  const copies = locale === "en" ? enProducts : ptProducts;
  const materialCopy = materialTranslations[locale];
  return products.map((product) => ({
    ...product,
    ...copies[product.id],
    materials: product.materials.map((material) => materialCopy[material as keyof typeof materialCopy] ?? material),
    images: product.images.map((image) => localizeMedia(image, locale)),
    variants: product.variants.map((variant) => localizeVariant(variant, locale)),
  }));
}

export function getLocalizedProduct(slug: string, locale: Locale) {
  return getLocalizedProducts(locale).find((product) => product.slug === slug);
}

export function localizeCatalogSnapshotTitle(title: string, locale: Locale) {
  if (locale === "es") return title;
  const [name, ...details] = title.split(" — ");
  const normalized = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es").trim();
  const source = products.find((product) => {
    const candidate = product.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es").trim();
    return normalized === candidate || normalized.includes(candidate) || candidate.includes(normalized);
  });
  if (!source) return title;
  const localizedName = getLocalizedProducts(locale).find((product) => product.id === source.id)?.name ?? name;
  return [localizedName, ...details].join(" — ");
}

export function getLocalizedCategories(locale: Locale): Category[] {
  return categories.map((category) => ({
    ...category,
    ...categoryCopies[locale][category.slug],
    image: { ...category.image, alt: categoryCopies[locale][category.slug].alt },
  }));
}

export function getLocalizedEditorialMedia(locale: Locale) {
  return Object.fromEntries(Object.entries(editorialMedia).map(([key, media]) => [key, localizeMedia(media, locale)])) as typeof editorialMedia;
}

export function getLocalizedPresentationMedia(locale: Locale) {
  if (locale === "es") return presentationMedia;
  return {
    ...presentationMedia,
    brandLogo: localizeMedia(presentationMedia.brandLogo, locale),
    countryBrand: localizeMedia(presentationMedia.countryBrand, locale),
    countryBrandLockup: localizeMedia(presentationMedia.countryBrandLockup, locale),
    footballAssociationLogo: localizeMedia(presentationMedia.footballAssociationLogo, locale),
    personalities: presentationMedia.personalities.map((media) => localizeMedia(media, locale)),
  };
}

export const catalogTranslationCoverage = {
  en: Object.keys(enProducts),
  pt: Object.keys(ptProducts),
};
