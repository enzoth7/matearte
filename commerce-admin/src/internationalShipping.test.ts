import { describe, expect, it } from 'vitest';
import {
  DEFAULT_INTERNATIONAL_SHIPPING_RATES,
  INTERNATIONAL_SHIPPING_ZONES,
  formatUyu,
  getInternationalShippingRate,
  resolveCountryZone,
} from './internationalShipping';

describe('international shipping zones and rates', () => {
  it('contiene exactamente 25 filas de rangos de peso con 7 zonas numéricas válidas', () => {
    expect(DEFAULT_INTERNATIONAL_SHIPPING_RATES).toHaveLength(25);
    expect(INTERNATIONAL_SHIPPING_ZONES).toHaveLength(7);

    DEFAULT_INTERNATIONAL_SHIPPING_RATES.forEach((row, index) => {
      expect(row.row_order).toBe(index + 1);
      expect(row.weight_min_g).toBeGreaterThan(0);
      expect(row.weight_max_g).toBeGreaterThan(row.weight_min_g);

      INTERNATIONAL_SHIPPING_ZONES.forEach((zone) => {
        expect(typeof row[zone.key]).toBe('number');
        expect(row[zone.key]).toBeGreaterThan(0);
      });
    });
  });

  it('resuelve correctamente la zona geográfica de cualquier país', () => {
    // Argentina
    expect(resolveCountryZone('Argentina')).toBe('argentina');
    expect(resolveCountryZone('AR')).toBe('argentina');

    // Suramérica (Bolivia, Brasil, Chile, Paraguay, Venezuela)
    expect(resolveCountryZone('Brasil')).toBe('suramerica');
    expect(resolveCountryZone('Brazil')).toBe('suramerica');
    expect(resolveCountryZone('Chile')).toBe('suramerica');
    expect(resolveCountryZone('Paraguay')).toBe('suramerica');
    expect(resolveCountryZone('Bolivia')).toBe('suramerica');
    expect(resolveCountryZone('Venezuela')).toBe('suramerica');

    // Estados Unidos
    expect(resolveCountryZone('Estados Unidos')).toBe('estados_unidos');
    expect(resolveCountryZone('EE. UU.')).toBe('estados_unidos');
    expect(resolveCountryZone('USA')).toBe('estados_unidos');
    expect(resolveCountryZone('United States')).toBe('estados_unidos');

    // España
    expect(resolveCountryZone('España')).toBe('espana');
    expect(resolveCountryZone('Spain')).toBe('espana');
    expect(resolveCountryZone('ES')).toBe('espana');

    // Resto de América
    expect(resolveCountryZone('Colombia')).toBe('resto_america');
    expect(resolveCountryZone('México')).toBe('resto_america');
    expect(resolveCountryZone('Mexico')).toBe('resto_america');
    expect(resolveCountryZone('Canadá')).toBe('resto_america');
    expect(resolveCountryZone('Perú')).toBe('resto_america');
    expect(resolveCountryZone('Ecuador')).toBe('resto_america');
    expect(resolveCountryZone('Panamá')).toBe('resto_america');

    // Resto de Europa
    expect(resolveCountryZone('Alemania')).toBe('resto_europa');
    expect(resolveCountryZone('Francia')).toBe('resto_europa');
    expect(resolveCountryZone('Italia')).toBe('resto_europa');
    expect(resolveCountryZone('Reino Unido')).toBe('resto_europa');
    expect(resolveCountryZone('Portugal')).toBe('resto_europa');
    expect(resolveCountryZone('Suiza')).toBe('resto_europa');

    // Resto del mundo
    expect(resolveCountryZone('Japón')).toBe('resto_mundo');
    expect(resolveCountryZone('Australia')).toBe('resto_mundo');
    expect(resolveCountryZone('China')).toBe('resto_mundo');
    expect(resolveCountryZone('Sudáfrica')).toBe('resto_mundo');
  });

  it('cotiza correctamente según el peso y país según la planilla', () => {
    // 400g a Argentina -> Rango 250 - 500: $ 2.760,00
    const cotiz1 = getInternationalShippingRate(400, 'Argentina');
    expect(cotiz1).not.toBeNull();
    expect(cotiz1?.rangeLabel).toBe('250 - 500');
    expect(cotiz1?.rate).toBe(2760.0);

    // 150g (menor al rango mínimo) a España -> Rango 250 - 500: $ 3.120,50
    const cotizMin = getInternationalShippingRate(150, 'España');
    expect(cotizMin?.rangeLabel).toBe('250 - 500');
    expect(cotizMin?.rate).toBe(3120.5);

    // 850g a España -> Rango 500 - 1: $ 3.299,00
    const cotiz2 = getInternationalShippingRate(850, 'España');
    expect(cotiz2?.rangeLabel).toBe('500 - 1');
    expect(cotiz2?.rate).toBe(3299.0);

    // 1200g a Brasil -> Rango 1 - 1,5: $ 2.991,00
    const cotiz3 = getInternationalShippingRate(1200, 'Brasil');
    expect(cotiz3?.rangeLabel).toBe('1 - 1,5');
    expect(cotiz3?.rate).toBe(2991.0);

    // 2200g a Estados Unidos -> Rango 2 - 2,5: $ 3.929,00
    const cotiz4 = getInternationalShippingRate(2200, 'USA');
    expect(cotiz4?.rangeLabel).toBe('2 - 2,5');
    expect(cotiz4?.rate).toBe(3929.0);

    // 5500g a Francia -> Rango 5 - 6: $ 5.637,00
    const cotiz5 = getInternationalShippingRate(5500, 'Francia');
    expect(cotiz5?.rangeLabel).toBe('5 - 6');
    expect(cotiz5?.rate).toBe(5637.0);

    // 19500g a Japón -> Rango 19 - 20: $ 13.718,50
    const cotiz6 = getInternationalShippingRate(19500, 'Japón');
    expect(cotiz6?.rangeLabel).toBe('19 - 20');
    expect(cotiz6?.rate).toBe(13718.5);

    // Mayor a 20kg -> Toma el rango máximo (19 - 20)
    const cotizMax = getInternationalShippingRate(25000, 'Estados Unidos');
    expect(cotizMax?.rangeLabel).toBe('19 - 20');
    expect(cotizMax?.rate).toBe(13540.0);
  });

  it('formatea montos en moneda UYU', () => {
    const formatted = formatUyu(3299.5);
    expect(formatted).toContain('3.299,50');
  });
});
