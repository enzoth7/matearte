import { describe, expect, it } from 'vitest';
import { announcementStatus } from './Announcements';

describe('announcement scheduling', () => {
  const base = { enabled: true, valid_from: '2026-10-15', valid_until: '2026-10-18' };

  it('includes both boundary dates in the visible window', () => {
    expect(announcementStatus(base, '2026-10-15')).toBe('Visible ahora');
    expect(announcementStatus(base, '2026-10-18')).toBe('Visible ahora');
  });

  it('distinguishes scheduled, expired and disabled notices', () => {
    expect(announcementStatus(base, '2026-10-14')).toBe('Programado');
    expect(announcementStatus(base, '2026-10-19')).toBe('Vencido');
    expect(announcementStatus({ ...base, enabled: false }, '2026-10-16')).toBe('Deshabilitado');
  });
});
