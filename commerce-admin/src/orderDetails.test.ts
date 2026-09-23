import { describe, expect, it } from 'vitest';
import {
  CALLING_CODE_TO_COUNTRY,
  formatOrderPhone,
  getCatalogOrderOptionDetails,
  getItemPricing,
  getItemSku,
  getOrderDeliveryDetails,
  formatWeight,
  getOrderItemWeight,
  getOrderTotalWeight,
  normalizeBankTransferReceipts,
  type Order,
  type OrderItem,
} from './App';
import { defaultCatalogTaxonomy } from '../../shared/catalog-taxonomy';

describe('getOrderDeliveryDetails', () => {
  it('usa la copia inmutable del cliente como destino de un envío nacional', () => {
    const details = getOrderDeliveryDetails({
      shipping_method: 'national_shipping',
      customer_snapshot: {
        fullName: 'Ana Pérez',
        phone: '099 123 456',
        email: 'ana@example.com',
        address: '18 de Julio 1234',
        city: 'Paysandú',
        department: 'Paysandú',
      },
      shipping_snapshot: { name: 'Envío al interior' },
    });

    expect(details).toMatchObject({
      isPickup: false,
      contactName: 'Ana Pérez',
      phone: '+598 099 123 456 (Uruguay)',
      phoneInfo: {
        prefix: '+598',
        number: '099 123 456',
        country: 'Uruguay',
        display: '+598 099 123 456 (Uruguay)',
        whatsappDigits: '59899123456',
      },
      email: 'ana@example.com',
      address: '18 de Julio 1234',
      city: 'Paysandú',
      department: 'Paysandú',
      country: 'Uruguay',
      zone: 'Envío al interior',
      methodLabel: 'Envío nacional',
    });
  });

  it('toma el destino internacional desde shipping_snapshot', () => {
    const details = getOrderDeliveryDetails({
      shipping_method: 'international_coordination',
      customer_snapshot: { fullName: 'João Silva', phone: '+55 11 99999-9999' },
      shipping_snapshot: {
        address: 'Rua das Flores 10',
        city: 'São Paulo',
        department: 'SP',
        country: 'Brasil',
      },
    });

    expect(details).toMatchObject({
      address: 'Rua das Flores 10',
      city: 'São Paulo',
      department: 'SP',
      country: 'Brasil',
      phone: '+55 11 99999-9999 (Brasil)',
      phoneInfo: {
        prefix: '+55',
        number: '11 99999-9999',
        country: 'Brasil',
        display: '+55 11 99999-9999 (Brasil)',
        whatsappDigits: '5511999999999',
      },
      methodLabel: 'Envío internacional a coordinar',
    });
  });

  it('reconoce los pedidos con retiro y tolera claves antiguas', () => {
    const details = getOrderDeliveryDetails({
      shipping_method: 'pickup',
      customer_snapshot: { full_name: 'Cliente anterior', address_line1: 'Dirección anterior' },
      shipping_snapshot: { name: 'Retiro en taller' },
    });

    expect(details).toMatchObject({
      isPickup: true,
      contactName: 'Cliente anterior',
      address: 'Dirección anterior',
      country: 'Uruguay',
      methodLabel: 'Retiro',
    });
  });

  it('resuelve caso Pedido 23: orden con destino internacional (Holanda / NL) y celular de Italia (+39 3921475447)', () => {
    const details = getOrderDeliveryDetails({
      shipping_method: 'international_coordination',
      customer_snapshot: {
        fullName: 'Lorenzo Riccio',
        phone: '+39 3921475447',
        email: 'loryriccio21@gmail.com',
      },
      shipping_snapshot: {
        address: 'Krusplein 430, 3012',
        city: 'Rotterdam',
        department: 'Zuid-Holland',
        country: 'Países Bajos',
        countryCode: 'NL',
      },
    });

    expect(details.country).toBe('Países Bajos');
    expect(details.phoneInfo).toEqual({
      prefix: '+39',
      number: '3921475447',
      country: 'Italia',
      display: '+39 3921475447 (Italia)',
      whatsappDigits: '393921475447',
    });
    expect(details.phone).toBe('+39 3921475447 (Italia)');
    expect(details.methodLabel).toBe('Envío internacional a coordinar');
  });

  it('resuelve caso Pedido 23 cuando el teléfono se guardó sin signo más (3921475447)', () => {
    const details = getOrderDeliveryDetails({
      shipping_method: 'international_coordination',
      customer_snapshot: {
        fullName: 'Lorenzo Riccio',
        phone: '3921475447',
        email: 'loryriccio21@gmail.com',
      },
      shipping_snapshot: {
        countryCode: 'NL',
      },
    });

    expect(details.country).toBe('Holanda');
    expect(details.phoneInfo).toEqual({
      prefix: '+39',
      number: '3921475447',
      country: 'Italia',
      display: '+39 3921475447 (Italia)',
      whatsappDigits: '393921475447',
    });
    expect(details.phoneInfo?.whatsappDigits).toBe('393921475447');
  });

  it('resuelve caso celular nacional de Uruguay (099 123 456)', () => {
    const details = getOrderDeliveryDetails({
      shipping_method: 'national_shipping',
      customer_snapshot: {
        fullName: 'Lucía Fernández',
        phone: '099 123 456',
      },
      shipping_snapshot: {},
    });

    expect(details.phoneInfo).toEqual({
      prefix: '+598',
      number: '099 123 456',
      country: 'Uruguay',
      display: '+598 099 123 456 (Uruguay)',
      whatsappDigits: '59899123456',
    });
    expect(details.phone).toBe('+598 099 123 456 (Uruguay)');
  });

  it('resuelve caso celular de Brasil (+55 11 99999-9999)', () => {
    const details = getOrderDeliveryDetails({
      shipping_method: 'international_coordination',
      customer_snapshot: {
        fullName: 'Carlos Eduardo',
        phone: '+55 11 99999-9999',
      },
      shipping_snapshot: {
        country: 'Brasil',
      },
    });

    expect(details.phoneInfo).toEqual({
      prefix: '+55',
      number: '11 99999-9999',
      country: 'Brasil',
      display: '+55 11 99999-9999 (Brasil)',
      whatsappDigits: '5511999999999',
    });
    expect(details.phone).toBe('+55 11 99999-9999 (Brasil)');
  });
});

describe('normalizeBankTransferReceipts', () => {
  const receipt = {
    id: 'receipt-1',
    original_name: 'comprobante.png',
    mime_type: 'image/png',
    byte_size: 2048,
    status: 'pending' as const,
    rejection_reason: null,
    submitted_at: new Date().toISOString(),
    reviewed_at: null,
  };

  it('normaliza la relación uno a uno que devuelve Supabase', () => {
    expect(normalizeBankTransferReceipts(receipt)).toEqual([receipt]);
  });

  it('conserva arrays y convierte valores vacíos en una lista vacía', () => {
    expect(normalizeBankTransferReceipts([receipt])).toEqual([receipt]);
    expect(normalizeBankTransferReceipts(null)).toEqual([]);
    expect(normalizeBankTransferReceipts(undefined)).toEqual([]);
  });
});

describe('formatOrderPhone', () => {
  it('extrae el prefijo internacional si empieza con + y asigna el país correspondiente', () => {
    const info = formatOrderPhone('+39 340 1234567');
    expect(info).toEqual({
      prefix: '+39',
      number: '340 1234567',
      country: 'Italia',
      display: '+39 340 1234567 (Italia)',
      whatsappDigits: '393401234567',
    });
  });

  it('formatea celular nacional de Uruguay comenzando con 09', () => {
    const info = formatOrderPhone('099 123 456');
    expect(info).toEqual({
      prefix: '+598',
      number: '099 123 456',
      country: 'Uruguay',
      display: '+598 099 123 456 (Uruguay)',
      whatsappDigits: '59899123456',
    });
  });

  it('formatea celular de Brasil con prefijo +55', () => {
    const info = formatOrderPhone('+55 11 99999-9999');
    expect(info).toEqual({
      prefix: '+55',
      number: '11 99999-9999',
      country: 'Brasil',
      display: '+55 11 99999-9999 (Brasil)',
      whatsappDigits: '5511999999999',
    });
  });

  it('maneja números que comiencen con dígitos de código conocidos sin + (ej. 39 para Italia, 598 para Uruguay)', () => {
    expect(formatOrderPhone('39 340 123456')).toEqual({
      prefix: '+39',
      number: '340 123456',
      country: 'Italia',
      display: '+39 340 123456 (Italia)',
      whatsappDigits: '39340123456',
    });

    expect(formatOrderPhone('598 99 123 456')).toEqual({
      prefix: '+598',
      number: '99 123 456',
      country: 'Uruguay',
      display: '+598 99 123 456 (Uruguay)',
      whatsappDigits: '59899123456',
    });
  });

  it('maneja números con prefijo 00 internacional', () => {
    expect(formatOrderPhone('0039 340 123456')).toEqual({
      prefix: '+39',
      number: '340 123456',
      country: 'Italia',
      display: '+39 340 123456 (Italia)',
      whatsappDigits: '39340123456',
    });
  });

  it('retorna null cuando el teléfono está vacío o es nulo', () => {
    expect(formatOrderPhone('')).toBeNull();
    expect(formatOrderPhone('   ')).toBeNull();
    expect(formatOrderPhone(undefined)).toBeNull();
    expect(formatOrderPhone(null)).toBeNull();
  });

  it('soporta claves del diccionario CALLING_CODE_TO_COUNTRY', () => {
    expect(CALLING_CODE_TO_COUNTRY['+598']).toBe('Uruguay');
    expect(CALLING_CODE_TO_COUNTRY['+39']).toBe('Italia');
    expect(CALLING_CODE_TO_COUNTRY['+55']).toBe('Brasil');
  });
});

describe('getCatalogOrderOptionDetails', () => {
  it('prioriza la selección concreta del cliente sobre una variante genérica', () => {
    const details = getCatalogOrderOptionDetails({
      item_type: 'catalog',
      immutable_snapshot: {
        product: { category_code: 'mates' },
        variant: { option_values: { color: 'marron', tamano: 'todos' } },
        selectedOptions: { color: 'marron', tamano: 'mediano' },
      },
    }, defaultCatalogTaxonomy);

    expect(details).toEqual([
      { attribute: 'color', label: 'Color', value: 'Marrón' },
      { attribute: 'tamano', label: 'Tamaño', value: 'Mediano' },
    ]);
  });

  it('recupera las opciones de pedidos anteriores desde la variante inmutable', () => {
    const details = getCatalogOrderOptionDetails({
      item_type: 'catalog',
      immutable_snapshot: {
        product: { category_code: 'cintos' },
        variant: { option_values: { color: 'negro', talle: '105' } },
      },
    }, defaultCatalogTaxonomy);

    expect(details.map(detail => [detail.label, detail.value])).toEqual([
      ['Color', 'Negro'],
      ['Talle', '105'],
    ]);
  });

  it('soporta color plano legacy en la variante cuando no está en option_values', () => {
    const details = getCatalogOrderOptionDetails({
      item_type: 'catalog',
      immutable_snapshot: {
        product: { category_code: 'mates' },
        variant: { color: 'marron' },
      },
    }, defaultCatalogTaxonomy);

    expect(details).toEqual([
      { attribute: 'color', label: 'Color', value: 'Marrón' },
    ]);
  });

  it('prioriza color en option_values sobre el color legacy en la variante', () => {
    const details = getCatalogOrderOptionDetails({
      item_type: 'catalog',
      immutable_snapshot: {
        product: { category_code: 'mates' },
        variant: { color: 'marron', option_values: { color: 'negro' } },
      },
    }, defaultCatalogTaxonomy);

    expect(details).toEqual([
      { attribute: 'color', label: 'Color', value: 'Negro' },
    ]);
  });

  it('retorna array vacío para items de diseño o personalizados (exclusión)', () => {
    const details = getCatalogOrderOptionDetails({
      item_type: 'design',
      immutable_snapshot: {
        product: { category_code: 'mates' },
        variant: { color: 'marron', option_values: { color: 'marron' } },
      },
    }, defaultCatalogTaxonomy);

    expect(details).toEqual([]);
  });
});

describe('getItemSku', () => {
  it('prioriza item.sku directo cuando está disponible', () => {
    const sku = getItemSku({
      item_type: 'catalog',
      sku: 'MAT-CAM-01',
      immutable_snapshot: {
        sku: 'SNAP-01',
        variant: { sku: 'VAR-01' },
      },
    });

    expect(sku).toBe('MAT-CAM-01');
  });

  it('usa immutable_snapshot.variant.sku si item.sku no está presente', () => {
    const sku = getItemSku({
      item_type: 'catalog',
      sku: null,
      immutable_snapshot: {
        sku: 'SNAP-01',
        variant: { sku: 'VAR-01' },
      },
    });

    expect(sku).toBe('VAR-01');
  });

  it('usa immutable_snapshot.sku si ni item.sku ni variant.sku están presentes', () => {
    const sku = getItemSku({
      item_type: 'catalog',
      sku: undefined,
      immutable_snapshot: {
        sku: 'SNAP-01',
        variant: {},
      },
    });

    expect(sku).toBe('SNAP-01');
  });

  it('retorna string vacío si ningún SKU está disponible en catálogo', () => {
    const sku = getItemSku({
      item_type: 'catalog',
      sku: null,
      immutable_snapshot: {},
    });

    expect(sku).toBe('');
  });

  it('retorna string vacío para items personalizados (item_type !== "catalog")', () => {
    const sku = getItemSku({
      item_type: 'design',
      sku: 'DES-001',
      immutable_snapshot: {
        sku: 'DES-SNAP-001',
        variant: { sku: 'DES-VAR-001' },
      },
    });

    expect(sku).toBe('');
  });
});

describe('getItemPricing', () => {
  it('resuelve precios directos de unit_price_minor y total_minor en el item', () => {
    const item: OrderItem = {
      id: 'item-1',
      item_type: 'catalog',
      title: 'Mate Camionero',
      quantity: 2,
      unit_price_minor: 150000,
      total_minor: 300000,
      requires_review: false,
      review_status: null,
      immutable_snapshot: {},
    };

    const pricing = getItemPricing(item);
    expect(pricing).toEqual({
      unitPriceMinor: 150000,
      totalMinor: 300000,
    });
  });

  it('calcula totalMinor usando cantidad y precio unitario si total_minor no está', () => {
    const item: OrderItem = {
      id: 'item-2',
      item_type: 'catalog',
      title: 'Bombilla Pico de Loro',
      quantity: 3,
      unit_price_minor: 45000,
      requires_review: false,
      review_status: null,
      immutable_snapshot: {},
    };

    const pricing = getItemPricing(item);
    expect(pricing).toEqual({
      unitPriceMinor: 45000,
      totalMinor: 135000,
    });
  });

  it('obtiene precio unitario desde variant.price_minor en immutable_snapshot', () => {
    const item: OrderItem = {
      id: 'item-3',
      item_type: 'catalog',
      title: 'Matera de Cuero',
      quantity: 1,
      requires_review: false,
      review_status: null,
      immutable_snapshot: {
        variant: { price_minor: 220000 },
      },
    };

    const pricing = getItemPricing(item);
    expect(pricing).toEqual({
      unitPriceMinor: 220000,
      totalMinor: 220000,
    });
  });

  it('deduce unitPriceMinor dividiendo totalMinor por cantidad si falta el unitario', () => {
    const item: OrderItem = {
      id: 'item-4',
      item_type: 'design',
      title: 'Mate Personalizado con Grabado',
      quantity: 2,
      total_minor: 500000,
      requires_review: true,
      review_status: 'pending',
      immutable_snapshot: {},
    };

    const pricing = getItemPricing(item);
    expect(pricing).toEqual({
      unitPriceMinor: 250000,
      totalMinor: 500000,
    });
  });

  it('retorna 0 y 0 cuando no hay ninguna información de precio', () => {
    const item: OrderItem = {
      id: 'item-5',
      item_type: 'catalog',
      title: 'Item sin precio',
      quantity: 1,
      requires_review: false,
      review_status: null,
      immutable_snapshot: {},
    };

    const pricing = getItemPricing(item);
    expect(pricing).toEqual({
      unitPriceMinor: 0,
      totalMinor: 0,
    });
  });
});

describe('weight calculations and formatting', () => {
  it('formatea correctamente los pesos en gramos y kilogramos', () => {
    expect(formatWeight(0)).toBe('0 g');
    expect(formatWeight(-10)).toBe('0 g');
    expect(formatWeight(350)).toBe('350 g');
    expect(formatWeight(1000)).toBe('1 kg');
    expect(formatWeight(1500)).toBe('1.50 kg');
    expect(formatWeight(2350)).toBe('2.35 kg');
  });

  it('obtiene el peso unitario del producto desde snapshot o relación source_variant', () => {
    const itemWithSnapshot: OrderItem = {
      id: 'item-snap',
      item_type: 'catalog',
      title: 'Mate Imperial',
      quantity: 1,
      requires_review: false,
      review_status: null,
      immutable_snapshot: {
        product: { peso: 420 },
      },
    };
    expect(getOrderItemWeight(itemWithSnapshot)).toBe(420);

    const itemWithVariant: OrderItem = {
      id: 'item-variant',
      item_type: 'catalog',
      title: 'Mate Torpedo',
      quantity: 2,
      requires_review: false,
      review_status: null,
      immutable_snapshot: {},
      source_variant: {
        product: { peso: 380 },
      },
    };
    expect(getOrderItemWeight(itemWithVariant)).toBe(380);

    const itemWithoutWeight: OrderItem = {
      id: 'item-empty',
      item_type: 'catalog',
      title: 'Bombilla',
      quantity: 1,
      requires_review: false,
      review_status: null,
      immutable_snapshot: {},
    };
    expect(getOrderItemWeight(itemWithoutWeight)).toBe(0);

    const itemDesign: OrderItem = {
      id: 'item-design',
      item_type: 'design',
      title: 'Mate Personalizado con Grabado',
      quantity: 1,
      requires_review: true,
      review_status: 'pending',
      immutable_snapshot: {},
    };
    expect(getOrderItemWeight(itemDesign)).toBe(200);
  });

  it('calcula el peso total de la orden sumando los items multiplicados por su cantidad', () => {
    const order: Order = {
      id: 'order-1',
      order_number: 101,
      status: 'pending',
      shipping_method: 'national_shipping',
      shipping_snapshot: {},
      shipping_carrier: null,
      tracking_code: null,
      shipped_at: null,
      total_minor: 350000,
      created_at: new Date().toISOString(),
      customer_snapshot: {},
      order_items: [
        {
          id: 'item-1',
          item_type: 'catalog',
          title: 'Mate Imperial',
          quantity: 2,
          requires_review: false,
          review_status: null,
          immutable_snapshot: { product: { peso: 400 } },
        },
        {
          id: 'item-2',
          item_type: 'catalog',
          title: 'Bombilla Pico de Loro',
          quantity: 3,
          requires_review: false,
          review_status: null,
          immutable_snapshot: { product: { peso: 50 } },
        },
      ],
    };

    // 2 * 400 + 3 * 50 = 800 + 150 = 950 g
    expect(getOrderTotalWeight(order)).toBe(950);
  });

  it('prioriza el peso de la orden si ya fue persistido explícitamente en la orden', () => {
    const orderWithExplicitWeight: Order = {
      id: 'order-2',
      order_number: 102,
      status: 'pending',
      shipping_method: 'national_shipping',
      shipping_snapshot: {},
      shipping_carrier: null,
      tracking_code: null,
      shipped_at: null,
      total_minor: 350000,
      created_at: new Date().toISOString(),
      customer_snapshot: {},
      peso: 1200,
      order_items: [],
    };

    expect(getOrderTotalWeight(orderWithExplicitWeight)).toBe(1200);
  });
});
