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
  src: string;  // Recurso optimizado para el visualizador
}

export const flejeFinishCatalog: FlejeFinish[] = [
  { id: "pattern-1", name: "Laurel", image: "/assets/fleje/pattern-1.webp", src: "/assets/fleje/pattern-1.webp" },
  { id: "frame-25", name: "Azteca", image: "/assets/fleje/Frame 25.webp", src: "/assets/fleje/Frame 25.webp" },
  { id: "frame-26", name: "Sol", image: "/assets/fleje/Frame 26.webp", src: "/assets/fleje/Frame 26.webp" },
  { id: "frame-27", name: "Abstracta", image: "/assets/fleje/Frame 27.webp", src: "/assets/fleje/Frame 27.webp" },
  { id: "frame-28", name: "Griego", image: "/assets/fleje/Frame 28.webp", src: "/assets/fleje/Frame 28.webp" },
  { id: "frame-29", name: "Floral", image: "/assets/fleje/Frame 29.webp", src: "/assets/fleje/Frame 29.webp" },
  { id: "frame-30", name: "Guarda Pampa", image: "/assets/fleje/Frame 30.webp", src: "/assets/fleje/Frame 30.webp" },
];

export function getFlejeFinish(finishId: FlejeFinishId): FlejeFinish | undefined {
  return flejeFinishCatalog.find((finish) => finish.id === finishId);
}
