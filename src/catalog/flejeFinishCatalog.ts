export type FlejeFinishId = "none" | "pattern-1" | "pattern-2";

export interface FlejeFinish {
  id: FlejeFinishId;
  name: string;
  image: string; // Thumbnail para el botón del selector
  src: string | null;  // Recurso SVG/PNG completo del patrón para el visualizador
}

export const flejeFinishCatalog: FlejeFinish[] = [
  { id: "none", name: "Liso", image: "/assets/svg/fleje-base.svg", src: null },
  { id: "pattern-1", name: "Laurel", image: "/assets/fleje/pattern-1.png", src: "/assets/fleje/pattern-1.png" },
  { id: "pattern-2", name: "Diseño 2", image: "/assets/fleje/pattern-1.png", src: null },
];

export function getFlejeFinish(finishId: FlejeFinishId): FlejeFinish | undefined {
  return flejeFinishCatalog.find((finish) => finish.id === finishId);
}
