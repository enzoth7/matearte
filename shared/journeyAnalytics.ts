export type Journey = 'catalog' | 'custom';
export type JourneyStep = 'entry' | 'catalog' | 'product' | 'custom_page' | 'personalizer_open' | 'mate_selected' | 'design_started' | 'summary' | 'cart';
type Config = { endpoint: string; gaId?: string; clarityId?: string };
type Screen = { journey: Journey; step: JourneyStep; key: string; sessionId: string; visibleSince: number | null; visibleMs: number; maxScroll: number };

let config: Config | null = null;
let screen: Screen | null = null;
let pausedScreen: { journey: Journey; step: JourneyStep; key: string } | null = null;
let lastInput = Date.now();
let lastSessionRefresh = 0;
let initialized = false;
const sentSteps = new Set<string>();
const cookieName = 'ma_analytics_session';
const inactiveMs = 30 * 60 * 1000;
const sessionPattern = /^([0-9a-f-]{36})\.(\d{13})$/;

function sessionId() {
  const now = Date.now();
  const value = document.cookie.split('; ').find((part) => part.startsWith(`${cookieName}=`))?.split('=')[1] || '';
  const match = sessionPattern.exec(value);
  const id = match && now - Number(match[2]) < inactiveMs ? match[1] : crypto.randomUUID();
  const domain = location.hostname === 'matearteuruguay.com' || location.hostname.endsWith('.matearteuruguay.com') ? '; Domain=.matearteuruguay.com' : '';
  document.cookie = `${cookieName}=${id}.${now}; Path=/; Max-Age=1800; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}${domain}`;
  return id;
}

function device() {
  const width = window.innerWidth;
  return width < 700 ? 'mobile' : width < 1024 ? 'tablet' : 'desktop';
}

function safeReferrer() {
  try {
    const url = new URL(document.referrer);
    return url.protocol === 'https:' || url.protocol === 'http:' ? `${url.origin}/` : '';
  } catch {
    return '';
  }
}

function send(journey: Journey, step: JourneyStep, kind: 'step' | 'screen', visibleMs = 0, scrollPct = 0, screenSessionId?: string) {
  if (!config?.endpoint) return;
  const id = screenSessionId || sessionId();
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Montevideo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const dedupKey = `${id}:${day}:${journey}:${step}`;
  if (kind === 'step' && (sentSteps.has(dedupKey) || sessionStorage.getItem(`ma_step_${dedupKey}`))) return;
  if (kind === 'step') { sentSteps.add(dedupKey); sessionStorage.setItem(`ma_step_${dedupKey}`, '1'); }
  const payload = JSON.stringify({ event_id: crypto.randomUUID(), session_id: id, journey, device: device(), step, kind, visible_ms: Math.min(1800000, Math.max(0, Math.round(visibleMs))), scroll_pct: Math.min(100, Math.max(0, Math.round(scrollPct))) });
  if (!navigator.sendBeacon || !navigator.sendBeacon(config.endpoint, new Blob([payload], { type: 'text/plain' }))) {
    void fetch(config.endpoint, { method: 'POST', body: payload, headers: { 'Content-Type': 'text/plain' }, keepalive: true });
  }
  if (kind === 'step' && typeof window.gtag === 'function') {
    window.gtag('event', 'journey_step', { journey, step, device: device() });
  }
}

function scrollDepth() {
  const total = document.documentElement.scrollHeight - window.innerHeight;
  return total <= 0 ? 100 : Math.min(100, Math.round(window.scrollY / total * 100));
}

function pauseScreen() {
  if (screen?.visibleSince != null) {
    screen.visibleMs += Math.min(Date.now() - screen.visibleSince, inactiveMs);
    screen.visibleSince = null;
  }
}

function flushScreen() {
  if (!screen) return;
  pauseScreen();
  send(screen.journey, screen.step, 'screen', screen.visibleMs, screen.maxScroll, screen.sessionId);
  screen = null;
}

function addScript(src: string) {
  if (document.querySelector(`script[src="${src}"]`)) return;
  const script = document.createElement('script');
  script.async = true;
  script.src = src;
  document.head.appendChild(script);
}

export function startJourneyAnalytics(next: Config) {
  config = next;
  if (initialized || !next.endpoint || typeof window === 'undefined') return;
  initialized = true;
  if (next.gaId && /^G-[A-Z0-9]+$/.test(next.gaId)) {
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer?.push(arguments); };
    window.gtag('consent', 'default', { analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
    window.gtag('consent', 'update', { analytics_storage: 'granted' });
    window.gtag('js', new Date());
    window.gtag('config', next.gaId, {
      linker: { domains: ['www.matearteuruguay.com', 'personalizador.matearteuruguay.com'] },
      cookie_domain: 'matearteuruguay.com',
      page_location: `${location.origin}/`,
      page_referrer: safeReferrer(),
      page_title: 'MateArte',
      send_page_view: false,
    });
    addScript(`https://www.googletagmanager.com/gtag/js?id=${next.gaId}`);
  }
  if (next.clarityId && /^[a-z0-9]+$/i.test(next.clarityId)) {
    window.clarity = function () { const queue = window.clarity!; queue.q = queue.q || []; queue.q.push(arguments); };
    window.clarity('consentv2', { ad_Storage: 'denied', analytics_Storage: 'granted' });
    addScript(`https://www.clarity.ms/tag/${next.clarityId}`);
  }
  const active = () => {
    if (screen && Date.now() - lastInput >= inactiveMs) {
      pausedScreen = { journey: screen.journey, step: screen.step, key: screen.key };
      flushScreen();
    }
    lastInput = Date.now();
    if (!screen && pausedScreen) setJourneyScreen(pausedScreen.journey, pausedScreen.step, pausedScreen.key);
    if (lastInput - lastSessionRefresh > 60000) {
      sessionId();
      lastSessionRefresh = lastInput;
    }
  };
  for (const event of ['pointerdown', 'keydown', 'scroll', 'touchstart']) window.addEventListener(event, active, { passive: true });
  window.addEventListener('scroll', () => { if (screen) screen.maxScroll = Math.max(screen.maxScroll, scrollDepth()); }, { passive: true });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') pauseScreen();
    else if (screen) screen.visibleSince = Date.now();
  });
  window.addEventListener('pagehide', flushScreen);
  window.setInterval(() => {
    if (screen && Date.now() - lastInput >= inactiveMs) {
      pausedScreen = { journey: screen.journey, step: screen.step, key: screen.key };
      flushScreen();
    }
  }, 30000);
}

export function trackJourneyStep(journey: Journey, step: JourneyStep) {
  if (typeof window === 'undefined') return;
  send(journey, step, 'step');
}

export function setJourneyScreen(journey: Journey, step: JourneyStep, key: string = step) {
  if (typeof window === 'undefined') return;
  if (screen?.journey === journey && screen.step === step && screen.key === key) return;
  flushScreen();
  pausedScreen = null;
  screen = { journey, step, key, sessionId: sessionId(), visibleSince: document.visibilityState === 'visible' ? Date.now() : null, visibleMs: 0, maxScroll: scrollDepth() };
  if (typeof window.gtag === 'function') {
    const page = step === 'catalog' ? '/catalogo' : step === 'product' ? '/producto' : step === 'custom_page' ? '/personalizados' : journey === 'custom' ? '/personalizador' : '/';
    const pageLocation = `${location.origin}${page}`;
    if (config?.gaId) window.gtag('config', config.gaId, { update: true, page_location: pageLocation, page_referrer: safeReferrer(), page_title: step, send_page_view: false });
    window.gtag('event', 'page_view', { page_location: pageLocation, page_path: page, page_title: step });
  }
  trackJourneyStep(journey, step);
}

export function finishJourneyScreen() { if (typeof window !== 'undefined') flushScreen(); }

declare global {
  interface Window {
    dataLayer?: IArguments[];
    gtag?: (...args: unknown[]) => void;
    clarity?: ((...args: unknown[]) => void) & { q?: IArguments[] };
  }
}
