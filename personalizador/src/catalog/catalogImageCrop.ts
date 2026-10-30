import type { CSSProperties } from 'react';

export type CatalogImageCrop = { x: number; y: number; zoom: number };

export function parseCatalogImageCrop(value: unknown): CatalogImageCrop | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const { x, y, zoom } = value as Partial<CatalogImageCrop>;
  return typeof x === 'number' && Number.isFinite(x) && Math.abs(x) <= 75
    && typeof y === 'number' && Number.isFinite(y) && Math.abs(y) <= 75
    && typeof zoom === 'number' && Number.isFinite(zoom) && zoom >= 1 && zoom <= 2.5
    ? { x, y, zoom }
    : undefined;
}

export function catalogImageCropStyle(crop?: CatalogImageCrop): CSSProperties | undefined {
  return crop ? {
    objectFit: 'cover',
    objectPosition: 'center',
    transformOrigin: 'center center',
    transform: `translate(${crop.x}%, ${crop.y}%) scale(${crop.zoom})`,
    padding: 0,
  } : undefined;
}
