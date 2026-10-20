'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { createBrowserSupabase } from '@/lib/supabase/browser';
import { announcementDismissalKey, isAnnouncementCurrent, montevideoDate, type PublicSiteAnnouncement } from '@/lib/site-announcements';
import { NewsletterForm } from '@/components/NewsletterForm';

const BUCKET = 'site-announcements';

export function StorefrontAnnouncement() {
  const t = useTranslations('welcomeSubscription');
  const common = useTranslations('common');
  const [announcement, setAnnouncement] = useState<PublicSiteAnnouncement | null>(null);
  const [announcementLoaded, setAnnouncementLoaded] = useState(false);
  const [offer, setOffer] = useState<{ enabled: boolean; headline: string; description: string; image_url: string | null } | null>(null);
  const [offerDismissed, setOfferDismissed] = useState(false);
  const closeButton = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => {
    if (!announcement) return;
    sessionStorage.setItem(announcementDismissalKey(announcement.id), '1');
    setAnnouncement(null);
  }, [announcement]);
  const closeOffer = useCallback(() => { sessionStorage.setItem('matearte-welcome-dismissed', '1'); setOfferDismissed(true); }, []);

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
      } finally {
        if (active) setAnnouncementLoaded(true);
      }
    };
    void load();
    void createBrowserSupabase().from('marketing_active_offer')
      .select('headline,description,image_url').eq('id', true).maybeSingle()
      .then(({ data }) => {
        if (active && data && sessionStorage.getItem('matearte-welcome-dismissed') !== '1' && sessionStorage.getItem('matearte-welcome-submitted') !== '1') {
          setOffer({ ...data, enabled: true });
        }
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!announcement && (!offer?.enabled || offerDismissed)) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButton.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { if (announcement) close(); else closeOffer(); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [announcement, offer, offerDismissed, close, closeOffer]);

  const showOffer = announcementLoaded && !announcement && offer?.enabled && !offerDismissed;
  if (!announcement && !showOffer) return <span hidden data-storefront-announcement-loader />;
  if (showOffer) return <div className="storefront-announcement-backdrop" role="presentation">
    <section className="storefront-announcement storefront-subscription" role="dialog" aria-modal="true" aria-label={t('dialogLabel')}>
      <button ref={closeButton} type="button" className="storefront-subscription-close" onClick={closeOffer} aria-label={common('close')}>×</button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {offer.image_url && <img className="storefront-subscription-image" src={offer.image_url} alt="" />}
      <h2>{offer.headline}</h2><p>{offer.description}</p>
      <NewsletterForm source="welcome" emailLabel={t('email')} nameLabel={t('name')} subscribeLabel={t('subscribe')} subscribeMobileLabel={t('subscribe')} subscribingLabel={t('subscribing')} successMessage={t('success')} invalidEmailMessage={t('invalidEmail')} invalidNameMessage={t('invalidName')} errorMessage={t('error')} consentMessage={t('consent')} onSuccess={() => sessionStorage.setItem('matearte-welcome-submitted', '1')} />
    </section>
  </div>;
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
