import type { MateModel, MateSize } from "./mateCatalog";
import { engravingTechniqueAssetManifest } from "./engravingTechniqueAssetManifest";

export type MateFamilyId = "camionero" | "imperial" | "torpedo" | "criollo";
export type EngravingTypeId = "laser" | "bronze-applique" | "alpaca-applique";
export type MateSelectionStage = "model" | "texture" | "metal" | "size" | "engraving" | "fleje-engraving";
export type CatalogOptionStatus = "ready" | "pending";

export interface MateSelection {
  familyId: MateFamilyId | null;
  textureId: string | null;
  colorId: string | null;
  metalId: string | null;
  sizeId: MateSize | null;
  engravingTypeId: EngravingTypeId | null;
  flejeEngravingTypeId: EngravingTypeId | null;
}

export interface MateCapabilities {
  hasRim: boolean;
  hasFleje: boolean;
}

/** Which engraving techniques are available for virola and fleje on a given product. */
export interface EngravingCapabilities {
  virolaEngravingTypes: EngravingTypeId[];
  flejeEngravingTypes: EngravingTypeId[];
}

/** Default engraving capabilities per family. Textures can override these. */
export const familyEngravingCapabilities: Record<MateFamilyId, EngravingCapabilities> = {
  camionero: {
    virolaEngravingTypes: ["laser", "bronze-applique", "alpaca-applique"],
    flejeEngravingTypes: [],
  },
  torpedo: {
    virolaEngravingTypes: ["bronze-applique", "alpaca-applique"],
    flejeEngravingTypes: [],
  },
  imperial: {
    virolaEngravingTypes: ["laser", "bronze-applique", "alpaca-applique"],
    flejeEngravingTypes: ["bronze-applique", "alpaca-applique"],
  },
  criollo: {
    virolaEngravingTypes: ["bronze-applique", "alpaca-applique"],
    flejeEngravingTypes: [],
  },
};

export interface DecisionColorOption {
  id: string;
  label: string;
  swatch: string;
  status?: CatalogOptionStatus;
  priceDeltaUYU: number | null;
}

export interface DecisionMetalOption {
  id: string;
  label: string;
  rimId: string;
  /** Asset del material/virola aislado. Nunca debe apuntar a la foto del mate. */
  previewImage?: string;
  status?: CatalogOptionStatus;
  priceDeltaUYU: number | null;
}

export interface DecisionTextureOption {
  id: string;
  label: string;
  description: string;
  /** Preview principal de la construcción, aunque sus datos comerciales sigan pendientes. */
  previewImage?: string;
  shapeId: MateModel;
  capabilities: MateCapabilities;
  colors: DecisionColorOption[];
  metals: DecisionMetalOption[];
  /** El metal forma parte del producto, pero el árbol no muestra una pregunta para elegirlo. */
  skipMetalSelection?: boolean;
  sizes: MateSize[];
  representativeVariantId: string;
  /** Previews específicos de esta textura y color, independientes del nombre del archivo. */
  colorPreviewImages?: Record<string, string>;
  legacyVariantId?: string;
  legacyVariantByColor?: Record<string, string>;
  legacyVariantByMetal?: Record<string, string>;
  legacyVariantByCombination?: Record<string, string>;
  status?: CatalogOptionStatus;
  priceDeltaUYU: number | null;
}

export interface MateFamilyDefinition {
  id: MateFamilyId;
  label: string;
  description: string;
  representativeVariantId: string;
  textures: DecisionTextureOption[];
  basePriceUYU: number | null;
}

export interface ResolvedMateProduct {
  productId: string;
  skuId: string | null;
  legacyVariantId: string;
  displayName: string;
  familyId: MateFamilyId;
  familyLabel: string;
  shapeId: MateModel;
  textureId: string;
  textureLabel: string;
  colorId: string;
  colorLabel: string;
  metalId: string;
  metalLabel: string;
  rimId: string;
  sizeId: MateSize;
  engravingTypeId: EngravingTypeId | null;
  flejeEngravingTypeId: EngravingTypeId | null;
  capabilities: MateCapabilities;
  price: {
    baseUYU: number | null;
    textureDeltaUYU: number | null;
    colorDeltaUYU: number | null;
    metalDeltaUYU: number | null;
    sizeDeltaUYU: number | null;
  };
  status: CatalogOptionStatus;
}

const PENDING_PRICE = null;
const SIZES: MateSize[] = ["chico", "medio", "grande"];

const colors = {
  natural: { id: "natural", label: "Natural", swatch: "#d8b67c", priceDeltaUYU: 0 },
  cueroCrudo: { id: "cuero-crudo", label: "Cuero crudo", swatch: "#ead6ac", priceDeltaUYU: 600 },
  cueroCrudoCriollo: { id: "cuero-crudo-criollo", label: "Cuero crudo", swatch: "#ead6ac", priceDeltaUYU: 650 },
  marron: { id: "marron", label: "Marrón", swatch: "#70452f", priceDeltaUYU: 0 },
  negro: { id: "negro", label: "Negro", swatch: "#27211e", priceDeltaUYU: 0 },
  vacuno: { id: "vacuno", label: "Vacuno", swatch: "#9a6848", priceDeltaUYU: 0 },
  printPelos: { id: "print-pelos", label: "Print / pelos", swatch: "linear-gradient(135deg,#5f3826 0 45%,#f3e1b9 45% 55%,#2d1d14 55%)", priceDeltaUYU: 600 },
  print: { id: "print", label: "Print", swatch: "linear-gradient(135deg,#5f3826 0 45%,#f3e1b9 45% 55%,#2d1d14 55%)", priceDeltaUYU: 600 },
  criollo: { id: "criollo", label: "Criollo", swatch: "#b88a5a", priceDeltaUYU: 0 },
  vaqueta: { id: "vaqueta", label: "Vaqueta", swatch: "#c69c6d", priceDeltaUYU: 400 },
  marronBlanco: { id: "marron-blanco", label: "Marrón y blanco", swatch: "linear-gradient(135deg,#70452f 0 50%,#f4efe5 50%)", priceDeltaUYU: 0 },
  negroBlanco: { id: "negro-blanco", label: "Negro y blanco", swatch: "linear-gradient(135deg,#27211e 0 50%,#f4efe5 50%)", priceDeltaUYU: 0 },
  animalPrint: { id: "animal-print", label: "Animal print", swatch: "repeating-linear-gradient(135deg,#c69c6d 0 6px,#2d1d14 6px 10px)", priceDeltaUYU: 0 },
  animalPrintPremium: { id: "animal-print-premium", label: "Pelos Animal print", swatch: "repeating-linear-gradient(135deg,#c69c6d 0 6px,#2d1d14 6px 10px)", priceDeltaUYU: 600 },
  marronBlancoPremium: { id: "marron-blanco-premium", label: "Print / pelos Marrón y blanco", swatch: "linear-gradient(135deg,#70452f 0 50%,#f4efe5 50%)", priceDeltaUYU: 600 },
  negroBlancoPremium: { id: "negro-blanco-premium", label: "Print / pelos Blanco y negro", swatch: "linear-gradient(135deg,#27211e 0 50%,#f4efe5 50%)", priceDeltaUYU: 600 },
  cuerosPendientes: { id: "cueros-pendientes", label: "Cueros por confirmar", swatch: "#d9cbb7", status: "pending" as const, priceDeltaUYU: 0 },
  variantePendiente: { id: "variante-pendiente", label: "Color de la variante por confirmar", swatch: "#d9cbb7", status: "pending" as const, priceDeltaUYU: 0 },
};

const metals = {
  alpacaCincelada: { id: "alpaca-cincelada", label: "Alpaca cincelada", rimId: "alpaca", previewImage: "/assets/mates/metals/alpaca-cincelada.png", priceDeltaUYU: 0 },
  alpacaGrandeCincelada: { id: "alpaca-grande-cincelada", label: "Alpaca grande cincelada", rimId: "alpaca-grande", previewImage: "/assets/mates/metals/alpaca-grande-cincelada.png", priceDeltaUYU: 0 },
  alpacaBronce: { id: "alpaca-bronce", label: "Alpaca y bronce", rimId: "alpaca-bronce", previewImage: "/assets/mates/metals/alpaca-bronce.png", priceDeltaUYU: 300 },
  alpacaComun: { id: "alpaca-comun", label: "Alpaca común", rimId: "alpaca", previewImage: "/assets/mates/metals/alpaca-comun.png", priceDeltaUYU: 0 },
  alpacaGrande: { id: "alpaca-grande", label: "Alpaca grande", rimId: "alpaca-grande", previewImage: "/assets/mates/metals/alpaca-grande.png", priceDeltaUYU: 300 },
  alpacaGrandeCriollo: { id: "alpaca-grande-criollo", label: "Alpaca grande", rimId: "alpaca-grande", previewImage: "/assets/mates/metals/alpaca-grande.png", priceDeltaUYU: 0 },
  alpacaGrandeLacre: { id: "alpaca-grande-lacre", label: "Alpaca grande al lacre", rimId: "alpaca-grande", previewImage: "/assets/mates/metals/alpaca-grande-lacre.png", priceDeltaUYU: 0 },
  alpacaGrandeLacreTorpedo: { id: "alpaca-grande-lacre-torpedo", label: "Alpaca grande al lacre", rimId: "alpaca-grande", previewImage: "/assets/mates/metals/alpaca-grande-lacre.png", priceDeltaUYU: 2500 },
  alpacaGrandeLacreImperial: { id: "alpaca-grande-lacre-imperial", label: "Alpaca grande al lacre", rimId: "alpaca-grande", previewImage: "/assets/mates/metals/alpaca-grande-lacre.png", priceDeltaUYU: 3000 },
  originalImperial: { id: "original-imperial", label: "Virola original del Imperial", rimId: "original", priceDeltaUYU: 0 },
  originalCamionero: { id: "original-camionero", label: "Virola original del Camionero", rimId: "original", priceDeltaUYU: 0 },
  plata900: { id: "plata-900", label: "Plata 900", rimId: "plata-900", previewImage: "/assets/mates/metals/plata-900.png", priceDeltaUYU: 0 },
};

const colorPreviewImages = {
  camioneroAlpacaCinceladoPatas: {
    natural: "/assets/mates/camionero/color-previews/alpaca-cincelado-patas/natural.png",
    "cuero-crudo": "/assets/mates/camionero/color-previews/alpaca-cincelado-patas/cuero-crudo.png",
    marron: "/assets/mates/camionero/color-previews/alpaca-cincelado-patas/marron.png",
    negro: "/assets/mates/camionero/color-previews/alpaca-cincelado-patas/negro.png",
  },
  imperialCinceladoPremium: {
    vacuno: "/assets/mates/imperial/color-previews/cincelado-premium/vacuno.png",
    negro: "/assets/mates/imperial/color-previews/cincelado-premium/negro.png",
    marron: "/assets/mates/imperial/color-previews/cincelado-premium/marron.png",
    natural: "/assets/mates/imperial/color-previews/cincelado-premium/natural.png",
    "animal-print-premium": "/assets/mates/imperial/color-previews/cincelado-premium/print-pelos.png",
    "marron-blanco-premium": "/assets/mates/imperial/color-previews/cincelado-premium/print-pelos.png",
    "negro-blanco-premium": "/assets/mates/imperial/color-previews/cincelado-premium/print-pelos.png",
    "cuero-crudo": "/assets/mates/imperial/color-previews/cincelado-premium/cuero-crudo.png",
  },
  imperialClasico: {
    natural: "/assets/mates/imperial/color-previews/imperial-clasico/natural.png",
    negro: "/assets/mates/imperial/color-previews/imperial-clasico/negro.png",
    marron: "/assets/mates/imperial/color-previews/imperial-clasico/marron.png",
    "animal-print-premium": "/assets/mates/imperial/color-previews/cincelado-premium/print-pelos.png", // fallback
    "marron-blanco-premium": "/assets/mates/imperial/color-previews/cincelado-premium/print-pelos.png", // fallback
    "negro-blanco-premium": "/assets/mates/imperial/color-previews/cincelado-premium/print-pelos.png", // fallback
    "cuero-crudo": "/assets/mates/imperial/color-previews/cincelado-premium/cuero-crudo.png", // fallback
  },
  imperialPrintPelos: {
    "cueros-pendientes": "/assets/mates/imperial/texture-previews/imperial-print-pelos.png",
  },
  imperialCueroCrudo: {
    "cuero-crudo": "/assets/mates/imperial/color-previews/imperial-cuero-crudo/cuero-crudo.png",
  },
  imperialCriollo: {
    "variante-pendiente": "/assets/mates/imperial/texture-previews/imperial-criollo.png",
  },
  imperialVirolaPlata900: {
    negro: "/assets/mates/imperial/color-previews/virola-plata-900/negro.png",
    marron: "/assets/mates/imperial/color-previews/virola-plata-900/marron.png",
    natural: "/assets/mates/imperial/color-previews/virola-plata-900/natural.png",
    print: "/assets/mates/imperial/color-previews/virola-plata-900/print.png",
    "cuero-crudo": "/assets/mates/imperial/color-previews/virola-plata-900/cuero-crudo.png",
    criollo: "/assets/mates/imperial/color-previews/virola-plata-900/criollo.png",
  },
  torpedoCueroLiso: {
    natural: "/assets/mates/torpedo/color-previews/cuero-liso/natural.png",
    negro: "/assets/mates/torpedo/color-previews/cuero-liso/negro.png",
    marron: "/assets/mates/torpedo/color-previews/cuero-liso/marron.png",
  },
  torpedoCueroEstampado: {
    marron: "/assets/mates/torpedo/color-previews/cuero-estampado/marron.png",
    negro: "/assets/mates/torpedo/color-previews/cuero-estampado/negro.png",
  },
  torpedoCueroCrudo: {
    "cuero-crudo": "/assets/mates/torpedo/color-previews/cuero-crudo/cuero-crudo.png",
  },
  torpedoPrintPelos: {
    "marron-blanco": "/assets/mates/torpedo/color-previews/print-pelos/marron-blanco.png",
    "negro-blanco": "/assets/mates/torpedo/color-previews/print-pelos/negro-blanco.png",
    "animal-print": "/assets/mates/torpedo/color-previews/print-pelos/animal-print.png",
  },
  criolloTorpedoPosaMate: {
    vaqueta: "/assets/mates/criollo/color-previews/torpedo-criollo-posa-mate/vaqueta.png",
    "cuero-crudo": "/assets/mates/criollo/color-previews/torpedo-criollo-posa-mate/cuero-crudo.png",
  },
  criolloImperialPosaMate: {
    vaqueta: "/assets/mates/criollo/color-previews/imperial-criollo-posa-mate/vaqueta.png",
    "cuero-crudo": "/assets/mates/criollo/color-previews/imperial-criollo-posa-mate/cuero-crudo.png",
  },
  criolloCamioneroPosaMate: {
    vaqueta: "/assets/mates/criollo/color-previews/camionero-criollo-posa-mate/vaqueta.png",
    "cuero-crudo": "/assets/mates/criollo/color-previews/camionero-criollo-posa-mate/cuero-crudo.png",
  },
} satisfies Record<string, Record<string, string>>;

function texture(
  value: Omit<DecisionTextureOption, "sizes" | "priceDeltaUYU"> & Partial<Pick<DecisionTextureOption, "sizes" | "priceDeltaUYU">>,
): DecisionTextureOption {
  return {
    ...value,
    sizes: value.sizes ?? [...SIZES],
    priceDeltaUYU: value.priceDeltaUYU ?? PENDING_PRICE,
  };
}

export const mateDecisionCatalog: MateFamilyDefinition[] = [
  {
    id: "camionero",
    label: "Camionero",
    description: "Boca amplia y cuerpo con patas.",
    representativeVariantId: "camionero-artesanal",
    basePriceUYU: 1800,
    textures: [
      texture({
        id: "alpaca-cincelado-patas",
        label: "Camionero alpaca cincelado con patas",
        description: "La única construcción indicada en el árbol Camionero.",
        shapeId: "camionero",
        capabilities: { hasRim: true, hasFleje: false },
        colors: [colors.natural, colors.cueroCrudo, colors.marron, colors.negro],
        metals: [metals.alpacaCincelada],
        colorPreviewImages: colorPreviewImages.camioneroAlpacaCinceladoPatas,
        representativeVariantId: "camionero-artesanal",
        legacyVariantId: "camionero-artesanal",
      }),
    ],
  },
  {
    id: "imperial",
    label: "Imperial",
    description: "Silueta clásica con virola y fleje personalizable.",
    representativeVariantId: "imperial-lacre",
    basePriceUYU: 2600,
    textures: [
      texture({
        id: "cincelado-premium",
        label: "Cincelado Premium",
        description: "Terminación premium del árbol Imperial.",
        shapeId: "imperial",
        capabilities: { hasRim: true, hasFleje: true },
        colors: [colors.animalPrintPremium, colors.negro, colors.marron, colors.natural, colors.marronBlancoPremium, colors.negroBlancoPremium, colors.cueroCrudo],
        metals: [metals.originalImperial],
        skipMetalSelection: true,
        colorPreviewImages: colorPreviewImages.imperialCinceladoPremium,
        representativeVariantId: "imperial-lacre",
        legacyVariantId: "imperial-lacre",
        priceDeltaUYU: 3000,
      }),
      texture({
        id: "imperial-clasico",
        label: "Imperial clásico",
        description: "Cuero clásico en los colores definidos por el árbol.",
        shapeId: "imperial",
        capabilities: { hasRim: true, hasFleje: true },
        colors: [colors.natural, colors.negro, colors.marron, colors.animalPrintPremium, colors.marronBlancoPremium, colors.negroBlancoPremium, colors.cueroCrudo],
        metals: [metals.originalImperial],
        skipMetalSelection: true,
        colorPreviewImages: colorPreviewImages.imperialClasico,
        representativeVariantId: "imperial-premium",
        legacyVariantId: "imperial-premium",
        priceDeltaUYU: 0,
      }),
      texture({
        id: "virola-plata-900",
        label: "Virola Plata 900",
        description: "Imperial con virola de plata 900.",
        shapeId: "imperial",
        capabilities: { hasRim: true, hasFleje: true },
        colors: [colors.cueroCrudo, colors.negro, colors.marron, colors.natural, colors.print, colors.criollo],
        metals: [metals.plata900],
        colorPreviewImages: colorPreviewImages.imperialVirolaPlata900,
        representativeVariantId: "imperial-clasico",
        legacyVariantId: "imperial-clasico",
        priceDeltaUYU: 17500,
      }),
    ],
  },
  {
    id: "torpedo",
    label: "Torpedo",
    description: "Cuerpo estilizado sin fleje.",
    representativeVariantId: "torpedo-cuero-liso-alpaca-cincelada",
    basePriceUYU: 1800,
    textures: [
      texture({
        id: "cuero-liso",
        label: "Cuero liso",
        description: "Cuero liso en tonos natural, negro o marrón.",
        shapeId: "torpedo",
        capabilities: { hasRim: true, hasFleje: false },
        colors: [colors.natural, colors.negro, colors.marron],
        metals: [metals.alpacaBronce, metals.alpacaComun, metals.alpacaGrande],
        colorPreviewImages: colorPreviewImages.torpedoCueroLiso,
        representativeVariantId: "torpedo-cuero-liso-alpaca-cincelada",
        legacyVariantByMetal: {
          "alpaca-bronce": "torpedo-cuero-liso-alpaca-bronce",
          "alpaca-comun": "torpedo-cuero-liso-alpaca-cincelada",
          "alpaca-grande": "torpedo-cuero-liso-alpaca-grande",
        },
        priceDeltaUYU: 0,
      }),
      texture({
        id: "cuero-estampado",
        label: "Cuero estampado",
        description: "Cuero estampado marrón o negro.",
        shapeId: "torpedo",
        capabilities: { hasRim: true, hasFleje: false },
        colors: [colors.marron, colors.negro, colors.natural],
        metals: [metals.alpacaBronce, metals.alpacaComun, metals.alpacaGrande],
        colorPreviewImages: colorPreviewImages.torpedoCueroEstampado,
        representativeVariantId: "torpedo-alpaca-bronce-estampado",
        legacyVariantByMetal: {
          "alpaca-bronce": "torpedo-alpaca-bronce-estampado",
          "alpaca-comun": "torpedo-cuero-estampado-alpaca-comun",
          "alpaca-grande": "torpedo-cuero-estampado-alpaca-grande",
        },
        priceDeltaUYU: 200,
      }),
      texture({
        id: "cuero-crudo",
        label: "Cuero crudo",
        description: "Cuero crudo sin una paleta adicional en el árbol.",
        shapeId: "torpedo",
        capabilities: { hasRim: true, hasFleje: false },
        colors: [colors.cueroCrudo],
        metals: [metals.alpacaBronce, metals.alpacaComun, metals.alpacaGrande],
        colorPreviewImages: colorPreviewImages.torpedoCueroCrudo,
        representativeVariantId: "torpedo-cuero-crudo-alpaca-cincelada",
        legacyVariantByMetal: {
          "alpaca-bronce": "torpedo-cuero-crudo-alpaca-bronce",
          "alpaca-comun": "torpedo-cuero-crudo-alpaca-cincelada",
          "alpaca-grande": "torpedo-cuero-crudo-grande-cincelada",
        },
        priceDeltaUYU: 600,
      }),
      texture({
        id: "print-pelos",
        label: "Print / pelos",
        description: "Croco, pelos y animal print.",
        shapeId: "torpedo",
        capabilities: { hasRim: true, hasFleje: false },
        colors: [colors.marronBlanco, colors.negroBlanco, colors.animalPrint],
        metals: [metals.alpacaBronce, metals.alpacaComun, metals.alpacaGrande],
        colorPreviewImages: colorPreviewImages.torpedoPrintPelos,
        representativeVariantId: "torpedo-croco-pelo",
        legacyVariantByMetal: {
          "alpaca-bronce": "torpedo-croco-pelo-reforzado",
          "alpaca-comun": "torpedo-croco-pelo",
          "alpaca-grande": "torpedo-croco-pelo-grande",
        },
        priceDeltaUYU: 600,
      }),
    ],
  },
  {
    id: "criollo",
    label: "Criollo",
    description: "Familia criolla con silueta Torpedo, Imperial o Camionero.",
    representativeVariantId: "criollo-clasico",
    basePriceUYU: 0,
    textures: [
      texture({
        id: "torpedo-criollo-posa-mate",
        label: "Torpedo criollo posa mate",
        description: "Silueta Torpedo con posa mate.",
        shapeId: "torpedo",
        capabilities: { hasRim: true, hasFleje: false },
        colors: [colors.vaqueta, colors.cueroCrudoCriollo],
        metals: [metals.alpacaGrandeCriollo, metals.alpacaGrandeLacreTorpedo],
        colorPreviewImages: colorPreviewImages.criolloTorpedoPosaMate,
        representativeVariantId: "criollo-clasico",
        legacyVariantByColor: {
          vaqueta: "criollo-clasico",
          "cuero-crudo-criollo": "criollo-grande-posa-cuero-crudo",
        },
        priceDeltaUYU: 1300,
      }),
      texture({
        id: "imperial-criollo-posa-mate",
        label: "Imperial criollo posa mate",
        description: "Silueta Imperial con posa mate.",
        shapeId: "imperial",
        capabilities: { hasRim: true, hasFleje: true },
        colors: [colors.vaqueta, colors.cueroCrudoCriollo],
        metals: [metals.alpacaGrandeCriollo, metals.alpacaGrandeLacreImperial],
        colorPreviewImages: colorPreviewImages.criolloImperialPosaMate,
        representativeVariantId: "imperial-criollo-posa-cuero-crudo",
        legacyVariantByColor: {
          "cuero-crudo-criollo": "imperial-criollo-posa-cuero-crudo",
        },
        priceDeltaUYU: 1900,
      }),
      texture({
        id: "camionero-criollo-posa-mate",
        label: "Camionero criollo posa mate",
        description: "Silueta Camionero con posa mate.",
        shapeId: "camionero",
        capabilities: { hasRim: true, hasFleje: false },
        colors: [colors.vaqueta, colors.cueroCrudoCriollo],
        metals: [metals.originalCamionero],
        skipMetalSelection: true,
        colorPreviewImages: colorPreviewImages.criolloCamioneroPosaMate,
        representativeVariantId: "camionero-criollo-posa-vaqueta",
        legacyVariantByColor: {
          vaqueta: "camionero-criollo-posa-vaqueta",
        },
        priceDeltaUYU: 1300,
      }),
    ],
  },
];

export const EMPTY_MATE_SELECTION: MateSelection = {
  familyId: null,
  textureId: null,
  colorId: null,
  metalId: null,
  sizeId: null,
  engravingTypeId: null,
  flejeEngravingTypeId: null,
};

export const engravingTypeOptions: Array<{
  id: EngravingTypeId;
  label: string;
  description: string;
  image: string;
}> = [
  {
    id: "laser",
    label: "Láser",
    description: "Grabado plano sobre el metal. Precio fijo.",
    image: engravingTechniqueAssetManifest.laser.src,
  },
  {
    id: "bronze-applique",
    label: "Aplique de bronce",
    description: "Letras y figuras elevadas soldadas en bronce",
    image: engravingTechniqueAssetManifest["bronze-applique"].src,
  },
  {
    id: "alpaca-applique",
    label: "Aplique de alpaca",
    description: "Letras y figuras elevadas soldadas en alpaca",
    image: engravingTechniqueAssetManifest["bronze-applique"].src,
  },
];

export const engravingTypeLabels: Record<EngravingTypeId, string> = {
  laser: "Láser",
  "bronze-applique": "Aplique de bronce",
  "alpaca-applique": "Aplique de alpaca",
};

export const mateSizeDecisionLabels: Record<MateSize, string> = {
  chico: "Chico",
  medio: "Medio",
  grande: "Grande",
};

export function getMateFamily(familyId: MateFamilyId | null | undefined) {
  return mateDecisionCatalog.find((family) => family.id === familyId);
}

export function getSelectedTexture(selection: Partial<MateSelection>) {
  return getMateFamily(selection.familyId)?.textures.find((item) => item.id === selection.textureId);
}

export function shouldAskForMetal(selection: Partial<MateSelection>) {
  const selectedTexture = getSelectedTexture(selection);
  return selectedTexture ? selectedTexture.skipMetalSelection !== true : true;
}

function getEffectiveMetalId(textureOption: DecisionTextureOption, metalId: string | null | undefined) {
  if (textureOption.metals.some((item) => item.id === metalId)) return metalId as string;
  return textureOption.skipMetalSelection ? textureOption.metals[0]?.id ?? null : null;
}

export function isCompleteMateSelection(selection: Partial<MateSelection>): selection is MateSelection & {
  familyId: MateFamilyId;
  textureId: string;
  colorId: string;
  metalId: string;
  sizeId: MateSize;
} {
  const family = getMateFamily(selection.familyId);
  const selectedTexture = family?.textures.find((item) => item.id === selection.textureId);
  return Boolean(
    family
      && selectedTexture
      && selectedTexture.colors.some((item) => item.id === selection.colorId)
      && selectedTexture.metals.some((item) => item.id === selection.metalId)
      && selectedTexture.sizes.includes(selection.sizeId as MateSize)
  );
}

export function getFirstIncompleteStage(selection: Partial<MateSelection>): MateSelectionStage | null {
  const family = getMateFamily(selection.familyId);
  if (!family) return "model";
  const selectedTexture = family.textures.find((item) => item.id === selection.textureId);
  if (!selectedTexture || !selectedTexture.colors.some((item) => item.id === selection.colorId)) return "texture";
  if (!getEffectiveMetalId(selectedTexture, selection.metalId)) return "metal";
  if (!selectedTexture.sizes.includes(selection.sizeId as MateSize)) return "size";
  if (selection.engravingTypeId !== "laser" && selection.engravingTypeId !== "bronze-applique" && selection.engravingTypeId !== "alpaca-applique") return "engraving";
  if (selectedTexture.capabilities.hasFleje && selection.flejeEngravingTypeId !== "laser" && selection.flejeEngravingTypeId !== "bronze-applique" && selection.flejeEngravingTypeId !== "alpaca-applique") return "fleje-engraving";
  return null;
}

function getLegacyVariantId(textureOption: DecisionTextureOption, colorId: string, metalId: string) {
  return textureOption.legacyVariantByCombination?.[`${colorId}:${metalId}`]
    ?? textureOption.legacyVariantByColor?.[colorId]
    ?? textureOption.legacyVariantByMetal?.[metalId]
    ?? textureOption.legacyVariantId
    ?? null;
}

export function resolveMateSelection(selection: Partial<MateSelection>): ResolvedMateProduct | null {
  const family = getMateFamily(selection.familyId);
  const textureOption = family?.textures.find((item) => item.id === selection.textureId);
  if (!family || !textureOption) return null;
  const effectiveSelection = {
    ...selection,
    metalId: getEffectiveMetalId(textureOption, selection.metalId),
  };
  if (!isCompleteMateSelection(effectiveSelection)) return null;
  const color = textureOption.colors.find((item) => item.id === effectiveSelection.colorId)!;
  const metal = textureOption.metals.find((item) => item.id === effectiveSelection.metalId)!;
  const mappedLegacyVariantId = getLegacyVariantId(textureOption, color.id, metal.id);
  const productId = [family.id, textureOption.id, color.id, metal.id, effectiveSelection.sizeId].join("--");
  const status: CatalogOptionStatus = mappedLegacyVariantId && textureOption.status !== "pending" && color.status !== "pending" && metal.status !== "pending"
    ? "ready"
    : "pending";
  const skuId = status === "ready" ? mappedLegacyVariantId : null;

  return {
    productId,
    skuId,
    legacyVariantId: mappedLegacyVariantId ?? textureOption.representativeVariantId,
    displayName: `${textureOption.label} · ${color.label} · ${metal.label}`,
    familyId: family.id,
    familyLabel: family.label,
    shapeId: textureOption.shapeId,
    textureId: textureOption.id,
    textureLabel: textureOption.label,
    colorId: color.id,
    colorLabel: color.label,
    metalId: metal.id,
    metalLabel: metal.label,
    rimId: metal.rimId,
    sizeId: effectiveSelection.sizeId,
    engravingTypeId: effectiveSelection.engravingTypeId === "laser" || effectiveSelection.engravingTypeId === "bronze-applique" || effectiveSelection.engravingTypeId === "alpaca-applique"
      ? effectiveSelection.engravingTypeId
      : null,
    flejeEngravingTypeId: effectiveSelection.flejeEngravingTypeId === "laser" || effectiveSelection.flejeEngravingTypeId === "bronze-applique" || effectiveSelection.flejeEngravingTypeId === "alpaca-applique"
      ? effectiveSelection.flejeEngravingTypeId
      : null,
    capabilities: textureOption.capabilities,
    price: {
      baseUYU: family.basePriceUYU,
      textureDeltaUYU: textureOption.priceDeltaUYU,
      colorDeltaUYU: color.priceDeltaUYU,
      metalDeltaUYU: metal.priceDeltaUYU,
      sizeDeltaUYU: null,
    },
    status,
  };
}

export function sanitizeMateSelection(value: unknown): MateSelection {
  const input = (value && typeof value === "object" ? value : {}) as Partial<MateSelection>;
  const family = getMateFamily(input.familyId);
  if (!family) return { ...EMPTY_MATE_SELECTION };
  const textureOption = family.textures.find((item) => item.id === input.textureId);
  if (!textureOption) return { ...EMPTY_MATE_SELECTION, familyId: family.id };
  const colorId = textureOption.colors.some((item) => item.id === input.colorId) ? input.colorId! : null;
  if (!colorId) return { familyId: family.id, textureId: textureOption.id, colorId: null, metalId: null, sizeId: null, engravingTypeId: null, flejeEngravingTypeId: null };
  const metalId = getEffectiveMetalId(textureOption, input.metalId);
  if (!metalId) return { familyId: family.id, textureId: textureOption.id, colorId, metalId: null, sizeId: null, engravingTypeId: null, flejeEngravingTypeId: null };
  const sizeId = textureOption.sizes.includes(input.sizeId as MateSize) ? input.sizeId as MateSize : null;
  const engravingTypeId = input.engravingTypeId === "laser" || input.engravingTypeId === "bronze-applique" || input.engravingTypeId === "alpaca-applique"
    ? input.engravingTypeId
    : null;
  const flejeEngravingTypeId = input.flejeEngravingTypeId === "laser" || input.flejeEngravingTypeId === "bronze-applique" || input.flejeEngravingTypeId === "alpaca-applique"
    ? input.flejeEngravingTypeId
    : null;
  return { familyId: family.id, textureId: textureOption.id, colorId, metalId, sizeId, engravingTypeId, flejeEngravingTypeId };
}

const legacySelectionMap: Record<string, Omit<MateSelection, "engravingTypeId" | "flejeEngravingTypeId">> = {
  "camionero-artesanal": { familyId: "camionero", textureId: "alpaca-cincelado-patas", colorId: "natural", metalId: "alpaca-cincelada", sizeId: "medio" },
  "camionero-criollo-posa-vaqueta": { familyId: "criollo", textureId: "camionero-criollo-posa-mate", colorId: "vaqueta", metalId: "original-camionero", sizeId: "medio" },
  "criollo-clasico": { familyId: "criollo", textureId: "torpedo-criollo-posa-mate", colorId: "vaqueta", metalId: "alpaca-grande-cincelada", sizeId: "medio" },
  "criollo-grande-posa-cuero-crudo": { familyId: "criollo", textureId: "torpedo-criollo-posa-mate", colorId: "cuero-crudo", metalId: "alpaca-grande-cincelada", sizeId: "medio" },
  "imperial-lacre": { familyId: "imperial", textureId: "cincelado-premium", colorId: "vacuno", metalId: "original-imperial", sizeId: "medio" },
  "imperial-premium": { familyId: "imperial", textureId: "imperial-clasico", colorId: "natural", metalId: "original-imperial", sizeId: "medio" },
  "imperial-cuero-crudo": { familyId: "imperial", textureId: "imperial-cuero-crudo", colorId: "cuero-crudo", metalId: "original-imperial", sizeId: "medio" },
  "imperial-criollo-posa-cuero-crudo": { familyId: "criollo", textureId: "imperial-criollo-posa-mate", colorId: "cuero-crudo", metalId: "original-imperial", sizeId: "medio" },
  "imperial-print": { familyId: "imperial", textureId: "imperial-print-pelos", colorId: "cueros-pendientes", metalId: "original-imperial", sizeId: "medio" },
  "imperial-clasico": { familyId: "imperial", textureId: "virola-plata-900", colorId: "natural", metalId: "plata-900", sizeId: "medio" },
  "torpedo-cuero-liso-alpaca-bronce": { familyId: "torpedo", textureId: "cuero-liso", colorId: "marron", metalId: "alpaca-bronce", sizeId: "medio" },
  "torpedo-cuero-liso-alpaca-cincelada": { familyId: "torpedo", textureId: "cuero-liso", colorId: "marron", metalId: "alpaca-comun", sizeId: "medio" },
  "torpedo-cuero-liso-alpaca-grande": { familyId: "torpedo", textureId: "cuero-liso", colorId: "marron", metalId: "alpaca-grande", sizeId: "medio" },
  "torpedo-alpaca-bronce-estampado": { familyId: "torpedo", textureId: "cuero-estampado", colorId: "marron", metalId: "alpaca-bronce", sizeId: "medio" },
  "torpedo-cuero-estampado-alpaca-comun": { familyId: "torpedo", textureId: "cuero-estampado", colorId: "marron", metalId: "alpaca-comun", sizeId: "medio" },
  "torpedo-cuero-estampado-alpaca-grande": { familyId: "torpedo", textureId: "cuero-estampado", colorId: "marron", metalId: "alpaca-grande", sizeId: "medio" },
  "torpedo-cuero-crudo-alpaca-bronce": { familyId: "torpedo", textureId: "cuero-crudo", colorId: "cuero-crudo", metalId: "alpaca-bronce", sizeId: "medio" },
  "torpedo-cuero-crudo-alpaca-cincelada": { familyId: "torpedo", textureId: "cuero-crudo", colorId: "cuero-crudo", metalId: "alpaca-comun", sizeId: "medio" },
  "torpedo-cuero-crudo-grande-cincelada": { familyId: "torpedo", textureId: "cuero-crudo", colorId: "cuero-crudo", metalId: "alpaca-grande", sizeId: "medio" },
  "torpedo-croco-pelo-reforzado": { familyId: "torpedo", textureId: "print-pelos", colorId: "animal-print", metalId: "alpaca-bronce", sizeId: "medio" },
  "torpedo-croco-pelo": { familyId: "torpedo", textureId: "print-pelos", colorId: "animal-print", metalId: "alpaca-comun", sizeId: "medio" },
  "torpedo-croco-pelo-grande": { familyId: "torpedo", textureId: "print-pelos", colorId: "animal-print", metalId: "alpaca-grande", sizeId: "medio" },
};

export function getSelectionFromLegacyVariant(variantId: string, size: MateSize = "medio"): MateSelection | null {
  const mapped = legacySelectionMap[variantId];
  return mapped ? { ...mapped, sizeId: size, engravingTypeId: null, flejeEngravingTypeId: null } : null;
}

export function getSelectionLabels(selection: Partial<MateSelection>) {
  const family = getMateFamily(selection.familyId);
  const textureOption = family?.textures.find((item) => item.id === selection.textureId);
  const color = textureOption?.colors.find((item) => item.id === selection.colorId);
  const metal = textureOption?.metals.find((item) => item.id === selection.metalId);
  return {
    family: family?.label ?? "Configuración anterior",
    texture: textureOption?.label ?? "Sin definir",
    color: color?.label ?? "Sin definir",
    metal: metal?.label ?? "Sin definir",
    size: selection.sizeId ? mateSizeDecisionLabels[selection.sizeId] : "Sin definir",
    engraving: selection.engravingTypeId ? engravingTypeLabels[selection.engravingTypeId] : "Sin definir",
  };
}

export function getEngravingCapabilities(familyId: MateFamilyId | null, textureId?: string | null): EngravingCapabilities {
  if (!familyId) return { virolaEngravingTypes: [], flejeEngravingTypes: [] };
  const family = getMateFamily(familyId);
  const texture = family?.textures.find((t) => t.id === textureId);
  const base = familyEngravingCapabilities[familyId];
  // Criollo sub-textures inherit from their shape family for engraving options
  if (familyId === "criollo" && texture) {
    if (texture.shapeId === "imperial") {
      return {
        virolaEngravingTypes: ["laser", "bronze-applique", "alpaca-applique"],
        flejeEngravingTypes: texture.capabilities.hasFleje ? ["bronze-applique", "alpaca-applique"] : [],
      };
    }
    if (texture.shapeId === "camionero") {
      return {
        virolaEngravingTypes: ["laser", "bronze-applique", "alpaca-applique"],
        flejeEngravingTypes: [],
      };
    }
  }
  return base;
}
