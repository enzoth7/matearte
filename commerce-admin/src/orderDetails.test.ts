import { describe, expect, it } from 'vitest';
import { getCatalogOrderOptionDetails, getOrderDeliveryDetails } from './App';
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
      phone: '099 123 456',
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
});
