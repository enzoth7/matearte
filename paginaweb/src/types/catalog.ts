export type Locale = "es";

export type CategorySlug =
  | "mates"
  | "bombillas"
  | "materas"
  | "termos"
  | "regalos";

export type RightsStatus =
  | "brand-public"
  | "pending-social"
  | "pending-personality"
  | "pending-trademark"
  | "presentation-only";

export type MediaAsset = {
  src: string;
  alt: string;
  width: number;
  height: number;
  source: "web" | "instagram" | "provided";
  sourceUrl: string;
  rightsStatus: RightsStatus;
};

export type VideoAsset = {
  id: string;
  src: string;
  poster: string;
  title: string;
  eyebrow: string;
  description: string;
  width: number;
  height: number;
  durationSeconds: number;
  rightsStatus: RightsStatus;
};

export type Money = {
  amountMinor: number;
  currency: "UYU" | "USD";
};

export type ProductVariant = {
  id: string;
  label: string;
  value: string;
  commerceId?: string;
  price?: Money;
  available?: boolean;
};

export type Product = {
  id: string;
  slug: string;
  name: string;
  category: CategorySlug;
  eyebrow: string;
  summary: string;
  description: string;
  materials: string[];
  images: MediaAsset[];
  variants: ProductVariant[];
  featured?: boolean;
  editorial?: boolean;
};

export type Category = {
  slug: CategorySlug;
  name: string;
  description: string;
  image: MediaAsset;
};
