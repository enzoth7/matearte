export type RimFinishId = "finish-1" | "finish-2" | "finish-3";

export interface RimFinish {
  id: RimFinishId;
  name: string;
  image: string;
  width?: number;
  height?: number;
}

export const rimFinishCatalog: RimFinish[] = [
  { id: "finish-1", name: "Terminación 1", image: "/assets/virola/finishes/finish-3.png", width: 1093, height: 1093 },
  { id: "finish-2", name: "Terminación 2", image: "/assets/virola/finishes/finish-3.png", width: 1093, height: 1093 },
  { id: "finish-3", name: "Terminación 3", image: "/assets/virola/finishes/finish-3.png", width: 1093, height: 1093 },
];

export function getRimFinish(finishId: RimFinishId): RimFinish | undefined {
  return rimFinishCatalog.find((finish) => finish.id === finishId);
}
