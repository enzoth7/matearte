import { describe, expect, it } from 'vitest';
import { discountStatus, normalizeAdminDiscountCode } from './DiscountsView';

describe('discount administration helpers', () => {
  it('normalizes codes to the database-safe canonical form', () => {
    expect(normalizeAdminDiscountCode(' mate 10!*_uy ')).toBe('MATE10_UY');
    expect(normalizeAdminDiscountCode('a'.repeat(40))).toHaveLength(32);
  });

  it('derives disabled, scheduled, active and expired statuses', () => {
    const base = { enabled: true, valid_from: '2026-09-01', valid_until: '2026-09-30' };
    expect(discountStatus({ ...base, enabled: false }, '2026-09-23')).toBe('Deshabilitado');
    expect(discountStatus(base, '2026-08-31')).toBe('Programado');
    expect(discountStatus(base, '2026-09-01')).toBe('Habilitado');
    expect(discountStatus(base, '2026-09-30')).toBe('Habilitado');
    expect(discountStatus(base, '2026-10-01')).toBe('Vencido');
  });
});
