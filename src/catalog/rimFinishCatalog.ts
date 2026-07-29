export type RimFinishId = "finish-1" | "frame-1" | "frame-5" | "frame-14" | "frame-25";

export interface RimFinish {
  id: RimFinishId;
  name: string;
  image: string;
  width?: number;
  height?: number;
}

export const rimFinishCatalog: RimFinish[] = [
  { id: "finish-1", name: "Laureles", image: "/assets/virola/finishes/Frame 14.svg", width: 1093, height: 1093 },
  { id: "frame-1", name: "Sol", image: "/assets/virola/finishes/Frame 1.svg", width: 1093, height: 1093 },
  { id: "frame-5", name: "Azteca", image: "/assets/virola/finishes/Frame 5.svg", width: 1093, height: 1093 },
  { id: "frame-25", name: "Hojas", image: "/assets/virola/finishes/Frame 25.svg", width: 1093, height: 1093 },
];

export function getRimFinish(finishId: RimFinishId): RimFinish | undefined {
  return rimFinishCatalog.find((finish) => finish.id === finishId);
}
