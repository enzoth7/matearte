'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useLocale } from 'next-intl';
import { analyticsPermission, saveAnalyticsPermission } from '../../../shared/analyticsConsent';
import { setJourneyScreen, startJourneyAnalytics, trackJourneyStep } from '../../../shared/journeyAnalytics';

export function JourneyTracker() {
  const pathname = usePathname();
  const locale = useLocale();
  const [ready, setReady] = useState(false);
  const [ask, setAsk] = useState(false);
  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!url) return;
    let active = true;
    void analyticsPermission().then((permission) => {
      if (!active) return;
      if (permission === 'required') { setAsk(true); return; }
      if (permission === 'allowed') setReady(true);
    });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!url || !ready) return;
    startJourneyAnalytics({ endpoint: `${url}/functions/v1/analytics-collect`, gaId: process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID, clarityId: process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID });
    trackJourneyStep('catalog', 'entry');
    trackJourneyStep('custom', 'entry');
    if (/(^|\/)personalizados(\/|$)/.test(pathname)) setJourneyScreen('custom', 'custom_page', pathname);
    else if (/(^|\/)(catalogo|catalog)(\/|$)/.test(pathname)) setJourneyScreen('catalog', 'catalog', pathname);
    else if (/(^|\/)(producto|product|produto)\//.test(pathname)) setJourneyScreen('catalog', 'product', pathname);
    else setJourneyScreen('catalog', 'entry', pathname);
  }, [pathname, ready]);
  if (!ask) return null;
  const text = locale === 'en' ? { message: 'Allow usage analytics, heatmaps and recordings to help us improve this website?', accept: 'Allow analytics', reject: 'Continue without analytics', policy: 'Privacy policy' }
    : locale === 'pt' ? { message: 'Permitir análise de uso, mapas de interação e gravações para melhorar este site?', accept: 'Permitir análise', reject: 'Continuar sem análise', policy: 'Política de privacidade' }
    : { message: '¿Permitís la medición de uso, mapas de interacción y grabaciones para mejorar este sitio?', accept: 'Permitir analítica', reject: 'Seguir sin analítica', policy: 'Política de privacidad' };
  return <aside className="analytics-consent" role="dialog" aria-label={text.policy}><p>{text.message} <a href="/compras/politica-de-privacidad">{text.policy}</a></p><div><button onClick={() => { saveAnalyticsPermission(false); setAsk(false); }}>{text.reject}</button><button onClick={() => { saveAnalyticsPermission(true); setAsk(false); setReady(true); }}>{text.accept}</button></div></aside>;
}
