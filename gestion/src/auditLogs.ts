export type AuditUser = { id: string; name: string; accessId: string | null };
export type AuditContext = { canViewLogs: boolean; activatedAt?: string; users?: AuditUser[] };
// Presentation fallback while the migration is pending. This never grants data
// access: the list/detail RPCs continue to enforce the private server allowlist.
export function auditAvailability(userId: string | undefined, result: { data: AuditContext | null; error: { code?: string } | null }) {
 const knownReader = ['deeec8ea-ace6-4f0a-a578-17751a83f707', '5afbc94d-aecf-44e8-b12e-e136f49abb62'].includes(userId || '');
 return {
   canViewLogs: !result.error && result.data?.canViewLogs === true,
   logsPendingActivation: knownReader && ['PGRST202', '42883'].includes(result.error?.code || ''),
 };
}
export type AuditGroup = { group_id: string; occurred_at: string; actor_name: string; source: string; attention: boolean; event_count: number; reference: string; operations: string[] };
export type AuditEvent = { id: string; occurred_at: string; actor_name: string; source: string; entity_type: string; reference: string; operation: string; before_values: Record<string, unknown>; after_values: Record<string, unknown>; changed_fields: string[]; monetary: boolean; currency: string; value_unit?: string };
export const auditActions: Record<string, string> = { INSERT: 'Creación', UPDATE: 'Modificación', DELETE: 'Eliminación', LOGIN: 'Inicio de sesión' };
export const auditTime = (value: string) => new Intl.DateTimeFormat('es-UY', { timeZone: 'America/Montevideo', dateStyle: 'short', timeStyle: 'medium', hourCycle: 'h23' }).format(new Date(value));
export const auditFields: Record<string, string> = {
 unit_price_minor: 'Precio unitario', total_minor: 'Importe registrado', items_subtotal_minor: 'Subtotal registrado', deposit_minor: 'Seña', amount_minor: 'Importe del cobro o gasto',
 price_minor: 'Precio publicado', base_price_minor: 'Precio base', quantity: 'Cantidad', discount_minor: 'Descuento', discount_percent: 'Descuento (%)',
 unit_price_arg: 'Precio unitario en ARS', total_arg: 'Total en ARS', wholesale_price_arg: 'Precio mayorista en ARS',
 name: 'Nombre', title: 'Artículo', sku: 'SKU', value: 'Valor', status: 'Estado', production_status: 'Producción', payment_method: 'Medio de pago',
 paid_on: 'Fecha del cobro', sold_on: 'Fecha de venta', customer_name: 'Cliente', full_name: 'Nombre', display_name: 'Usuario', active: 'Activo',
 allowed_paths: 'Permisos', access_user_id: 'Perfil de acceso', can_manage_pricing: 'Puede administrar precios', published: 'Publicado',
 reference_code: 'Referencia', shipping_minor: 'Envío', payment_fee_minor: 'Comisión', currency: 'Moneda', no_cost: 'Sin costo',
 selected_emails: 'Destinatarios seleccionados', subject: 'Asunto', body: 'Contenido', filters: 'Filtros', enabled: 'Habilitado', discount_code: 'Código de descuento',
 channel: 'Canal', phone: 'Teléfono', email: 'Correo', notes: 'Notas', rate_to_uyu: 'Cotización en UYU', exchange_rate: 'Cotización',
 order_id: 'Pedido', sale_id: 'Venta', version_id: 'Versión', rule_key: 'Regla', version: 'Versión', note: 'Nota',
 shipping_method: 'Modalidad de entrega', shipping_carrier: 'Transportista', tracking_code: 'Seguimiento',
 before: 'Antes', after: 'Después', recipient_count: 'Destinatarios', headline: 'Título', description: 'Descripción',
 category: 'Categoría', category_code: 'Categoría', supplier: 'Proveedor', purchased_on: 'Fecha de compra', due_day: 'Día de vencimiento',
 valid_from: 'Vigente desde', valid_until: 'Vigente hasta', discount_type: 'Tipo de descuento',
 catalog_price_adjustment_percent: 'Ajuste de catálogo (%)', wholesale_mate_discount_percent: 'Descuento mayorista (%)',
 uruguay_transfer_discount_enabled: 'Descuento por transferencia', catalog_price_adjustment_enabled: 'Ajuste de catálogo',
};
export function auditFieldLabel(key: string, event: AuditEvent): string {
 if (event.entity_type === 'Pedido' && ['total_minor', 'items_subtotal_minor'].includes(key)) return key === 'total_minor' ? 'Importe del pedido o cobro inicial' : 'Subtotal del pedido o cobro inicial';
 if (event.entity_type === 'Artículo del pedido' && key === 'total_minor') return 'Valor del artículo';
 return auditFields[key] || key.replaceAll('_', ' ');
}
function numericUnit(key: string, event: AuditEvent): { divisor: number; currency?: string; percent?: boolean } {
 if (key.endsWith('_minor')) return { divisor: 100, currency: event.currency };
 if (['unit_price_arg', 'total_arg', 'wholesale_price_arg'].includes(key)) return { divisor: 1, currency: 'ARS' };
 if (key.endsWith('_percent') || (key === 'value' && event.value_unit === 'percent')) return { divisor: 1, percent: true };
 if (key === 'value' && event.value_unit) return { divisor: 1, currency: event.value_unit };
 return { divisor: 1 };
}
export function auditValue(value: unknown, key: string, event: AuditEvent): string {
 if (value == null) return 'Sin valor';
 if (typeof value === 'boolean') return value ? 'Sí' : 'No';
 if (typeof value === 'number') {
   const unit = numericUnit(key, event);
   const number = new Intl.NumberFormat('es-UY', { maximumFractionDigits: 4 }).format(value / unit.divisor);
   return `${unit.currency ? unit.currency + ' ' : ''}${number}${unit.percent ? '%' : ''}`;
 }
 if (typeof value === 'object') return JSON.stringify(value, null, 2);
 return String(value);
}
export function auditDifference(event: AuditEvent, key: string): string | null {
 const before = event.before_values[key], after = event.after_values[key];
 if (typeof before !== 'number' || typeof after !== 'number') return null;
 const difference = after - before;
 return `${difference > 0 ? '+' : ''}${auditValue(difference, key, event)}`;
}
// Uruguay has UTC-03 throughout the supported business dates. End is exclusive.
export function auditDateBoundary(date: string, end = false): string | null {
 if (!date) return null;
 const value = new Date(`${date}T00:00:00-03:00`);
 if (end) value.setUTCDate(value.getUTCDate() + 1);
 return value.toISOString();
}
