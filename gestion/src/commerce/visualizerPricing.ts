import { supabase } from './supabase';

export type PricingRuleDefinition = {
  rule_key: string;
  rule_type: 'family' | 'texture' | 'metal' | 'size' | 'customization' | 'commission';
  label: string;
  value_kind: 'uyu' | 'percent';
  family_id: string | null;
  texture_id: string | null;
  color_id?: string | null;
  metal_id?: string | null;
  size_id?: string | null;
  customization_id: string | null;
  required: boolean;
  active: boolean;
  sort_order: number;
};

export type PricingDefinitionGroup = {
  id: string;
  title: string;
  description: string;
  category: 'modelos' | 'materiales' | 'personalizacion' | 'pago' | 'otros';
  definitions: PricingRuleDefinition[];
};

const families = [
  { id: 'camionero', title: 'Camionero' },
  { id: 'imperial', title: 'Imperial' },
  { id: 'torpedo', title: 'Torpedo' },
  { id: 'criollo', title: 'Criollo' },
];
const techniques = [
  { id: 'laser', title: 'Grabado láser' },
  { id: 'bronze-applique', title: 'Aplique de bronce' },
  { id: 'alpaca-applique', title: 'Aplique de alpaca' },
];

export function groupVisualizerPricingDefinitions(definitions: PricingRuleDefinition[]): PricingDefinitionGroup[] {
  let remaining = [...definitions].sort((a, b) => a.sort_order - b.sort_order || a.rule_key.localeCompare(b.rule_key));
  const groups: PricingDefinitionGroup[] = [];
  const take = (predicate: (definition: PricingRuleDefinition) => boolean) => {
    const matching = remaining.filter(predicate);
    remaining = remaining.filter((definition) => !predicate(definition));
    return matching;
  };
  const add = (id: string, title: string, description: string, category: PricingDefinitionGroup['category'], rules: PricingRuleDefinition[]) => {
    if (rules.length) groups.push({ id, title, description, category, definitions: rules });
  };

  for (const family of families) {
    add(family.id, family.title, 'Precio base y adicionales propios de este modelo.', 'modelos', take((definition) => definition.family_id === family.id));
  }
  for (const [code, title] of Object.entries({ "tipo-cuero": "Cueros del armado", "tipo-virola": "Virolas del armado", pie: "Pies", posamate: "Posamate", interior: "Interiores", tamano: "Tamaños", "diseno-fleje": "Diseños del fleje" })) {
    add(`assembly-${code}`, title, "Adicional por pieza del mate personalizado. Cero significa incluido en la base.", 'materiales', take(definition => definition.rule_key.startsWith(`assembly:${code}:`)));
  }
  for (const familyId of [...new Set(remaining.map((definition) => definition.family_id).filter((id): id is string => Boolean(id)))]) {
    add(`modelo-${familyId}`, familyId, 'Reglas de este modelo.', 'modelos', take((definition) => definition.family_id === familyId));
  }
  add('cueros', 'Cueros compartidos', 'Adicionales que pueden aplicarse a más de un modelo.', 'materiales', take((definition) => definition.rule_key.startsWith('leather:')));
  add('metales', 'Metales compartidos', 'Terminaciones disponibles en distintos modelos.', 'materiales', take((definition) => definition.rule_type === 'metal'));
  for (const technique of techniques) {
    add(technique.id, technique.title, 'Texto e imagen para mates, materas y bombillas; fleje cuando corresponda.', 'personalizacion', take((definition) => definition.customization_id?.startsWith(`${technique.id}:`) ?? false));
  }
  add('otras-personalizaciones', 'Otras personalizaciones', 'Opciones de personalización del Visualizador.', 'personalizacion', take((definition) => definition.rule_type === 'customization'));
  add('pago', 'Medio de pago', 'Comisión aplicada durante el checkout.', 'pago', take((definition) => definition.rule_type === 'commission'));
  add('otras-reglas', 'Otras reglas', 'Parámetros activos que no pertenecen a los grupos anteriores.', 'otros', remaining);
  return groups;
}

export type PricingVersion = {
  id: string;
  version: number;
  updatedAt: string;
  publishedAt: string | null;
  values: Record<string, number>;
};

export type VisualizerPricingState = {
  definitions: PricingRuleDefinition[];
  draft: PricingVersion;
  published: PricingVersion;
};

function parseVersion(value: unknown): PricingVersion {
  if (!value || typeof value !== 'object') throw new Error('La versión de precios no está disponible.');
  const record = value as Record<string, unknown>;
  if (typeof record.id !== 'string' || typeof record.updatedAt !== 'string' || !record.values || typeof record.values !== 'object') {
    throw new Error('La versión de precios tiene un formato inválido.');
  }
  return {
    id: record.id,
    version: Number(record.version),
    updatedAt: record.updatedAt,
    publishedAt: typeof record.publishedAt === 'string' ? record.publishedAt : null,
    values: Object.fromEntries(Object.entries(record.values).map(([key, value]) => [key, Number(value)])),
  };
}

export function parsePricingState(value: unknown): VisualizerPricingState {
  if (!value || typeof value !== 'object') throw new Error('La configuración del Visualizador no está disponible.');
  const record = value as Record<string, unknown>;
  if (!Array.isArray(record.definitions)) throw new Error('No se encontraron las reglas de precios del Visualizador.');
  return {
    definitions: (record.definitions as PricingRuleDefinition[]).filter((definition) => definition.active !== false && !definition.rule_key.startsWith('assembly:color:')),
    draft: parseVersion(record.draft),
    published: parseVersion(record.published),
  };
}

export function editablePricingValues(state: VisualizerPricingState): Record<string, string> {
  return Object.fromEntries(state.definitions.map((definition) => [definition.rule_key, state.draft.values[definition.rule_key]?.toString() ?? '']));
}

export function numericPricingValues(values: Record<string, string>): Record<string, number | null> {
  return Object.fromEntries(Object.entries(values).map(([key, value]) => {
    const normalized = value.trim().replace(',', '.');
    return [key, normalized === '' ? null : Number(normalized)];
  }));
}

export function pricingIssues(definitions: PricingRuleDefinition[], values: Record<string, string>, requireComplete: boolean) {
  const parsed = numericPricingValues(values);
  return definitions.flatMap((definition) => {
    const value = parsed[definition.rule_key];
    if (requireComplete && definition.required && value == null) return [`Falta ${definition.label}`];
    if (value != null && (!Number.isFinite(value) || value < 0)) return [`${definition.label} tiene un valor inválido`];
    if (value != null && definition.value_kind === 'percent' && value > 100) return [`${definition.label} no puede superar 100%`];
    return [];
  });
}

function pricingError(reason: unknown): Error {
  const message = reason && typeof reason === 'object' && 'message' in reason ? String(reason.message) : 'No se pudo guardar la configuración.';
  if (/42501|not authorized|permission denied/i.test(message)) return new Error('Tu cuenta no tiene permiso para administrar los precios del Visualizador.');
  if (/40001|another session|concurrent/i.test(message)) return new Error('El borrador cambió en otra sesión. Recargá antes de continuar.');
  return new Error(message);
}

export async function loadVisualizerPricing(): Promise<VisualizerPricingState> {
  const { data, error } = await supabase.rpc('get_pricing_admin_state');
  if (error) throw pricingError(error);
  return parsePricingState(data);
}

export async function saveVisualizerPricingDraft(state: VisualizerPricingState, values: Record<string, number | null>) {
  const { data, error } = await supabase.rpc('save_pricing_draft', {
    p_version_id: state.draft.id,
    p_expected_updated_at: state.draft.updatedAt,
    p_values: values,
  });
  if (error) throw pricingError(error);
  return parsePricingState(data);
}

export async function publishVisualizerPricingDraft(state: VisualizerPricingState) {
  const { data, error } = await supabase.rpc('publish_pricing_draft', {
    p_version_id: state.draft.id,
    p_expected_updated_at: state.draft.updatedAt,
  });
  if (error) throw pricingError(error);
  return parsePricingState(data);
}
