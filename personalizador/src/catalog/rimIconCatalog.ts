import { personalizationAssets } from "virtual:personalization-assets";

export interface RimIconAsset {
  id: string;
  name: string;
  src: string;
}

export const rimIconCatalog: RimIconAsset[] = personalizationAssets.iconos;

export const featuredRimIconIds = [
  "uruguayescudo",
  "uruguaybandera",
  "uruguaysol",
] as const;

export const orderedRimIconCatalog: RimIconAsset[] = [
  ...featuredRimIconIds.flatMap((id) => rimIconCatalog.filter((icon) => icon.id === id)),
  ...rimIconCatalog.filter((icon) => !featuredRimIconIds.some((id) => id === icon.id)),
];
