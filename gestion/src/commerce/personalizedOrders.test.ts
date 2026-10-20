import { describe, expect, it } from 'vitest';
import {
  collectPrivateAssets,
  getPaymentStatusValue,
  normalizeWhatsappPhone,
  paymentStatusLabel,
  personalizedProductionStatus,
  summarizePersonalization,
  whatsappContactUrl,
  type PersonalizedOrder,
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

  it('presenta el logo y la ubicación de una matera registrada en el local', () => {
    const summary = summarizePersonalization(item({
      localPersonalization: {
        kind: 'matera', techniqueLabel: 'Láser', contentLabel: 'Logo', placementLabel: 'Frente y tapa', logoName: 'marca.svg',
      },
      configuration: { selectionLabels: { family: 'Matera personalizada', color: 'Marrón', texture: 'Cuero' }, capabilities: { hasFleje: false }, rim: {} },
    }));
    expect(summary.kind).toBe('matera');
    expect(summary.matera).toMatchObject({ technique: 'Láser', content: 'Logo', placement: 'Frente y tapa', logo: 'marca.svg' });
  });
});

describe('archivos privados', () => {
  it('recupera los metadatos del pedido y evita duplicar el mismo logo', () => {
    const files = collectPrivateAssets({
      assets: [{ bucket_id: 'design-assets', object_path: 'user/design/logo.png', original_name: 'logo.png', mime_type: 'image/png', byte_size: 2048 }],
      configuration: { rim: { icons: [{ customImage: { name: 'logo.png', mimeType: 'image/png', size: 2048, originalUrl: 'storage:design-assets:user/design/logo.png' } }] } },
    });

    expect(files).toHaveLength(1);
    expect(files[0]).toMatchObject({ bucket: 'design-assets', path: 'user/design/logo.png', name: 'logo.png', kind: 'upload' });
  });

  it('separa las vistas de producción de los originales activos', () => {
    const summary = summarizePersonalization(item({
      previews: [
        { role: 'mate', bucket_id: 'design-previews', object_path: 'user/design/rev/mate.png', mime_type: 'image/png', byte_size: 1200 },
        { role: 'virola', bucket_id: 'design-previews', object_path: 'user/design/rev/virola.png', mime_type: 'image/png', byte_size: 1400 },
      ],
      assets: [{ bucket_id: 'design-assets', object_path: 'user/design/old.png', original_name: 'viejo.png', mime_type: 'image/png', byte_size: 900 }],
      configuration: { rim: { icons: [{ customImage: { name: 'logo.svg', mimeType: 'image/svg+xml', size: 2048, storageRef: 'storage:design-assets:user/design/logo.svg' } }] } },
    }));

    expect(summary.previews.map((asset) => asset.role)).toEqual(['mate', 'virola']);
    expect(summary.uploads).toHaveLength(1);
    expect(summary.uploads[0]).toMatchObject({ name: 'logo.svg', path: 'user/design/logo.svg' });
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

describe('getPaymentStatusValue y paymentStatusLabel', () => {
  it('retorna pending para pedidos no pagados ni cancelados', () => {
    expect(getPaymentStatusValue({ paid_at: null, status: 'manual_review' })).toBe('pending');
    expect(paymentStatusLabel({ paid_at: null, status: 'manual_review' })).toBe('Pendiente');
  });

  it('retorna completed para pedidos pagados', () => {
    expect(getPaymentStatusValue({ paid_at: '2026-09-18T19:00:00Z', status: 'ready_for_production' })).toBe('completed');
    expect(paymentStatusLabel({ paid_at: '2026-09-18T19:00:00Z', status: 'ready_for_production' })).toBe('Pagado');
    expect(paymentStatusLabel({ paid_at: '2026-09-18T19:00:00Z', status: 'paid_pending_review' })).toBe('Pagado');
  });

  it('muestra el pago parcial de ventas locales como en los demás pedidos', () => {
    expect(paymentStatusLabel({ paid_at: null, status: 'ready_for_production', payment_label: 'Pago parcial' })).toBe('Pago parcial');
  });

  it('retorna cancelled para pedidos cancelados, reembolsados o con pago fallido', () => {
    expect(getPaymentStatusValue({ paid_at: null, status: 'cancelled' })).toBe('cancelled');
    expect(paymentStatusLabel({ paid_at: null, status: 'cancelled' })).toBe('Cancelado');

    expect(getPaymentStatusValue({ paid_at: '2026-09-18T19:00:00Z', status: 'cancelled' })).toBe('cancelled');
    expect(paymentStatusLabel({ paid_at: '2026-09-18T19:00:00Z', status: 'cancelled' })).toBe('Cancelado');

    expect(getPaymentStatusValue({ paid_at: null, status: 'refunded' })).toBe('cancelled');
    expect(paymentStatusLabel({ paid_at: null, status: 'refunded' })).toBe('Reembolsado');
  });
});

describe('personalizedProductionStatus', () => {
  const order = (statuses: string[]): PersonalizedOrder => ({
    id: 'order-1', order_number: 1, status: 'paid_pending_review', total_minor: 620_000,
    created_at: '2026-10-20T12:00:00Z', paid_at: '2026-10-20T12:00:00Z', customer_snapshot: {},
    order_items: statuses.map((status, index) => ({ ...item({}), id: `item-${index}`, production_status: status })),
  });

  it('usa el avance real del artículo, no el estado de revisión del pedido', () => {
    expect(personalizedProductionStatus(order(['pending']))).toBe('Pendiente');
    expect(personalizedProductionStatus(order(['in_production']))).toBe('En producción');
    expect(personalizedProductionStatus(order(['completed']))).toBe('Terminado');
    expect(personalizedProductionStatus(order(['completed', 'pending']))).toBe('Pendiente');
  });

  it('no mezcla el avance de artículos comunes con el personalizado', () => {
    const mixed = order(['pending']);
    mixed.order_items.push({ ...item({}), id: 'catalog', item_type: 'catalog', requires_review: false, production_status: 'completed' });
    expect(personalizedProductionStatus(mixed)).toBe('Pendiente');
  });
});
