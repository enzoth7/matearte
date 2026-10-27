import { usesTorpedoVirolaEngravingAssets, type MateSelection } from "../catalog/mateDecisionCatalog";
import type { MateSize } from "../catalog/mateCatalog";

const mateSizePreviewImages: Record<MateSize, { src: string; alt: string }> = {
  chico: {
    src: "/assets/personalizacion/tamanos/boca-chico.webp",
    alt: "Vista cenital de un mate camionero con boca chica",
  },
  medio: {
    src: "/assets/personalizacion/tamanos/boca-medio.webp",
    alt: "Vista cenital de un mate camionero con boca mediana",
  },
  grande: {
    src: "/assets/personalizacion/tamanos/boca-grande.webp",
    alt: "Vista cenital de un mate camionero con boca grande",
  },
};

const torpedoSizePreviewImages: Record<MateSize, { src: string; alt: string }> = {
  chico: {
    src: "/assets/personalizacion/tamanostorpedo/torpedo-chico.webp",
    alt: "Mate Torpedo chico visto de frente sobre fondo blanco",
  },
  medio: {
    src: "/assets/personalizacion/tamanostorpedo/torpedo-medio.webp",
    alt: "Mate Torpedo mediano visto de frente sobre fondo blanco",
  },
  grande: {
    src: "/assets/personalizacion/tamanostorpedo/torpedo-grande.webp",
    alt: "Mate Torpedo grande visto de frente sobre fondo blanco",
  },
};

export function getMateSizePreviewImage(selection: Partial<MateSelection>, size: MateSize) {
  return usesTorpedoVirolaEngravingAssets(selection)
    ? torpedoSizePreviewImages[size]
    : mateSizePreviewImages[size];
}
