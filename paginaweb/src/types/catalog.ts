import type {
  CatalogCategoryId as SharedCatalogCategoryId,
  CatalogColorId as SharedCatalogColorId,
  CatalogFinishId as SharedCatalogFinishId,
  CatalogMaterialId as SharedCatalogMaterialId,
  CatalogProductTypeId as SharedCatalogProductTypeId,
} from "../../../shared/catalog-taxonomy";

export type Locale = "es" | "en" | "pt";

export type Currency = "UYU" | "USD" | "BRL";

export type CategorySlug = SharedCatalogCategoryId;
export type CatalogMaterialId = SharedCatalogMaterialId;
export type CatalogProductTypeId = SharedCatalogProductTypeId;
export type CatalogFinishId = SharedCatalogFinishId;
export type CatalogColorId = SharedCatalogColorId;
/** @deprecated Use CatalogProductTypeId for new data. */
export type MateTypeId = Extract<CatalogProductTypeId, "imperial" | "camionero" | "criollo" | "torpedo">;

export type CatalogFilterData = {
  priceUYU?: number;
  materials: CatalogMaterialId[];
  /** Product models/styles. Values may be combined for a product. */
  productTypes?: CatalogProductTypeId[];
  /** Decorative or construction details, e.g. cincelado or con aros. */
  finishes?: CatalogFinishId[];
  /** Kept to preserve existing editorial mate records while they are migrated. */
  mateType?: MateTypeId;
  colors?: CatalogColorId[];
};

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
  source: "web" | "instagram" | "provided" | "supabase";
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
  currency: Currency;
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
  category: string;
  eyebrow: string;
  summary: string;
  description: string;
  materials: string[];
  filterData: CatalogFilterData;
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
