const name = 'ma_analytics_consent';

export async function analyticsPermission(): Promise<'allowed' | 'denied'> {
  const value = document.cookie.split('; ').find((part) => part.startsWith(`${name}=`))?.split('=')[1];
  if (value === 'denied') return 'denied';
  return 'allowed';
}
