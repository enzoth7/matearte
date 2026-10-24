import {
  engravingTypeLabels, engravingTypeOptions, getEngravingCapabilities, mateDecisionCatalog,
  type EngravingTypeId,
} from './mateDecisionCatalog';

type Entry = Record<string, unknown>;
type Document = Partial<Record<'families' | 'textures' | 'colors' | 'metals' | 'techniques', Record<string, Entry>>>;
const techniqueIds: EngravingTypeId[] = ['laser', 'bronze-applique', 'alpaca-applique'];
const key = (...parts: string[]) => parts.join('::');
const entry = (document: Document, section: keyof Document, id: string): Entry => document[section]?.[id] ?? {};
const string = (value: unknown) => typeof value === 'string' && value.trim() ? value.trim() : undefined;
const enabled = (value: unknown) => typeof value === 'boolean' ? value : undefined;
const techniqueList = (value: unknown): EngravingTypeId[] | undefined => Array.isArray(value)
  ? [...new Set(value.filter((id): id is EngravingTypeId => techniqueIds.includes(id as EngravingTypeId)))]
  : undefined;

/** Apply only display/availability overrides. Product and order identifiers stay immutable. */
export function applyPublishedCatalog(document: unknown) {
  if (!document || typeof document !== 'object' || Array.isArray(document)) return;
  const config = document as Document;
  for (const family of mateDecisionCatalog) {
    const familyPatch = entry(config, 'families', family.id);
    family.label = string(familyPatch.label) ?? family.label;
    family.description = string(familyPatch.description) ?? family.description;
    family.previewImage = string(familyPatch.image) ?? family.previewImage;
    family.enabled = enabled(familyPatch.enabled) ?? family.enabled;
    for (const texture of family.textures) {
      const texturePatch = entry(config, 'textures', key(family.id, texture.id));
      const originalCapabilities = getEngravingCapabilities(family.id, texture.id);
      texture.label = string(texturePatch.label) ?? texture.label;
      texture.description = string(texturePatch.description) ?? texture.description;
      texture.previewImage = string(texturePatch.image) ?? texture.previewImage;
      texture.enabled = enabled(texturePatch.enabled) ?? texture.enabled;
      if (texturePatch.virola || texturePatch.fleje) {
        texture.engravingCapabilities = {
          virolaEngravingTypes: techniqueList(texturePatch.virola) ?? originalCapabilities.virolaEngravingTypes,
          flejeEngravingTypes: techniqueList(texturePatch.fleje) ?? originalCapabilities.flejeEngravingTypes,
        };
      }
      for (const color of texture.colors) {
        const patch = entry(config, 'colors', key(family.id, texture.id, color.id));
        color.label = string(patch.label) ?? color.label;
        color.swatch = string(patch.swatch) ?? color.swatch;
        color.enabled = enabled(patch.enabled) ?? color.enabled;
        if (string(patch.image)) {
          texture.colorPreviewImages = { ...texture.colorPreviewImages, [color.id]: string(patch.image)! };
        }
      }
      for (const metal of texture.metals) {
        const patch = entry(config, 'metals', key(family.id, texture.id, metal.id));
        metal.label = string(patch.label) ?? metal.label;
        metal.previewImage = string(patch.image) ?? metal.previewImage;
        metal.enabled = enabled(patch.enabled) ?? metal.enabled;
      }
    }
  }
  for (const option of engravingTypeOptions) {
    const patch = entry(config, 'techniques', option.id);
    option.label = string(patch.label) ?? option.label;
    option.description = string(patch.description) ?? option.description;
    option.image = string(patch.image) ?? option.image;
    option.flejeImage = string(patch.flejeImage) ?? option.flejeImage;
    option.torpedoImage = string(patch.torpedoImage) ?? option.torpedoImage;
    option.enabled = enabled(patch.enabled) ?? option.enabled;
    engravingTypeLabels[option.id] = option.label;
  }
}
