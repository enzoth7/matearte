import { expect, it } from 'vitest';
import { applyPublishedCatalog } from './publishedCatalog';
import { engravingTypeOptions, getEngravingCapabilities, getMateFamily, getSelectionPreviewCrop, getSelectionPreviewImage, getSelectionLabels, resolveMateSelection } from './mateDecisionCatalog';
import { getMateSizePreviewImage } from '../components/mateSizePreviewImages';

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

it('applies published photo framing to every image type and ignores malformed framing', () => {
  const crop = { x: 12, y: -8, zoom: 1.4 };
  applyPublishedCatalog({
    families: { estribo: { imageCrop: crop } },
    textures: { 'estribo::imperial': { imageCrop: crop } },
    colors: { 'estribo::imperial::calabaza': { imageCrop: crop } },
    metals: { 'estribo::imperial::virola-imperial': { imageCrop: crop } },
    techniques: { 'bronze-applique': { imageCrop: crop, flejeImageCrop: crop, torpedoImageCrop: { x: 999, y: 0, zoom: 1 } } },
  });
  const family = getMateFamily('estribo');
  const texture = family?.textures.find(item => item.id === 'imperial');
  expect(family?.previewCrop).toEqual(crop);
  expect(texture?.previewCrop).toEqual(crop);
  expect(texture?.colorPreviewCrops?.calabaza).toEqual(crop);
  expect(texture?.metals[0].previewCrop).toEqual(crop);
  expect(getSelectionPreviewCrop({ familyId: 'estribo', textureId: 'imperial', colorId: 'calabaza' })).toEqual(crop);
  expect(engravingTypeOptions.find(item => item.id === 'bronze-applique')?.flejeImageCrop).toEqual(crop);
  expect(engravingTypeOptions.find(item => item.id === 'bronze-applique')?.torpedoImageCrop).toBeUndefined();
});

it('uses separately published size photos for regular and Torpedo mates', () => {
  const crop = { x: 5, y: -10, zoom: 1.3 };
  applyPublishedCatalog({ sizes: {
    'standard::chico': { image: '/assets/personalizacion/tamanos/nueva-chica.webp', imageCrop: crop },
    'torpedo::chico': { image: '/assets/personalizacion/tamanostorpedo/nuevo-chico.webp' },
  } });
  expect(getMateSizePreviewImage({ familyId: 'imperial' }, 'chico')).toMatchObject({ src: '/assets/personalizacion/tamanos/nueva-chica.webp', crop });
  expect(getMateSizePreviewImage({ familyId: 'torpedo' }, 'chico').src).toBe('/assets/personalizacion/tamanostorpedo/nuevo-chico.webp');
  expect(getMateSizePreviewImage({ familyId: 'imperial' }, 'medio').src).toBe('/assets/personalizacion/tamanos/boca-medio.webp');
});
