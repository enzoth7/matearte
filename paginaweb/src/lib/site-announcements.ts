export type PublicSiteAnnouncement = {
  id: string;
  image_path: string;
  alt_text: string;
  valid_from: string;
  valid_until: string;
  created_at: string;
};

export const announcementDismissalKey = (id: string) => `matearte-announcement-dismissed:${id}`;

export const montevideoDate = (now = new Date()) => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Montevideo', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(now);

export function isAnnouncementCurrent(
  announcement: Pick<PublicSiteAnnouncement, 'valid_from' | 'valid_until'>,
  today = montevideoDate(),
) {
  return announcement.valid_from <= today && announcement.valid_until >= today;
}
