// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';

describe('medición propia del recorrido', () => {
  it('mantiene una sesión durante la navegación y no duplica pasos ni envía datos de contacto o parámetros', async () => {
    const beacons: string[] = [];
    let time = Date.now();
    const clock = vi.spyOn(Date, 'now').mockImplementation(() => time);
    Object.defineProperty(navigator, 'sendBeacon', { configurable: true, value: vi.fn((_url: string, blob: Blob) => { void blob.text().then((value) => beacons.push(value)); return true; }) });
    window.history.replaceState(null, '', '/personalizer?email=private@example.com');
    const analytics = await import('../../shared/journeyAnalytics');
    analytics.startJourneyAnalytics({ endpoint: 'https://example.supabase.co/functions/v1/analytics-collect' });
    analytics.setJourneyScreen('custom', 'personalizer_open', '/personalizer');
    analytics.setJourneyScreen('custom', 'personalizer_open', '/personalizer');
    time += 4200;
    analytics.setJourneyScreen('custom', 'design_started', '/design');
    analytics.trackJourneyStep('custom', 'design_started');
    time += 3000;
    analytics.finishJourneyScreen();
    await vi.waitFor(() => expect(beacons).toHaveLength(4));
    const events = beacons.map((value) => JSON.parse(value));
    expect(events.filter((item) => item.kind === 'step' && item.step === 'design_started')).toHaveLength(1);
    expect(events.filter((item) => item.kind === 'screen').map((item) => item.visible_ms)).toEqual([4200, 3000]);
    expect(new Set(events.map((item) => item.session_id)).size).toBe(1);
    for (const item of events) {
      expect(Object.keys(item).sort()).toEqual(['device', 'event_id', 'journey', 'kind', 'scroll_pct', 'session_id', 'step', 'visible_ms']);
      expect(JSON.stringify(item)).not.toContain('private@example.com');
    }
    clock.mockRestore();
  });
});
