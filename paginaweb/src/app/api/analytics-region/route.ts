const consentCountries = new Set('AT BE BG HR CY CZ DK EE FI FR DE GR HU IS IE IT LV LI LT LU MT NL NO PL PT RO SK SI ES SE CH GB'.split(' '));
const allowedOrigins = new Set(['https://matearteuruguay.com', 'https://personalizador.matearteuruguay.com', 'http://localhost:5173', 'http://127.0.0.1:5173']);
const headersFor = (origin: string | null) => ({
  'Cache-Control': 'no-store',
  ...(origin && allowedOrigins.has(origin) ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : {}),
});
export async function GET(request: Request) {
  const country = request.headers.get('x-vercel-ip-country')?.toUpperCase() || '';
  return Response.json({ required: !country || consentCountries.has(country) }, { headers: headersFor(request.headers.get('origin')) });
}
