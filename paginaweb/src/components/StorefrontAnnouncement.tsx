'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createBrowserSupabase } from '@/lib/supabase/browser';
import { announcementDismissalKey, isAnnouncementCurrent, montevideoDate, type PublicSiteAnnouncement } from '@/lib/site-announcements';

const BUCKET = 'site-announcements';

export function StorefrontAnnouncement() {
  const [announcement, setAnnouncement] = useState<PublicSiteAnnouncement | null>(null);
  const closeButton = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => {
    if (!announcement) return;
    sessionStorage.setItem(announcementDismissalKey(announcement.id), '1');
    setAnnouncement(null);
  }, [announcement]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const today = montevideoDate();
        const supabase = createBrowserSupabase();
        const { data, error } = await supabase
          .from('site_announcements')
          .select('id,image_path,alt_text,valid_from,valid_until,created_at')
          .eq('enabled', true)
          .lte('valid_from', today)
          .gte('valid_until', today)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (error) {
          console.warn('No se pudo consultar el aviso de portada.', error.message);
          return;
        }
        if (!data || !isAnnouncementCurrent(data, today)) return;
        if (sessionStorage.getItem(announcementDismissalKey(data.id)) === '1') return;
        if (active) setAnnouncement(data as PublicSiteAnnouncement);
      } catch (error) {
        // A promotional notice must never prevent the storefront from loading.
        console.warn('No se pudo cargar el aviso de portada.', error);
      }
    };
    void load();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!announcement) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButton.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [announcement, close]);

  if (!announcement) return <span hidden data-storefront-announcement-loader />;
  const supabase = createBrowserSupabase();
  const imageUrl = announcement.image_path.startsWith('/')
    ? announcement.image_path
    : supabase.storage.from(BUCKET).getPublicUrl(announcement.image_path).data.publicUrl;

  return <div className="storefront-announcement-backdrop" role="presentation">
    <section className="storefront-announcement" role="dialog" aria-modal="true" aria-label="Aviso de Matearte">
      <div className="storefront-announcement-image">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl} alt={announcement.alt_text} />
      </div>
      <button ref={closeButton} type="button" onClick={close}>Cerrar</button>
    </section>
  </div>;
}
