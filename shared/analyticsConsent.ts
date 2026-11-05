const name = 'ma_analytics_consent';
const regionUrl = typeof location !== 'undefined' && ['localhost', '127.0.0.1'].includes(location.hostname)
  ? 'http://localhost:3000/api/analytics-region'
  : 'https://www.matearteuruguay.com/api/analytics-region';

export async function analyticsPermission(): Promise<'allowed' | 'required' | 'denied'> {
  const value = document.cookie.split('; ').find((part) => part.startsWith(`${name}=`))?.split('=')[1];
  if (value === 'granted') return 'allowed';
  if (value === 'denied') return 'denied';
  try {
    const response = await fetch(regionUrl, { cache: 'no-store' });
    if (!response.ok) return 'required';
    const data = await response.json() as { required?: boolean };
    return data.required === false ? 'allowed' : 'required';
  } catch { return 'required'; }
}

export function saveAnalyticsPermission(granted: boolean) {
  const domain = location.hostname === 'matearteuruguay.com' || location.hostname.endsWith('.matearteuruguay.com') ? '; Domain=.matearteuruguay.com' : '';
  document.cookie = `${name}=${granted ? 'granted' : 'denied'}; Path=/; Max-Age=15552000; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}${domain}`;
}
