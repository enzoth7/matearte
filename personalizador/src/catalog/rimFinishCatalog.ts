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

const rimFinishNames: Record<string, string> = {
  laureles: "Laureles",
  sol: "Sol",
  azteca: "Azteca",
  hojas: "Hojas",
  petalos: "Pétalos",
};

export const rimFinishCatalog: RimFinish[] = personalizationAssets.virola.map((asset) => ({
  id: previousRimIds[asset.id] ?? asset.id,
  name: rimFinishNames[asset.id] ?? asset.name,
  image: asset.src,
  width: asset.id === "petalos" ? 1138 : 1093,
  height: asset.id === "petalos" ? 1138 : 1093,
}));

export const appliqueRimFinishCatalog: RimFinish[] = [
  {
    id: "applique-finish-espirales",
    name: "Espirales",
    image: "/assets/personalizacion/viroladeapliques/apliques-01-espirales.webp",
    width: 1093,
    height: 1093,
    textKnockoutScale: 0.25,
  },
  {
    id: "applique-finish-triangulos",
    name: "Triángulos",
    image: "/assets/personalizacion/viroladeapliques/apliques-02-triangulos.webp",
    width: 1093,
    height: 1093,
    textKnockoutScale: 0.25,
  },
  {
    id: "applique-finish-escamas",
    name: "Escamas",
    image: "/assets/personalizacion/viroladeapliques/apliques-03-escamas.webp",
    width: 1093,
    height: 1093,
    textKnockoutScale: 0.25,
  },
  {
    id: "applique-finish-coronas",
    name: "Coronas",
    image: "/assets/personalizacion/viroladeapliques/apliques-04-coronas.webp",
    width: 1093,
    height: 1093,
    textKnockoutScale: 0.25,
  },
  {
    id: "applique-finish-laureles",
    name: "Laureles",
    image: "/assets/personalizacion/virola/laureles.webp",
    width: 1093,
    height: 1093,
    textKnockoutScale: 0.25,
  },
  {
    id: "applique-finish-petalos",
    name: "Pétalos",
    image: "/assets/personalizacion/virola/petalos.webp",
    width: 1138,
    height: 1138,
    textKnockoutScale: 0.25,
  },
  {
    id: "applique-finish-puntas-cinceladas",
    name: "Puntas",
    image: "/assets/personalizacion/viroladeapliques/apliques-05-puntas-cinceladas.webp",
    width: 1093,
    height: 1093,
    textKnockoutScale: 0.25,
  },
  {
    id: "applique-finish-cadenas",
    name: "Cadenas",
    image: "/assets/personalizacion/viroladeapliques/apliques-06-cadenas.webp",
    width: 1093,
    height: 1093,
    textKnockoutScale: 0.25,
  },
  {
    id: "applique-finish-coronas-2",
    name: "Coronas 2",
    image: "/assets/personalizacion/viroladeapliques/apliques-07-coronas-2.webp",
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
