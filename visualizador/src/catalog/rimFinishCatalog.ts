import { personalizationAssets } from "virtual:personalization-assets";

export type RimFinishId = string;

export interface RimFinish {
  id: RimFinishId;
  name: string;
  image: string;
  width?: number;
  height?: number;
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

export function getRimFinish(finishId: RimFinishId): RimFinish | undefined {
  return rimFinishCatalog.find((finish) => finish.id === finishId);
}
