export type InternationalShippingZone =
  | 'argentina'
  | 'suramerica'
  | 'estados_unidos'
  | 'resto_america'
  | 'espana'
  | 'resto_europa'
  | 'resto_mundo';

export interface InternationalShippingRow {
  id?: number;
  row_order: number;
  weight_label: string;
  weight_min_g: number;
  weight_max_g: number;
  argentina: number;
  suramerica: number;
  estados_unidos: number;
  resto_america: number;
  espana: number;
  resto_europa: number;
  resto_mundo: number;
  updated_at?: string;
}

export interface InternationalZoneDef {
  key: InternationalShippingZone;
  label: string;
  headerLines: string[];
  description: string;
}

export const INTERNATIONAL_SHIPPING_ZONES: InternationalZoneDef[] = [
  {
    key: 'argentina',
    label: 'ARGENTINA',
    headerLines: ['ARGENTINA'],
    description: 'Argentina',
  },
  {
    key: 'suramerica',
    label: 'BOLIVIA - BRASIL - CHILE - PARAGUAY - VENEZUELA',
    headerLines: ['BOLIVIA - BRASIL -', 'CHILE - PARAGUAY', '- VENEZUELA'],
    description: 'Bolivia, Brasil, Chile, Paraguay y Venezuela',
  },
  {
    key: 'estados_unidos',
    label: 'ESTADOS UNIDOS',
    headerLines: ['ESTADOS', 'UNIDOS'],
    description: 'Estados Unidos (EE. UU. / USA)',
  },
  {
    key: 'resto_america',
    label: 'RESTO DE AMÉRICA',
    headerLines: ['RESTO DE', 'AMÉRICA'],
    description: 'Canadá, México, Colombia, Perú, Ecuador, Centroamérica y Caribe',
  },
  {
    key: 'espana',
    label: 'ESPAÑA',
    headerLines: ['ESPAÑA'],
    description: 'España',
  },
  {
    key: 'resto_europa',
    label: 'RESTO DE EUROPA',
    headerLines: ['RESTO DE', 'EUROPA'],
    description: 'Reino Unido, Francia, Italia, Alemania, Portugal, etc.',
  },
  {
    key: 'resto_mundo',
    label: 'RESTO DEL MUNDO',
    headerLines: ['RESTO DEL', 'MUNDO'],
    description: 'Asia, Oceanía, África y demás países',
  },
];

export const DEFAULT_INTERNATIONAL_SHIPPING_RATES: InternationalShippingRow[] = [];

const SURAMERICA_COUNTRIES = new Set([
  'bolivia', 'brasil', 'brazil', 'chile', 'paraguay', 'venezuela',
  'bo', 'br', 'cl', 'py', 've',
]);

const RESTO_AMERICA_COUNTRIES = new Set([
  'canada', 'canadá', 'ca',
  'mexico', 'méxico', 'mx',
  'colombia', 'co',
  'peru', 'perú', 'pe',
  'ecuador', 'ec',
  'uruguay', 'uy',
  'panama', 'panamá', 'pa',
  'costa rica', 'cr',
  'guatemala', 'gt',
  'honduras', 'hn',
  'el salvador', 'sv',
  'nicaragua', 'ni',
  'cuba', 'cu',
  'republica dominicana', 'república dominicana', 'do',
  'puerto rico', 'pr',
  'jamaica', 'jm',
  'trinidad y tobago', 'trinidad and tobago', 'tt',
  'guyana', 'gy',
  'surinam', 'suriname', 'sr',
  'belice', 'belize', 'bz',
  'haiti', 'haití', 'ht',
]);

const RESTO_EUROPA_COUNTRIES = new Set([
  'alemania', 'germany', 'de',
  'francia', 'france', 'fr',
  'italia', 'italy', 'it',
  'reino unido', 'united kingdom', 'great britain', 'uk', 'gb',
  'portugal', 'pt',
  'paises bajos', 'países bajos', 'netherlands', 'holanda', 'nl',
  'suiza', 'switzerland', 'ch',
  'austria', 'at',
  'belgica', 'bélgica', 'belgium', 'be',
  'suecia', 'sweden', 'se',
  'noruega', 'norway', 'no',
  'dinamarca', 'denmark', 'dk',
  'finlandia', 'finland', 'fi',
  'polonia', 'poland', 'pl',
  'irlanda', 'ireland', 'ie',
  'grecia', 'greece', 'gr',
  'republica checa', 'república checa', 'czechia', 'cz',
  'rumania', 'rumanía', 'romania', 'ro',
  'hungria', 'hungría', 'hungary', 'hu',
  'croacia', 'croatia', 'hr',
  'eslovaquia', 'slovakia', 'sk',
  'bulgaria', 'bg',
  'serbia', 'rs',
  'ucrania', 'ukraine', 'ua',
  'rusia', 'russia', 'ru',
  'turquia', 'turquía', 'turkey', 'tr',
]);

export function normalizeCountryString(country: string): string {
  return country
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function resolveCountryZone(countryInput?: string | null): InternationalShippingZone {
  if (!countryInput) return 'resto_mundo';
  const norm = normalizeCountryString(countryInput);

  if (norm === 'argentina' || norm === 'ar') {
    return 'argentina';
  }

  if (SURAMERICA_COUNTRIES.has(norm)) {
    return 'suramerica';
  }

  if (
    norm === 'estados unidos' ||
    norm === 'estados unidos de america' ||
    norm === 'ee. uu.' ||
    norm === 'ee uu' ||
    norm === 'eeuu' ||
    norm === 'united states' ||
    norm === 'united states of america' ||
    norm === 'usa' ||
    norm === 'us'
  ) {
    return 'estados_unidos';
  }

  if (norm === 'espana' || norm === 'spain' || norm === 'es') {
    return 'espana';
  }

  if (RESTO_AMERICA_COUNTRIES.has(norm)) {
    return 'resto_america';
  }

  if (RESTO_EUROPA_COUNTRIES.has(norm)) {
    return 'resto_europa';
  }

  return 'resto_mundo';
}

export function getInternationalShippingRate(
  weightGrams: number,
  country: string,
  rates: InternationalShippingRow[] = DEFAULT_INTERNATIONAL_SHIPPING_RATES
): {
  rate: number;
  zone: InternationalShippingZone;
  rangeLabel: string;
  row: InternationalShippingRow;
} | null {
  if (!rates || rates.length === 0) return null;
  const sorted = [...rates].sort((a, b) => a.row_order - b.row_order);
  const zone = resolveCountryZone(country);

  // If weight is less than or equal to 500g (minimum range), use the first row
  let targetRow: InternationalShippingRow;
  if (weightGrams <= sorted[0].weight_max_g) {
    targetRow = sorted[0];
  } else if (weightGrams > sorted[sorted.length - 1].weight_min_g) {
    targetRow = sorted[sorted.length - 1];
  } else {
    const match = sorted.find(
      (r) => weightGrams > r.weight_min_g && weightGrams <= r.weight_max_g
    );
    targetRow = match || sorted[sorted.length - 1];
  }

  const rate = Number(targetRow[zone]) || 0;
  return {
    rate,
    zone,
    rangeLabel: targetRow.weight_label,
    row: targetRow,
  };
}

export function formatUyu(amount: number): string {
  return new Intl.NumberFormat('es-UY', {
    style: 'currency',
    currency: 'UYU',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
