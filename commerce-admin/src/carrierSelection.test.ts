import { describe, expect, it } from 'vitest';
import { CARRIER_OPTIONS, resolveCarrierSelection } from './App';

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
