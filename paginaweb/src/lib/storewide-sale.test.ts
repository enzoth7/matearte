import { describe, expect, it } from 'vitest';
import {
  activeStorewideSalePercent, couponBeatsSale, lowestPriceMinor, readStorewideSale, salePriceMinor, saleSavingsMinor, storewideSaleState,
} from '../../../shared/storewide-sale';

const settings = (overrides = {}) => ({
  storewide_sale_enabled: true,
  storewide_sale_percent: 20,
  storewide_sale_valid_from: null,
  storewide_sale_valid_until: null,
  ...overrides,
});

describe('storewide sale', () => {
  it('takes 20 percent off whole pesos exactly like the database', () => {
    expect(salePriceMinor(220000, 20)).toBe(176000);
    expect(salePriceMinor(12345, 20)).toBe(9900);
    expect(salePriceMinor(820000, 20)).toBe(656000);
    expect(salePriceMinor(1000, 0)).toBe(1000);
  });

  it('never raises a price and never goes below zero', () => {
    expect(salePriceMinor(0, 20)).toBe(0);
    expect(salePriceMinor(50, 20)).toBeLessThanOrEqual(50);
    expect(salePriceMinor(220000, 99.99)).toBeGreaterThanOrEqual(0);
  });

  it('is active only inside its dates and when enabled', () => {
    expect(storewideSaleState(settings({ storewide_sale_enabled: false }), '2026-11-18')).toBe('off');
    expect(storewideSaleState(settings({ storewide_sale_valid_from: '2026-11-19' }), '2026-11-18')).toBe('scheduled');
    expect(storewideSaleState(settings({ storewide_sale_valid_until: '2026-11-17' }), '2026-11-18')).toBe('expired');
    expect(storewideSaleState(settings({ storewide_sale_valid_from: '2026-11-18', storewide_sale_valid_until: '2026-11-18' }), '2026-11-18')).toBe('active');
    expect(activeStorewideSalePercent(settings(), '2026-11-18')).toBe(20);
    expect(activeStorewideSalePercent(settings({ storewide_sale_enabled: false }), '2026-11-18')).toBe(0);
    expect(activeStorewideSalePercent(null)).toBe(0);
  });

  it('falls back to a safe default for invalid percentages', () => {
    expect(readStorewideSale({ storewide_sale_enabled: true, storewide_sale_percent: 150 }).storewide_sale_percent).toBe(20);
  });

  it('keeps the lowest price instead of stacking discounts', () => {
    const list = 100000;
    expect(lowestPriceMinor(salePriceMinor(list, 20), Math.round(list * 0.9))).toBe(80000);
    expect(lowestPriceMinor(salePriceMinor(list, 5), Math.round(list * 0.9))).toBe(90000);
    expect(lowestPriceMinor(salePriceMinor(list, 20), Math.round(list * 0.7))).toBe(70000);
  });

  it('uses a code only when it saves more than the general sale', () => {
    const lines = [{ itemType: 'catalog', quantity: 2, listUnitMinor: 100000, saleUnitMinor: 80000 }];
    expect(saleSavingsMinor(lines)).toBe(40000);
    expect(couponBeatsSale(30000, saleSavingsMinor(lines))).toBe(false);
    expect(couponBeatsSale(40000, saleSavingsMinor(lines))).toBe(false);
    expect(couponBeatsSale(40001, saleSavingsMinor(lines))).toBe(true);
  });
});
