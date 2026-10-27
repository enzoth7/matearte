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
    src: "/assets/personalizacion/grabado/aplique-bronce.webp",
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

export interface TorpedoVirolaEngravingTechniqueAsset {
  id: FlejeEngravingTechniqueId;
  src: string;
  alt: string;
  usage: "owned-product-reference";
}

export const flejeEngravingTechniqueAssetManifest: Record<FlejeEngravingTechniqueId, FlejeEngravingTechniqueAsset> = {
  "bronze-applique": {
    id: "bronze-applique",
    src: "/assets/personalizacion/grabadofleje/aplique-bronce-fleje.webp",
    alt: "Mate Imperial con aplique de bronce en el fleje",
    usage: "owned-product-reference",
  },
  "alpaca-applique": {
    id: "alpaca-applique",
    src: "/assets/personalizacion/grabadofleje/aplique-alpaca-fleje.webp",
    alt: "Mate Imperial con aplique de alpaca en el fleje",
    usage: "owned-product-reference",
  },
};

export const torpedoVirolaEngravingTechniqueAssetManifest: Record<FlejeEngravingTechniqueId, TorpedoVirolaEngravingTechniqueAsset> = {
  "bronze-applique": {
    id: "bronze-applique",
    src: "/assets/personalizacion/grabadovirola-torpedo/aplique-bronce-torpedo.webp",
    alt: "Mate Torpedo con escudo elevado de bronce en la virola",
    usage: "owned-product-reference",
  },
  "alpaca-applique": {
    id: "alpaca-applique",
    src: "/assets/personalizacion/grabadovirola-torpedo/aplique-alpaca-torpedo.webp",
    alt: "Mate Torpedo con escudo elevado de alpaca plateada en la virola",
    usage: "owned-product-reference",
  },
};
