import { afterEach, describe, expect, it, vi } from 'vitest';
import { CARRIER_OPTIONS, getStoreApiUrl, resolveCarrierSelection } from './App';

describe('CARRIER_OPTIONS', () => {
  it('contiene transportistas nacionales e internacionales esperados', () => {
    const national = CARRIER_OPTIONS.filter(c => c.group === 'national').map(c => c.value);
    const international = CARRIER_OPTIONS.filter(c => c.group === 'international').map(c => c.value);

    expect(national).toEqual(['DAC', 'Correo Uruguayo', 'Mirtrans', 'DePunta']);
    expect(international).toEqual(['DHL Express', 'FedEx', 'UPS']);
  });
});

describe('resolveCarrierSelection', () => {
  it('resuelve correctamente transportistas predefinidos nacionales e internacionales', () => {
    const dac = resolveCarrierSelection('DAC');
    expect(dac.selectedCarrier).toBe('DAC');
    expect(dac.customCarrier).toBe('');
    expect(dac.shippingCarrier).toBe('DAC');

    const dhl = resolveCarrierSelection('DHL Express');
    expect(dhl.selectedCarrier).toBe('DHL Express');
    expect(dhl.customCarrier).toBe('');
    expect(dhl.shippingCarrier).toBe('DHL Express');
  });

  it('resuelve transportista personalizado como __other__ si no está en la lista predefinida', () => {
    const custom = resolveCarrierSelection('Turil');
    expect(custom.selectedCarrier).toBe('__other__');
    expect(custom.customCarrier).toBe('Turil');
    expect(custom.shippingCarrier).toBe('Turil');
  });

  it('resuelve valores vacíos o nulos sin selección previa', () => {
    const emptyNull = resolveCarrierSelection(null);
    expect(emptyNull.selectedCarrier).toBe('');
    expect(emptyNull.customCarrier).toBe('');
    expect(emptyNull.shippingCarrier).toBe('');

    const emptyUndefined = resolveCarrierSelection(undefined);
    expect(emptyUndefined.selectedCarrier).toBe('');
    expect(emptyUndefined.customCarrier).toBe('');
    expect(emptyUndefined.shippingCarrier).toBe('');

    const emptyString = resolveCarrierSelection('   ');
    expect(emptyString.selectedCarrier).toBe('');
    expect(emptyString.customCarrier).toBe('');
    expect(emptyString.shippingCarrier).toBe('');
  });
});

describe('getStoreApiUrl', () => {
  afterEach(() => {
    delete (globalThis as unknown as { window?: unknown }).window;
    vi.unstubAllEnvs();
  });

  it('usa VITE_STORE_API_URL si está definido en el entorno', () => {
    vi.stubEnv('VITE_STORE_API_URL', 'https://custom-api.matearteuruguay.com/');
    expect(getStoreApiUrl()).toBe('https://custom-api.matearteuruguay.com');
  });

  it('devuelve http://localhost:3000 si está en localhost', () => {
    vi.stubEnv('VITE_STORE_API_URL', '');
    (globalThis as unknown as { window: unknown }).window = {
      location: { hostname: 'localhost' },
    };
    expect(getStoreApiUrl()).toBe('http://localhost:3000');
  });

  it('devuelve http://localhost:3000 si está en 127.0.0.1', () => {
    vi.stubEnv('VITE_STORE_API_URL', '');
    (globalThis as unknown as { window: unknown }).window = {
      location: { hostname: '127.0.0.1' },
    };
    expect(getStoreApiUrl()).toBe('http://localhost:3000');
  });

  it('devuelve https://www.matearteuruguay.com como fallback en producción/Vercel', () => {
    vi.stubEnv('VITE_STORE_API_URL', '');
    (globalThis as unknown as { window: unknown }).window = {
      location: { hostname: 'matearte-commerce-admin.vercel.app' },
    };
    expect(getStoreApiUrl()).toBe('https://www.matearteuruguay.com');
  });

  it('devuelve https://www.matearteuruguay.com si window no está definido', () => {
    vi.stubEnv('VITE_STORE_API_URL', '');
    delete (globalThis as unknown as { window?: unknown }).window;
    expect(getStoreApiUrl()).toBe('https://www.matearteuruguay.com');
  });
});
