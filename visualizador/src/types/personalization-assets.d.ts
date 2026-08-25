declare module "virtual:personalization-assets" {
  export interface DiscoveredPersonalizationAsset {
    id: string;
    name: string;
    src: string;
  }

  export const personalizationAssets: {
    fleje: DiscoveredPersonalizationAsset[];
    virola: DiscoveredPersonalizationAsset[];
    iconos: DiscoveredPersonalizationAsset[];
  };
}
