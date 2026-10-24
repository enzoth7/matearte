import { expect, it } from 'vitest';
import { applyPublishedCatalog } from './publishedCatalog';
import { getEngravingCapabilities, getMateFamily, getSelectionPreviewImage, getSelectionLabels, resolveMateSelection } from './mateDecisionCatalog';

it('applies published names, images and techniques without changing stable product IDs', () => {
  const selection = {
    familyId: 'camionero' as const,
    textureId: 'alpaca-cincelado-patas',
    colorId: 'natural',
    metalId: 'alpaca-comun',
    sizeId: 'medio' as const,
    engravingTypeId: 'laser' as const,
    flejeEngravingTypeId: null,
  };
  const originalId = resolveMateSelection(selection)?.productId;
  applyPublishedCatalog({
    families: { camionero: { label: 'Camionero artesanal' } },
    textures: { 'camionero::alpaca-cincelado-patas': { label: 'Camionero nuevo', virola: ['bronze-applique'] } },
    colors: { 'camionero::alpaca-cincelado-patas::natural': { label: 'Arena', image: 'https://agdkljuulwjwjasftcce.supabase.co/storage/v1/object/public/visualizer-catalog/catalog/test.png' } },
    techniques: { 'bronze-applique': { label: 'Bronce a mano' } },
  });
  expect(getMateFamily('camionero')?.label).toBe('Camionero artesanal');
  expect(getSelectionLabels(selection).color).toBe('Arena');
  expect(getSelectionPreviewImage(selection)).toContain('/visualizer-catalog/catalog/test.png');
  expect(getEngravingCapabilities('camionero', 'alpaca-cincelado-patas').virolaEngravingTypes).toEqual(['bronze-applique']);
  expect(resolveMateSelection(selection)?.productId).toBe(originalId);
});

it('retains old selections for reference but blocks disabled combinations from sale', () => {
  const selection = { familyId: 'torpedo' as const, textureId: 'cuero-liso', colorId: 'natural', metalId: 'alpaca-bronce', sizeId: 'medio' as const };
  expect(resolveMateSelection(selection)).not.toBeNull();
  applyPublishedCatalog({ colors: { 'torpedo::cuero-liso::natural': { enabled: false } } });
  expect(resolveMateSelection(selection)?.status).toBe('pending');
  expect(resolveMateSelection(selection)?.skuId).toBeNull();
});
