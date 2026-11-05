import { describe, expect, it } from 'vitest';
import { auditAvailability, auditDateBoundary, auditDifference, auditFieldLabel, auditValue, type AuditEvent } from './auditLogs';
import { canAccess, setPageAccess } from './access';
import { seed } from './data';
const event: AuditEvent = { id: '1', occurred_at: '2026-11-05T17:29:00Z', actor_name: 'Florencia Costa', source: 'gestion', entity_type: 'Artículo del pedido', reference: '#R004', operation: 'UPDATE', before_values: { unit_price_minor: 405000 }, after_values: { unit_price_minor: 399000 }, changed_fields: ['unit_price_minor'], monetary: true, currency: 'UYU' };
describe('Logs', () => {
 it('shows only the pending screen for known readers when the backend is absent', () => {
   const reader = 'deeec8ea-ace6-4f0a-a578-17751a83f707';
   expect(auditAvailability(reader, { data: null, error: { code: 'PGRST202' } })).toEqual({ canViewLogs: false, logsPendingActivation: true });
   expect(auditAvailability('another-admin', { data: null, error: { code: 'PGRST202' } }).logsPendingActivation).toBe(false);
   expect(auditAvailability(reader, { data: { canViewLogs: false }, error: null }).logsPendingActivation).toBe(false);
   expect(auditAvailability(reader, { data: null, error: { code: '42501' } }).logsPendingActivation).toBe(false);
 });
 it('displays actual currency amounts and a 60 peso adjustment', () => {
   expect(auditValue(405000, 'unit_price_minor', event)).toBe('UYU 4.050');
   expect(auditDifference(event, 'unit_price_minor')).toBe('UYU -60');
   expect(auditFieldLabel('total_minor', event)).toBe('Valor del artículo');
   expect(auditFieldLabel('total_minor', { ...event, entity_type: 'Pedido' })).toContain('cobro inicial');
   expect(auditValue(15, 'value', { ...event, value_unit: 'percent' })).toBe('15%');
 });
 it('uses inclusive Uruguay calendar dates with an exclusive end', () => {
   expect(auditDateBoundary('2026-11-05')).toBe('2026-11-05T03:00:00.000Z');
   expect(auditDateBoundary('2026-11-05', true)).toBe('2026-11-06T03:00:00.000Z');
 });
 it('requires the server capability even for directors and cannot grant Logs in the permissions editor', () => {
   const state = seed();
   expect(canAccess(state, '/administracion/logs')).toBe(false);
   expect(canAccess({ ...state, canViewLogs: true }, '/administracion/logs')).toBe(true);
   const staff = { ...state, activeUserId: 't2', canViewLogs: false };
   expect(canAccess(setPageAccess(staff, 't2', '/administracion/logs', true), '/administracion/logs')).toBe(false);
 });
});
