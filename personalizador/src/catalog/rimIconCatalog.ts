import { personalizationAssets } from "virtual:personalization-assets";

export interface RimIconAsset {
  id: string;
  name: string;
  src: string;
}

const builtInRimIcons: RimIconAsset[] = personalizationAssets.iconos;
export const rimIconCatalog: RimIconAsset[] = [...builtInRimIcons];

export const featuredRimIconIds = [
  "uruguayescudo",
  "uruguaybandera",
  "uruguaysol",
] as const;

export const orderedRimIconCatalog: RimIconAsset[] = [
  ...featuredRimIconIds.flatMap((id) => rimIconCatalog.filter((icon) => icon.id === id)),
  ...rimIconCatalog.filter((icon) => !featuredRimIconIds.some((id) => id === icon.id)),
];

export function applyUploadedRimIcons(icons: Array<RimIconAsset & { is_active: boolean }>, hiddenBuiltInIds: string[] = []) {
  const uploaded = icons.filter((icon) => /^icon-[0-9a-f-]{36}$/.test(icon.id) && icon.src.startsWith('https://'));
  rimIconCatalog.splice(0, rimIconCatalog.length, ...builtInRimIcons, ...uploaded);
  const hidden = new Set(hiddenBuiltInIds);
  const active = [...builtInRimIcons.filter((icon) => !hidden.has(icon.id)), ...uploaded.filter((icon) => icon.is_active)];
  orderedRimIconCatalog.splice(0, orderedRimIconCatalog.length,
    ...featuredRimIconIds.flatMap((id) => active.filter((icon) => icon.id === id)),
    ...active.filter((icon) => !featuredRimIconIds.some((id) => id === icon.id)),
  );
}
