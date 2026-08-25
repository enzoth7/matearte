import { personalizationAssets } from "virtual:personalization-assets";

export interface RimIconAsset {
  id: string;
  name: string;
  src: string;
}

export const rimIconCatalog: RimIconAsset[] = personalizationAssets.iconos;
