import { describe, expect, it } from 'vitest';
import { announcementDismissalKey, isAnnouncementCurrent, montevideoDate } from './site-announcements';

describe('storefront announcements', () => {
  it('uses an inclusive date window', () => {
    const announcement = { valid_from: '2026-10-15', valid_until: '2026-10-18' };
    expect(isAnnouncementCurrent(announcement, '2026-10-15')).toBe(true);
    expect(isAnnouncementCurrent(announcement, '2026-10-18')).toBe(true);
    expect(isAnnouncementCurrent(announcement, '2026-10-19')).toBe(false);
  });

  it('builds a dismissal key per notice and formats the Uruguay date', () => {
    expect(announcementDismissalKey('abc')).toBe('matearte-announcement-dismissed:abc');
    expect(montevideoDate(new Date('2026-10-15T02:00:00Z'))).toBe('2026-10-14');
  });
});
