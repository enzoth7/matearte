type EngravingTechniqueId = "laser" | "bronze-applique" | "alpaca-applique";
type FlejeEngravingTechniqueId = Exclude<EngravingTechniqueId, "laser">;

export interface EngravingTechniqueAsset {
  id: EngravingTechniqueId;
  src: string;
  alt: string;
  sourceUrl: string;
  merchant: string;
  retrievedAt: string;
  usage: "temporary-reference";
}

export const engravingTechniqueAssetManifest: Record<EngravingTechniqueId, EngravingTechniqueAsset> = {
  laser: {
    id: "laser",
    src: "/assets/personalizacion/grabado/laser1.webp",
    alt: "Mate con grabado láser sobre virola",
    sourceUrl: "https://cushemates.com/products/grabado-laser-para-virola-lisa",
    merchant: "Cushe Mates",
    retrievedAt: "2026-08-21",
    usage: "temporary-reference",
  },
  "bronze-applique": {
    id: "bronze-applique",
    src: "/assets/personalizacion/grabado/aplique-bronce.jpg",
    alt: "Mate con aplique elevado de bronce",
    sourceUrl: "https://www.martinfierromates.com.ar/personalizados/apliques-en-bronce",
    merchant: "Martín Fierro Mates",
    retrievedAt: "2026-08-21",
    usage: "temporary-reference",
  },
  "alpaca-applique": {
    id: "alpaca-applique",
    src: "/assets/personalizacion/grabado/aplique-alpaca.webp",
    alt: "Mate con aplique elevado de alpaca plateada",
    sourceUrl: "https://www.martinfierromates.com.ar/personalizados/apliques-en-bronce",
    merchant: "MateArte, variante visual derivada",
    retrievedAt: "2026-08-24",
    usage: "temporary-reference",
  },
};

export interface FlejeEngravingTechniqueAsset {
  id: FlejeEngravingTechniqueId;
  src: string;
  alt: string;
  usage: "owned-product-reference";
}

export const flejeEngravingTechniqueAssetManifest: Record<FlejeEngravingTechniqueId, FlejeEngravingTechniqueAsset> = {
  "bronze-applique": {
    id: "bronze-applique",
    src: "/assets2/personalizacion/grabadofleje/aplique-bronce-fleje.png",
    alt: "Mate Imperial con aplique de bronce en el fleje",
    usage: "owned-product-reference",
  },
  "alpaca-applique": {
    id: "alpaca-applique",
    src: "/assets2/personalizacion/grabadofleje/aplique-alpaca-fleje.png",
    alt: "Mate Imperial con aplique de alpaca en el fleje",
    usage: "owned-product-reference",
  },
};
