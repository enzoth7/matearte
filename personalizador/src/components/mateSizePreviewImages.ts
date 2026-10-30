import { usesTorpedoVirolaEngravingAssets, type MateSelection } from "../catalog/mateDecisionCatalog";
import type { MateSize } from "../catalog/mateCatalog";
import type { CatalogImageCrop } from "../catalog/catalogImageCrop";

export type SizePreviewKind = "standard" | "torpedo";
type SizePreview = { src: string; alt: string; crop?: CatalogImageCrop };

const mateSizePreviewImages: Record<MateSize, SizePreview> = {
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

const torpedoSizePreviewImages: Record<MateSize, SizePreview> = {
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

const publishedOverrides: Record<SizePreviewKind, Partial<Record<MateSize, SizePreview>>> = {
  standard: {},
  torpedo: {},
};

export function setPublishedSizePreview(kind: SizePreviewKind, size: MateSize, src?: string, crop?: CatalogImageCrop) {
  const baseline = kind === "torpedo" ? torpedoSizePreviewImages[size] : mateSizePreviewImages[size];
  publishedOverrides[kind][size] = { ...baseline, src: src ?? baseline.src, crop };
}

export function getSizePreviewImage(kind: SizePreviewKind, size: MateSize): SizePreview {
  return publishedOverrides[kind][size]
    ?? (kind === "torpedo" ? torpedoSizePreviewImages[size] : mateSizePreviewImages[size]);
}

export function getMateSizePreviewImage(selection: Partial<MateSelection>, size: MateSize): SizePreview {
  return getSizePreviewImage(usesTorpedoVirolaEngravingAssets(selection) ? "torpedo" : "standard", size);
}
