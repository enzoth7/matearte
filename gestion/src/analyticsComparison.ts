export type AnalyticsDaily = { day: string; journey: 'catalog' | 'custom'; step: string; sessions: number };
export type AnalyticsChange = { changed_on: string; journey: 'catalog' | 'custom' | 'both' };
export const shiftAnalyticsDay = (day: string, by: number) => new Date(Date.parse(`${day}T00:00:00Z`) + by * 86400000).toISOString().slice(0, 10);

export function compareAnalyticsChange(change: AnalyticsChange, daily: AnalyticsDaily[], activated: string | null, today: string) {
  const beforeStart = shiftAnalyticsDay(change.changed_on, -14), beforeEnd = shiftAnalyticsDay(change.changed_on, -1);
  const afterStart = shiftAnalyticsDay(change.changed_on, 1), afterEnd = shiftAnalyticsDay(change.changed_on, 14);
  if (!activated || beforeStart < activated || afterEnd >= today) return { status: 'pending' as const };
  const journeys = change.journey === 'both' ? ['catalog', 'custom'] : [change.journey];
  const totals = (start: string, end: string) => {
    const selected = daily.filter((row) => row.day >= start && row.day <= end && journeys.includes(row.journey));
    return { entry: selected.filter((row) => row.step === 'entry').reduce((sum, row) => sum + row.sessions, 0), cart: selected.filter((row) => row.step === 'cart').reduce((sum, row) => sum + row.sessions, 0) };
  };
  const before = totals(beforeStart, beforeEnd), after = totals(afterStart, afterEnd);
  const first = before.entry ? before.cart / before.entry : 0, second = after.entry ? after.cart / after.entry : 0;
  return { status: 'ready' as const, before, after, difference: (second - first) * 100 };
}
