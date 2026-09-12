import { describe, expect, it } from 'vitest';
import { getOrderDeliveryDetails } from './App';

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
