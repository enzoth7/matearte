import { personalizationAssets } from "virtual:personalization-assets";

export type FlejeFinishId = string;

export interface FlejeFinish {
  id: FlejeFinishId;
  name: string;
  image: string; // Thumbnail para el botón del selector
  src: string;  // Recurso optimizado para el personalizador
}

const namedFinishes = [
  { assetId: "laurel", id: "pattern-1", name: "Laurel" },
  { assetId: "azteca", id: "frame-25", name: "Azteca" },
  { assetId: "sol", id: "frame-26", name: "Sol" },
  { assetId: "abstracta", id: "frame-27", name: "Abstracta" },
  { assetId: "griego", id: "frame-28", name: "Griego" },
  { assetId: "floral", id: "frame-29", name: "Floral" },
  { assetId: "guarda-pampa", id: "frame-30", name: "Guarda Pampa" },
  { assetId: "1", id: "1", name: "Manos" },
  { assetId: "2", id: "2", name: "Pampa" },
  { assetId: "3", id: "3", name: "Abstracto" },
  { assetId: "4", id: "4", name: "Flores" },
  { assetId: "5", id: "5", name: "Griego" },
];

export const flejeFinishCatalog: FlejeFinish[] = personalizationAssets.fleje.map((asset) => {
  const named = namedFinishes.find((finish) => finish.assetId === asset.id);
  return { id: named?.id ?? asset.id, name: named?.name ?? asset.name, image: asset.src, src: asset.src };
}).sort((left, right) => {
  const leftIndex = namedFinishes.findIndex((finish) => finish.id === left.id);
  const rightIndex = namedFinishes.findIndex((finish) => finish.id === right.id);
  return (leftIndex < 0 ? namedFinishes.length : leftIndex) - (rightIndex < 0 ? namedFinishes.length : rightIndex);
});

export function getFlejeFinish(finishId: FlejeFinishId): FlejeFinish | undefined {
  return flejeFinishCatalog.find((finish) => finish.id === finishId);
}
