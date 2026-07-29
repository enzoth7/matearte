export type FlejeFinishId =
  | "pattern-1"
  | "frame-25"
  | "frame-26"
  | "frame-27"
  | "frame-28"
  | "frame-29"
  | "frame-30";

export interface FlejeFinish {
  id: FlejeFinishId;
  name: string;
  image: string; // Thumbnail para el botón del selector
  src: string;  // Recurso SVG completo del patrón para el visualizador
}

export const flejeFinishCatalog: FlejeFinish[] = [
  { id: "pattern-1", name: "Laurel", image: "/assets/fleje/pattern-1.svg", src: "/assets/fleje/pattern-1.svg" },
  { id: "frame-25", name: "Azteca", image: "/assets/fleje/Frame 25.svg", src: "/assets/fleje/Frame 25.svg" },
  { id: "frame-26", name: "Sol", image: "/assets/fleje/Frame 26.svg", src: "/assets/fleje/Frame 26.svg" },
  { id: "frame-27", name: "Abstracta", image: "/assets/fleje/Frame 27.svg", src: "/assets/fleje/Frame 27.svg" },
  { id: "frame-28", name: "Griego", image: "/assets/fleje/Frame 28.svg", src: "/assets/fleje/Frame 28.svg" },
  { id: "frame-29", name: "Floral", image: "/assets/fleje/Frame 29.svg", src: "/assets/fleje/Frame 29.svg" },
  { id: "frame-30", name: "Guarda Pampa", image: "/assets/fleje/Frame 30.svg", src: "/assets/fleje/Frame 30.svg" },
];

export function getFlejeFinish(finishId: FlejeFinishId): FlejeFinish | undefined {
  return flejeFinishCatalog.find((finish) => finish.id === finishId);
}
