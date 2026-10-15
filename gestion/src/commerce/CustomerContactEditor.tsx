import { useState, type FormEvent } from 'react';
import type { Customer } from '../data';
import { supabase } from './supabase';

export function CustomerContactEditor({ customer, orderIds, onSaved }: { customer: Customer; orderIds: string[]; onSaved: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const contact = Object.fromEntries(new FormData(event.currentTarget));
    setBusy(true); setError('');
    try {
      const { data, error } = await supabase.rpc('gestion_update_customer_contact', { order_ids: orderIds, contact });
      if (error) throw error;
      if (data !== orderIds.length) throw new Error('No se confirmaron todos los cambios. Actualizá la ficha.');
      onSaved();
    } catch (error) { setError(error && typeof error === 'object' && 'message' in error ? String(error.message) : 'No se pudo guardar el contacto.'); }
    finally { setBusy(false); }
  }
  return <form onSubmit={save}>
    <div className="data-note">Actualiza el contacto de sus pedidos en ambos paneles. La cuenta de acceso y las direcciones de entrega se conservan.</div>
    <div className="form-grid">
      <label>Nombre<input name="name" required minLength={2} maxLength={200} defaultValue={customer.name} /></label>
      <label>Correo<input name="email" type="email" required maxLength={320} defaultValue={customer.email} /></label>
      <label>Teléfono<input name="phone" maxLength={80} defaultValue={customer.phone} /></label>
    </div>
    {error && <div role="alert" className="error">{error}</div>}
    <div className="form-actions"><button className="primary" disabled={busy}>{busy ? 'Guardando…' : 'Guardar contacto'}</button></div>
  </form>;
}
