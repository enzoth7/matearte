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

export const DEFAULT_INTERNATIONAL_SHIPPING_RATES: InternationalShippingRow[] = [
  { row_order: 1,  weight_label: '250 - 500', weight_min_g: 250,   weight_max_g: 500,   argentina: 2760.00, suramerica: 2672.50, estados_unidos: 2938.50, resto_america: 3029.50, espana: 3120.50, resto_europa: 3208.00, resto_mundo: 3299.00 },
  { row_order: 2,  weight_label: '500 - 1',   weight_min_g: 500,   weight_max_g: 1000,  argentina: 2938.50, suramerica: 2882.50, estados_unidos: 3120.50, resto_america: 3208.00, espana: 3299.00, resto_europa: 3386.50, resto_mundo: 3519.50 },
  { row_order: 3,  weight_label: '1 - 1,5',   weight_min_g: 1000,  weight_max_g: 1500,  argentina: 3029.50, suramerica: 2991.00, estados_unidos: 3386.50, resto_america: 3481.00, espana: 3568.50, resto_europa: 3656.00, resto_mundo: 3733.00 },
  { row_order: 4,  weight_label: '1,5 - 2',   weight_min_g: 1500,  weight_max_g: 2000,  argentina: 3120.50, suramerica: 3201.00, estados_unidos: 3656.00, resto_america: 3656.00, espana: 3747.00, resto_europa: 3841.50, resto_mundo: 3946.50 },
  { row_order: 5,  weight_label: '2 - 2,5',   weight_min_g: 2000,  weight_max_g: 2500,  argentina: 3299.00, suramerica: 3386.50, estados_unidos: 3929.00, resto_america: 3929.00, espana: 4016.50, resto_europa: 4107.50, resto_mundo: 4195.00 },
  { row_order: 6,  weight_label: '2,5 - 3',   weight_min_g: 2500,  weight_max_g: 3000,  argentina: 3386.50, suramerica: 3568.50, estados_unidos: 4289.50, resto_america: 4107.50, espana: 4195.00, resto_europa: 4289.50, resto_mundo: 4377.00 },
  { row_order: 7,  weight_label: '3 - 3,5',   weight_min_g: 3000,  weight_max_g: 3500,  argentina: 3568.50, suramerica: 3967.50, estados_unidos: 4555.50, resto_america: 4289.50, espana: 4377.00, resto_europa: 4468.00, resto_mundo: 4555.50 },
  { row_order: 8,  weight_label: '3,5 - 4',   weight_min_g: 3500,  weight_max_g: 4000,  argentina: 3747.00, suramerica: 4076.00, estados_unidos: 4825.00, resto_america: 4555.50, espana: 4646.50, resto_europa: 4734.00, resto_mundo: 4825.00 },
  { row_order: 9,  weight_label: '4 - 4,5',   weight_min_g: 4000,  weight_max_g: 4500,  argentina: 3929.00, suramerica: 4233.50, estados_unidos: 5094.50, resto_america: 4734.00, espana: 4825.00, resto_europa: 4916.00, resto_mundo: 5003.50 },
  { row_order: 10, weight_label: '4,5 - 5',   weight_min_g: 4500,  weight_max_g: 5000,  argentina: 4016.50, suramerica: 4342.00, estados_unidos: 5364.00, resto_america: 4916.00, espana: 5003.50, resto_europa: 5094.50, resto_mundo: 5185.50 },
  { row_order: 11, weight_label: '5 - 6',     weight_min_g: 5000,  weight_max_g: 6000,  argentina: 4195.00, suramerica: 4604.50, estados_unidos: 5903.00, resto_america: 5455.00, espana: 5542.50, resto_europa: 5637.00, resto_mundo: 5724.50 },
  { row_order: 12, weight_label: '6 - 7',     weight_min_g: 6000,  weight_max_g: 7000,  argentina: 4468.00, suramerica: 4821.50, estados_unidos: 6445.50, resto_america: 5815.50, espana: 5903.00, resto_europa: 5990.50, resto_mundo: 6085.00 },
  { row_order: 13, weight_label: '7 - 8',     weight_min_g: 7000,  weight_max_g: 8000,  argentina: 4646.50, suramerica: 5031.50, estados_unidos: 6984.50, resto_america: 6351.00, espana: 6445.50, resto_europa: 6533.00, resto_mundo: 6624.00 },
  { row_order: 14, weight_label: '8 - 9',     weight_min_g: 8000,  weight_max_g: 9000,  argentina: 4825.00, suramerica: 5245.00, estados_unidos: 7520.00, resto_america: 6711.50, espana: 6799.00, resto_europa: 6890.00, resto_mundo: 6984.50 },
  { row_order: 15, weight_label: '9 - 10',    weight_min_g: 9000,  weight_max_g: 10000, argentina: 5094.50, suramerica: 5882.00, estados_unidos: 8059.00, resto_america: 7159.50, espana: 7250.50, resto_europa: 7338.00, resto_mundo: 7667.00 },
  { row_order: 16, weight_label: '10 - 11',   weight_min_g: 10000, weight_max_g: 11000, argentina: 5276.50, suramerica: 6092.00, estados_unidos: 8601.50, resto_america: 7520.00, espana: 7611.00, resto_europa: 7698.50, resto_mundo: 8192.00 },
  { row_order: 17, weight_label: '11 - 12',   weight_min_g: 11000, weight_max_g: 12000, argentina: 5455.00, suramerica: 6445.50, estados_unidos: 9137.00, resto_america: 8059.00, espana: 8146.50, resto_europa: 8241.00, resto_mundo: 8941.00 },
  { row_order: 18, weight_label: '12 - 13',   weight_min_g: 12000, weight_max_g: 13000, argentina: 5724.50, suramerica: 6624.00, estados_unidos: 9676.00, resto_america: 8419.50, espana: 8601.50, resto_europa: 8640.00, resto_mundo: 9469.50 },
  { row_order: 19, weight_label: '13 - 14',   weight_min_g: 13000, weight_max_g: 14000, argentina: 5815.50, suramerica: 6890.00, estados_unidos: 10215.00, resto_america: 8867.50, espana: 8958.50, resto_europa: 9000.50, resto_mundo: 9889.50 },
  { row_order: 20, weight_label: '14 - 15',   weight_min_g: 14000, weight_max_g: 15000, argentina: 5903.00, suramerica: 7250.50, estados_unidos: 10845.00, resto_america: 9315.50, espana: 9361.00, resto_europa: 9406.50, resto_mundo: 10320.00 },
  { row_order: 21, weight_label: '15 - 16',   weight_min_g: 15000, weight_max_g: 16000, argentina: 5990.50, suramerica: 7520.00, estados_unidos: 11384.00, resto_america: 9676.00, espana: 10036.50, resto_europa: 10082.00, resto_mundo: 11275.50 },
  { row_order: 22, weight_label: '16 - 17',   weight_min_g: 16000, weight_max_g: 17000, argentina: 6085.00, suramerica: 7793.00, estados_unidos: 11923.00, resto_america: 10127.50, espana: 10351.50, resto_europa: 10397.00, resto_mundo: 11804.00 },
  { row_order: 23, weight_label: '17 - 18',   weight_min_g: 17000, weight_max_g: 18000, argentina: 6263.50, suramerica: 8146.50, estados_unidos: 12458.50, resto_america: 10936.00, espana: 11111.00, resto_europa: 11023.50, resto_mundo: 12336.00 },
  { row_order: 24, weight_label: '18 - 19',   weight_min_g: 18000, weight_max_g: 19000, argentina: 6533.00, suramerica: 8507.00, estados_unidos: 13001.00, resto_america: 11111.00, espana: 11205.50, resto_europa: 11293.00, resto_mundo: 12973.00 },
  { row_order: 25, weight_label: '19 - 20',   weight_min_g: 19000, weight_max_g: 20000, argentina: 6890.00, suramerica: 8689.00, estados_unidos: 13540.00, resto_america: 11352.50, espana: 11636.00, resto_europa: 11328.00, resto_mundo: 13718.50 },
];

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
