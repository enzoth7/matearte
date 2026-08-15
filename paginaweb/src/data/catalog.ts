import type { Category, MediaAsset, Product, VideoAsset } from "@/types/catalog";

const base = "/assets/matearte";
const webSource = "https://matearte.uy/";
const instagramSource = "https://www.instagram.com/matearteuruguay/";

function webImage(
  src: string,
  alt: string,
  width: number,
  height: number,
): MediaAsset {
  return {
    src: `${base}/${src}`,
    alt,
    width,
    height,
    source: "web",
    sourceUrl: webSource,
    rightsStatus: "brand-public",
  };
}

function socialImage(
  src: string,
  alt: string,
  width: number,
  height: number,
  rightsStatus: MediaAsset["rightsStatus"] = "pending-social",
): MediaAsset {
  return {
    src: `${base}/${src}`,
    alt,
    width,
    height,
    source: "instagram",
    sourceUrl: instagramSource,
    rightsStatus,
  };
}

function providedImage(
  src: string,
  alt: string,
  width: number,
  height: number,
  rightsStatus: MediaAsset["rightsStatus"] = "presentation-only",
): MediaAsset {
  return {
    src: `${base}/${src}`,
    alt,
    width,
    height,
    source: "provided",
    sourceUrl: "Material entregado por MateArte para esta presentación",
    rightsStatus,
  };
}

export const categories: Category[] = [
  {
    slug: "mates",
    name: "Mates",
    description: "Imperiales, camioneros, criollos y torpedos en materiales nobles.",
    image: webImage("02-banners-y-categorias/foto-mate-imperial.webp", "Mate Imperial artesanal MateArte", 816, 1024),
  },
  {
    slug: "bombillas",
    name: "Bombillas",
    description: "Formas clásicas en acero y alpaca para el ritual cotidiano.",
    image: webImage("02-banners-y-categorias/categoria-bombillas.webp", "Bombillas de metal", 672, 325),
  },
  {
    slug: "materas",
    name: "Materas & kits",
    description: "Cuero trabajado para llevar el mate a cada encuentro.",
    image: webImage("02-banners-y-categorias/categoria-materas.avif", "Matera de cuero", 263, 325),
  },
  {
    slug: "termos",
    name: "Termos",
    description: "Compañeros resistentes para viajes, trabajo y reuniones.",
    image: webImage("02-banners-y-categorias/categoria-termos.webp", "Termo para mate", 381, 326),
  },
  {
    slug: "regalos",
    name: "Regalos",
    description: "Piezas y conjuntos pensados para contar una historia propia.",
    image: socialImage("04-instagram/seleccion-hd/02-set-premium.jpg", "Set premium de mate, termo y accesorios", 2835, 3544),
  },
];

export const products: Product[] = [
  {
    id: "mate-imperial",
    slug: "mate-imperial",
    name: "Mate Imperial",
    category: "mates",
    eyebrow: "Cuero & alpaca",
    summary: "Una silueta emblemática con metal trabajado y cuero de tono profundo.",
    description: "Referencia visual del catálogo MateArte. La disponibilidad, las medidas y las terminaciones se confirmarán cuando el catálogo comercial esté conectado.",
    materials: ["Cuero", "Metal trabajado"],
    featured: true,
    variants: [
      { id: "terminacion", label: "Terminación", value: "A confirmar" },
      { id: "tamano", label: "Tamaño", value: "A confirmar" },
    ],
    images: [
      webImage("03-productos-web/01-mate-imperial.jpg", "Mate Imperial de cuero oscuro con virola trabajada", 2800, 3500),
      webImage("03-productos-web/19-mate-imperial-sesion-01.jpg", "Detalle frontal del Mate Imperial", 2788, 3500),
      webImage("03-productos-web/19-mate-imperial-sesion-02.jpg", "Vista lateral del Mate Imperial", 2787, 3500),
      webImage("03-productos-web/19-mate-imperial-sesion-04.jpg", "Detalle de cuero y metal del Mate Imperial", 2777, 3500),
    ],
  },
  {
    id: "imperial-animal-print",
    slug: "mate-imperial-animal-print",
    name: "Imperial animal print",
    category: "mates",
    eyebrow: "Pieza de carácter",
    summary: "El formato imperial en una terminación expresiva y contemporánea.",
    description: "Una referencia del catálogo público de MateArte. Colores, personalización y disponibilidad se validarán con el catálogo comercial.",
    materials: ["Cuero", "Alpaca"],
    featured: true,
    variants: [{ id: "color", label: "Color", value: "A confirmar" }],
    images: [webImage("03-productos-web/03-mate-imperial-animal-print.jpg", "Mate Imperial con cuero animal print", 4284, 4284)],
  },
  {
    id: "criollo-posa-mate",
    slug: "mate-criollo-con-posa-mate",
    name: "Criollo con posa mate",
    category: "mates",
    eyebrow: "Tradición cotidiana",
    summary: "Mate criollo acompañado por una base de cuero.",
    description: "Pieza presentada en el catálogo público. Las opciones de material y tamaño se incorporarán con la fuente comercial definitiva.",
    materials: ["Cuero", "Metal"],
    featured: true,
    variants: [{ id: "tamano", label: "Tamaño", value: "A confirmar" }],
    images: [webImage("03-productos-web/02-mate-criollo-con-posa-mate.png", "Mate criollo con posa mate de cuero", 1080, 1080)],
  },
  {
    id: "camionero-acero",
    slug: "mate-camionero-acero-liso",
    name: "Camionero con acero liso",
    category: "mates",
    eyebrow: "Forma amplia",
    summary: "Silueta camionera con una virola sobria de acero inoxidable.",
    description: "Referencia visual sin precio ni disponibilidad vigente. La ficha está preparada para recibir variantes reales.",
    materials: ["Cuero", "Acero inoxidable"],
    variants: [{ id: "color", label: "Cuero", value: "A confirmar" }],
    images: [webImage("03-productos-web/09-mate-camionero-virola-acero-inoxidable-liso.png", "Mate camionero con virola de acero", 573, 573)],
  },
  {
    id: "mate-torpedo",
    slug: "mate-torpedo",
    name: "Mate Torpedo",
    category: "mates",
    eyebrow: "Perfil estilizado",
    summary: "Una forma reconocible, envuelta en cuero y lista para personalizar.",
    description: "Modelo del catálogo público. Los acabados y la información comercial se conectarán posteriormente.",
    materials: ["Cuero", "Metal"],
    variants: [{ id: "acabado", label: "Acabado", value: "A confirmar" }],
    images: [webImage("03-productos-web/16-mate-torpedo.png", "Mate Torpedo de cuero", 573, 573)],
  },
  {
    id: "bombilla-acero-desarmable",
    slug: "bombilla-acero-desarmable",
    name: "Bombilla de acero desarmable",
    category: "bombillas",
    eyebrow: "Acero inoxidable",
    summary: "Una bombilla práctica y desmontable para facilitar su cuidado.",
    description: "Producto observado en el catálogo público. Medida y disponibilidad quedan pendientes de la integración comercial.",
    materials: ["Acero inoxidable"],
    featured: true,
    variants: [{ id: "medida", label: "Medida", value: "A confirmar" }],
    images: [webImage("03-productos-web/07-bombilla-de-acero-desarmable.jpg", "Bombilla de acero inoxidable desarmable", 3024, 4032)],
  },
  {
    id: "bombilla-alpaca-pico-loro",
    slug: "bombilla-alpaca-pico-loro",
    name: "Bombilla de alpaca pico de loro",
    category: "bombillas",
    eyebrow: "Alpaca",
    summary: "Perfil clásico de pico de loro en una pieza de alpaca.",
    description: "Referencia del catálogo público. La medida elegible se incorporará al conectar el inventario.",
    materials: ["Alpaca"],
    variants: [{ id: "medida", label: "Medida", value: "8 mm o 10 mm, a confirmar" }],
    images: [webImage("03-productos-web/13-bombilla-de-alpaca-de-10mm-o-8-mm-pico-loro.png", "Bombilla de alpaca pico de loro", 573, 573)],
  },
  {
    id: "limpia-bombillas",
    slug: "limpia-bombillas",
    name: "Limpia bombillas",
    category: "bombillas",
    eyebrow: "Cuidado",
    summary: "Accesorio simple para el mantenimiento habitual de la bombilla.",
    description: "Referencia visual del catálogo MateArte, sin precio ni disponibilidad vigentes.",
    materials: ["Metal"],
    variants: [],
    images: [webImage("03-productos-web/08-limpia-bombillas.png", "Cepillo limpia bombillas", 573, 573)],
  },
  {
    id: "matera-colgar-cuero",
    slug: "matera-de-colgar-cuero",
    name: "Matera de colgar de cuero",
    category: "materas",
    eyebrow: "Cuero para llevar",
    summary: "Una matera compacta con correa para acompañar el movimiento.",
    description: "Pieza del catálogo público. Colores y disponibilidad se confirmarán con el inventario comercial.",
    materials: ["Cuero"],
    featured: true,
    variants: [{ id: "color", label: "Color", value: "A confirmar" }],
    images: [webImage("03-productos-web/10-matera-de-colgar-de-cuero.png", "Matera de colgar confeccionada en cuero", 573, 573)],
  },
  {
    id: "matera-cuadrada-cuero",
    slug: "matera-cuadrada-cuero",
    name: "Matera cuadrada de cuero",
    category: "materas",
    eyebrow: "Oficio práctico",
    summary: "Formato estructurado para organizar mate, termo y accesorios.",
    description: "Referencia visual del catálogo público. No representa stock ni precio vigente.",
    materials: ["Cuero"],
    variants: [{ id: "color", label: "Color", value: "A confirmar" }],
    images: [webImage("03-productos-web/11-matera-cuadrada-de-cuero.png", "Matera cuadrada de cuero", 573, 573)],
  },
  {
    id: "matera-ovalada-cuero",
    slug: "matera-ovalada-cuero",
    name: "Matera ovalada de cuero",
    category: "materas",
    eyebrow: "Cuero trabajado",
    summary: "Un formato envolvente para transportar el equipo matero.",
    description: "Producto observado en el catálogo público. Terminaciones y disponibilidad se confirmarán más adelante.",
    materials: ["Cuero"],
    variants: [{ id: "color", label: "Color", value: "A confirmar" }],
    images: [webImage("03-productos-web/12-matera-ovalada-de-cuero.jpg", "Matera ovalada confeccionada en cuero", 2056, 2553)],
  },
  {
    id: "termo-stanley-800",
    slug: "termo-stanley-800-ml",
    name: "Termo Stanley 800 ml",
    category: "termos",
    eyebrow: "Equipo matero",
    summary: "Formato compacto para acompañar el mate fuera de casa.",
    description: "Referencia visual del catálogo público. El nombre comercial, stock y variantes deberán validarse al conectar el proveedor.",
    materials: ["Acero inoxidable"],
    featured: true,
    variants: [{ id: "color", label: "Color", value: "A confirmar" }],
    images: [webImage("03-productos-web/04-termo-stanley-800-ml.png", "Termo Stanley de 800 mililitros", 1080, 1080)],
  },
  {
    id: "termo-stanley-12",
    slug: "termo-stanley-12-l",
    name: "Termo Stanley 1,2 l",
    category: "termos",
    eyebrow: "Mayor capacidad",
    summary: "Termo de mayor volumen para reuniones, viajes y jornadas largas.",
    description: "Referencia del catálogo público sin precio ni disponibilidad vigentes.",
    materials: ["Acero inoxidable"],
    variants: [{ id: "color", label: "Color", value: "A confirmar" }],
    images: [webImage("03-productos-web/05-termo-stanley-12-l.png", "Termo Stanley de 1,2 litros", 1080, 1080)],
  },
  {
    id: "termo-termolar-1l",
    slug: "termo-termolar-1l",
    name: "Termo Termolar 1 l",
    category: "termos",
    eyebrow: "Clásico cotidiano",
    summary: "Un termo de un litro pensado para el uso diario.",
    description: "Referencia visual del catálogo. Stock, color y precio se incorporarán desde la fuente comercial real.",
    materials: ["Materiales a confirmar"],
    variants: [{ id: "color", label: "Color", value: "A confirmar" }],
    images: [webImage("03-productos-web/14-termo-termolar-1l.png", "Termo Termolar de un litro", 573, 573)],
  },
  {
    id: "set-premium",
    slug: "set-premium",
    name: "Set premium",
    category: "regalos",
    eyebrow: "Idea para regalar",
    summary: "Una composición de piezas MateArte en tonos naturales.",
    description: "Inspiración editorial basada en material público de la marca. La composición exacta y su disponibilidad deben confirmarse.",
    materials: ["Cuero", "Metal", "Madera"],
    editorial: true,
    featured: true,
    variants: [],
    images: [socialImage("04-instagram/seleccion-hd/02-set-premium.jpg", "Set premium MateArte sobre una mesa de madera", 2835, 3544)],
  },
  {
    id: "box-matero",
    slug: "box-matero",
    name: "Box matero",
    category: "regalos",
    eyebrow: "Idea para regalar",
    summary: "Una selección matera presentada como inspiración para un obsequio.",
    description: "Contenido editorial de la marca, sujeto a validación de composición y derechos antes de publicar.",
    materials: ["Selección a confirmar"],
    editorial: true,
    variants: [],
    images: [socialImage("04-instagram/seleccion-hd/06-box-matero.jpg", "Box matero presentado para regalo", 781, 1041)],
  },
];

export function getProduct(slug: string) {
  return products.find((product) => product.slug === slug);
}

export function getCategory(slug: string) {
  return categories.find((category) => category.slug === slug);
}

export const featuredProducts = products.filter((product) => product.featured).slice(0, 6);

export const editorialMedia = {
  hero: socialImage("04-instagram/seleccion-hd/02-set-premium.jpg", "Conjunto MateArte de cuero, metal y madera", 2835, 3544),
  personalization: socialImage("04-instagram/seleccion-hd/03-mate-personalizado.jpg", "Detalle de un mate personalizado", 3277, 4096),
  craft: socialImage("04-instagram/feed-preview/06-fabricacion-artesanal.jpg", "Manos trabajando artesanalmente una pieza de cuero", 360, 640),
  tradition: socialImage("04-instagram/seleccion-hd/05-cuchillo-y-tabla.jpg", "Cuchillo artesanal y tabla de madera", 1448, 1931),
  lifestyle: socialImage("04-instagram/seleccion-hd/01-matera-camel-escaleras.jpg", "Matera camel con termo y mate", 1086, 1448),
  store: socialImage("04-instagram/destacados/06-local-paysandu.jpg", "Interior del local MateArte en Paysandú", 640, 1138),
  footballPlayer: socialImage("04-instagram/destacados/01-josema-gimenez-con-mate.jpg", "José María Giménez con un mate", 640, 1203, "pending-personality"),
  footballCrests: socialImage("04-instagram/destacados/02-escudos-auf-atletico-madrid.jpg", "Mate con escudos deportivos", 640, 1138, "pending-trademark"),
};

const presentationVideos: VideoAsset[] = [
  {
    id: "seleccion-uruguaya",
    src: `${base}/MatesAUF.mp4`,
    poster: `${base}/MatesAUF-poster.jpg`,
    title: "La tradición viste a Uruguay.",
    eyebrow: "MateArte × la Celeste",
    description: "Una pieza creada para representar identidad, oficio y pertenencia.",
    width: 720,
    height: 1280,
    durationSeconds: 26.72,
    rightsStatus: "presentation-only",
  },
  {
    id: "piezas-personalizadas",
    src: `${base}/MatesAUF2.mp4`,
    poster: `${base}/MatesAUF2-poster.jpg`,
    title: "Un nombre vuelve única cada pieza.",
    eyebrow: "Personalización",
    description: "Grabados, símbolos y terminaciones transforman el mate en memoria.",
    width: 720,
    height: 1280,
    durationSeconds: 26.68,
    rightsStatus: "presentation-only",
  },
  {
    id: "ritual-de-seleccion",
    src: `${base}/MatesUruguayMatch.mp4`,
    poster: `${base}/MatesUruguayMatch-poster.jpg`,
    title: "El ritual antes del partido.",
    eyebrow: "Uruguay & fútbol",
    description: "El mate acompaña la preparación, la conversación y el encuentro.",
    width: 720,
    height: 1280,
    durationSeconds: 22.4,
    rightsStatus: "presentation-only",
  },
];

export const presentationMedia = {
  brandLogo: providedImage("MatearteLogo.jpg", "Monograma MateArte Arte & Tradición", 1080, 1080, "brand-public"),
  countryBrand: providedImage("UruguayNaturalLogo.png", "Logo Uruguay", 278, 297, "pending-trademark"),
  countryBrandLockup: providedImage("UruguayNaturalLSQA.jpg", "Composición Uruguay, LSQA y MateArte", 640, 801, "pending-trademark"),
  footballAssociationLogo: providedImage("AUFLogo.png", "Escudo de la Asociación Uruguaya de Fútbol", 720, 1260, "pending-trademark"),
  personalities: [
    providedImage("Darwin.jpg", "Darwin Núñez junto a un representante de MateArte", 640, 748, "pending-personality"),
    providedImage("Gimenez.jpg", "José María Giménez junto a un representante de MateArte", 640, 748, "pending-personality"),
    providedImage("Valverde.jpg", "Federico Valverde junto a un representante de MateArte", 640, 748, "pending-personality"),
  ],
  videos: presentationVideos,
};
