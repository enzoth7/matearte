type EngravingTechniqueId = "laser" | "bronze-applique";

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
    src: "/assets/mates/engraving-techniques/laser-reference.webp",
    alt: "Referencia temporal de grabado láser sobre virola",
    sourceUrl: "https://cushemates.com/products/grabado-laser-para-virola-lisa",
    merchant: "Cushe Mates",
    retrievedAt: "2026-08-21",
    usage: "temporary-reference",
  },
  "bronze-applique": {
    id: "bronze-applique",
    src: "/assets/mates/engraving-techniques/bronze-applique-reference.webp",
    alt: "Referencia temporal de aplique de bronce",
    sourceUrl: "https://www.martinfierromates.com.ar/personalizados/apliques-en-bronce",
    merchant: "Martín Fierro Mates",
    retrievedAt: "2026-08-21",
    usage: "temporary-reference",
  },
};
