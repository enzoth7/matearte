import { describe, expect, it } from 'vitest';
import { compareAnalyticsChange, type AnalyticsDaily } from './analyticsComparison';

describe('comparación de cambios en los recorridos', () => {
  const change = { changed_on: '2026-10-15', journey: 'catalog' as const };
  const rows: AnalyticsDaily[] = [
    { day: '2026-10-01', journey: 'catalog', step: 'entry', sessions: 20 },
    { day: '2026-10-01', journey: 'catalog', step: 'cart', sessions: 2 },
    { day: '2026-10-15', journey: 'catalog', step: 'entry', sessions: 100 },
    { day: '2026-10-15', journey: 'catalog', step: 'cart', sessions: 100 },
    { day: '2026-10-16', journey: 'catalog', step: 'entry', sessions: 20 },
    { day: '2026-10-16', journey: 'catalog', step: 'cart', sessions: 4 },
    { day: '2026-10-16', journey: 'custom', step: 'cart', sessions: 30 },
  ];
  it('excluye el día del cambio y compara solo el recorrido afectado', () => {
    const result = compareAnalyticsChange(change, rows, '2026-10-01', '2026-11-05');
    expect(result).toEqual({ status: 'ready', before: { entry: 20, cart: 2 }, after: { entry: 20, cart: 4 }, difference: 10 });
  });
  it('espera 14 días completos y datos desde antes del cambio', () => {
    expect(compareAnalyticsChange(change, rows, '2026-10-01', '2026-10-29').status).toBe('pending');
    expect(compareAnalyticsChange(change, rows, '2026-10-02', '2026-11-05').status).toBe('pending');
  });
});
