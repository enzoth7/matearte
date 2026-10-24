import { usesTorpedoVirolaEngravingAssets, type MateSelection } from "../catalog/mateDecisionCatalog";
import type { MateSize } from "../catalog/mateCatalog";

const mateSizePreviewImages: Record<MateSize, { src: string; alt: string }> = {
  chico: {
    src: "/assets2/personalizacion/tamanos/boca-chico.png",
    alt: "Vista cenital de un mate camionero con boca chica",
  },
  medio: {
    src: "/assets2/personalizacion/tamanos/boca-medio.png",
    alt: "Vista cenital de un mate camionero con boca mediana",
  },
  grande: {
    src: "/assets2/personalizacion/tamanos/boca-grande.png",
    alt: "Vista cenital de un mate camionero con boca grande",
  },
};

const torpedoSizePreviewImages: Record<MateSize, { src: string; alt: string }> = {
  chico: {
    src: "/assets2/personalizacion/tamanostorpedo/torpedo-chico.png",
    alt: "Mate Torpedo chico visto de frente sobre fondo blanco",
  },
  medio: {
    src: "/assets2/personalizacion/tamanostorpedo/torpedo-medio.png",
    alt: "Mate Torpedo mediano visto de frente sobre fondo blanco",
  },
  grande: {
    src: "/assets2/personalizacion/tamanostorpedo/torpedo-grande.png",
    alt: "Mate Torpedo grande visto de frente sobre fondo blanco",
  },
};

export function getMateSizePreviewImage(selection: Partial<MateSelection>, size: MateSize) {
  return usesTorpedoVirolaEngravingAssets(selection)
    ? torpedoSizePreviewImages[size]
    : mateSizePreviewImages[size];
}
