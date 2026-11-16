'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { analyticsPermission } from '../../../shared/analyticsConsent';
import { setJourneyScreen, startJourneyAnalytics, trackJourneyStep } from '../../../shared/journeyAnalytics';

export function JourneyTracker() {
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!url) return;
    let active = true;
    void analyticsPermission().then((permission) => {
      if (!active) return;
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
  return null;
}
