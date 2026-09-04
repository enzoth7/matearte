import { personalizationAssets } from "virtual:personalization-assets";
import type { EngravingTypeId } from "./mateDecisionCatalog";

export type RimFinishId = string;

export interface RimFinish {
  id: RimFinishId;
  name: string;
  image: string;
  width?: number;
  height?: number;
  textKnockoutScale?: number;
}

const previousRimIds: Record<string, string> = {
  laureles: "finish-1",
  sol: "frame-1",
  azteca: "frame-5",
  hojas: "frame-25",
};

export const rimFinishCatalog: RimFinish[] = personalizationAssets.virola.map((asset) => ({
  id: previousRimIds[asset.id] ?? asset.id,
  name: asset.name,
  image: asset.src,
  width: 1093,
  height: 1093,
}));

export const appliqueRimFinishCatalog: RimFinish[] = [
  {
    id: "applique-finish-espirales",
    name: "Espirales",
    image: "/assets2/personalizacion/viroladeapliques/apliques-01-espirales.webp",
    width: 1093,
    height: 1093,
    textKnockoutScale: 0.25,
  },
  {
    id: "applique-finish-triangulos",
    name: "Triángulos",
    image: "/assets2/personalizacion/viroladeapliques/apliques-02-triangulos.webp",
    width: 1093,
    height: 1093,
    textKnockoutScale: 0.25,
  },
  {
    id: "applique-finish-escamas",
    name: "Escamas",
    image: "/assets2/personalizacion/viroladeapliques/apliques-03-escamas.webp",
    width: 1093,
    height: 1093,
    textKnockoutScale: 0.25,
  },
  {
    id: "applique-finish-coronas",
    name: "Coronas",
    image: "/assets2/personalizacion/viroladeapliques/apliques-04-coronas.webp",
    width: 1093,
    height: 1093,
    textKnockoutScale: 0.25,
  },
];

export function usesAppliqueRimFinishes(engravingTypeId: EngravingTypeId | null | undefined) {
  return engravingTypeId === "bronze-applique" || engravingTypeId === "alpaca-applique";
}

export function getRimFinishCatalogForEngravingType(engravingTypeId: EngravingTypeId | null | undefined) {
  return usesAppliqueRimFinishes(engravingTypeId) ? appliqueRimFinishCatalog : rimFinishCatalog;
}

export function getRimFinish(finishId: RimFinishId): RimFinish | undefined {
  return rimFinishCatalog.find((finish) => finish.id === finishId)
    ?? appliqueRimFinishCatalog.find((finish) => finish.id === finishId);
}
