import { describe, expect, it } from 'vitest';
import {
  collectPrivateAssets,
  normalizeWhatsappPhone,
  summarizePersonalization,
  whatsappContactUrl,
  type PersonalizedOrderItem,
} from './personalizedOrders';

const item = (snapshot: Record<string, unknown>): PersonalizedOrderItem => ({
  id: 'item-1',
  item_type: 'design',
  title: 'Mate Imperial personalizado',
  quantity: 1,
  total_minor: 620_000,
  requires_review: true,
  review_status: 'pending',
  review_reason: null,
  immutable_snapshot: snapshot,
});

describe('summarizePersonalization', () => {
  it('separa claramente la virola y el frente/reverso del fleje', () => {
    const summary = summarizePersonalization(item({
      configuration: {
        modelId: 'imperial',
        size: 'grande',
        colorId: 'marron',
        engravingTypeId: 'laser',
        flejeEngravingTypeId: 'aplique-bronce',
        capabilities: { hasFleje: true },
        selectionLabels: { family: 'Imperial', texture: 'Clásico', color: 'Marrón', metal: 'Plata 900', size: 'Grande', engraving: 'Láser' },
        rim: {
          finishMode: 'finish',
          finishId: 'finish-1',
          textMode: 'text',
          texts: [{ text: 'RICHARD' }, { text: 'MATEARTE' }],
          imageMode: 'image',
          icons: [{ selectedImageId: 'sol', customImage: null }],
        },
      },
      flejeConfiguration: {
        finishMode: 'none',
        sides: {
          front: { textMode: 'text', text: 'FRENTE', imageMode: 'none', icons: [] },
          back: { textMode: 'none', text: '', imageMode: 'image', selectedImageId: 'caballo', icons: [] },
        },
      },
    }));

    expect(summary.mate).toMatchObject({ model: 'Imperial', size: 'Grande', color: 'Marrón', metal: 'Plata 900' });
    expect(summary.rim).toMatchObject({ technique: 'Láser', finish: 'Laureles', texts: ['RICHARD', 'MATEARTE'], images: ['Sol'], personalized: true });
    expect(summary.fleje).toMatchObject({
      available: true,
      technique: 'Aplique de bronce',
      finish: 'Liso (sin personalizar)',
      front: { text: 'FRENTE', images: [] },
      back: { text: '', images: ['Caballo'] },
      personalized: true,
    });
  });

  it('marca como lisas las partes que el cliente no activó', () => {
    const summary = summarizePersonalization(item({
      configuration: {
        capabilities: { hasFleje: true },
        selectionLabels: {},
        rim: { finishMode: 'none', textMode: 'none', imageMode: 'none' },
      },
      flejeConfiguration: {
        finishMode: 'none',
        sides: { front: {}, back: {} },
      },
    }));

    expect(summary.rim.personalized).toBe(false);
    expect(summary.rim.finish).toBe('Lisa (sin personalizar)');
    expect(summary.fleje.personalized).toBe(false);
    expect(summary.fleje.finish).toBe('Liso (sin personalizar)');
  });
});

describe('archivos privados', () => {
  it('recupera los metadatos del pedido y evita duplicar el mismo logo', () => {
    const files = collectPrivateAssets({
      assets: [{ bucket_id: 'design-assets', object_path: 'user/design/logo.png', original_name: 'logo.png', mime_type: 'image/png', byte_size: 2048 }],
      configuration: { rim: { icons: [{ customImage: { name: 'logo.png', mimeType: 'image/png', size: 2048, originalUrl: 'storage:design-assets:user/design/logo.png' } }] } },
    });

    expect(files).toHaveLength(1);
    expect(files[0]).toMatchObject({ bucket: 'design-assets', path: 'user/design/logo.png', name: 'logo.png' });
  });
});

describe('contacto por WhatsApp', () => {
  it('normaliza un celular uruguayo y prepara el mensaje con el pedido', () => {
    expect(normalizeWhatsappPhone('099 123 456')).toBe('59899123456');
    const url = whatsappContactUrl({ fullName: 'Ana Pérez', phone: '099 123 456' }, 42);
    expect(url).toContain('https://wa.me/59899123456?text=');
    expect(decodeURIComponent(url)).toContain('Hola Ana');
    expect(decodeURIComponent(url)).toContain('pedido #42');
  });

  it('no genera un enlace si el pedido no tiene teléfono', () => {
    expect(whatsappContactUrl({ fullName: 'Ana Pérez' }, 42)).toBe('');
  });
});
