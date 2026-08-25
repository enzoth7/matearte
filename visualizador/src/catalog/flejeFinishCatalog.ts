import { personalizationAssets } from "virtual:personalization-assets";

export type FlejeFinishId = string;

export interface FlejeFinish {
  id: FlejeFinishId;
  name: string;
  image: string; // Thumbnail para el botón del selector
  src: string;  // Recurso optimizado para el visualizador
}

const previousFlejeIds: Record<string, string> = {
  laurel: "pattern-1",
  azteca: "frame-25",
  sol: "frame-26",
  abstracta: "frame-27",
  griego: "frame-28",
  floral: "frame-29",
  "guarda-pampa": "frame-30",
};

export const flejeFinishCatalog: FlejeFinish[] = personalizationAssets.fleje.map((asset) => ({
  id: previousFlejeIds[asset.id] ?? asset.id,
  name: asset.name,
  image: asset.src,
  src: asset.src,
}));

export function getFlejeFinish(finishId: FlejeFinishId): FlejeFinish | undefined {
  return flejeFinishCatalog.find((finish) => finish.id === finishId);
}
