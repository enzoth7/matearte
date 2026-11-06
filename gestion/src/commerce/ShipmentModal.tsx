import { useEffect, useId, useRef, useState } from 'react';
import { X } from '@phosphor-icons/react';
import { CARRIER_OPTIONS, resolveCarrierSelection } from './shipmentOptions';

export type ShipmentDetails = {
  deliveryMethod: 'pickup' | 'shipping';
  shippingCarrier: string;
  trackingCode: string;
};

type ShipmentModalProps = {
  reference: string;
  customer: string;
  currentDelivery: string;
  destination?: string;
  status: string;
  initialDeliveryMethod: ShipmentDetails['deliveryMethod'] | '';
  initialCarrier?: string | null;
  initialTrackingCode?: string | null;
  preferCustomCarrier?: boolean;
  manualSale: boolean;
  hasEmail: boolean;
  wholesaleBankTransfer?: boolean;
  busy: boolean;
  error: string;
  onCancel: () => void;
  onSubmit: (details: ShipmentDetails) => void | Promise<void>;
};

export function ShipmentModal({ reference, customer, currentDelivery, destination, status, initialDeliveryMethod,
  initialCarrier, initialTrackingCode, preferCustomCarrier = false, manualSale, hasEmail,
  wholesaleBankTransfer = false, busy, error, onCancel, onSubmit }: ShipmentModalProps) {
  const titleId = useId();
  const descriptionId = useId();
  const methodId = useId();
  const carrierId = useId();
  const customCarrierId = useId();
  const trackingId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const resolved = resolveCarrierSelection(initialCarrier);
  const [deliveryMethod, setDeliveryMethod] = useState(initialDeliveryMethod);
  const [selectedCarrier, setSelectedCarrier] = useState(preferCustomCarrier && !initialCarrier ? '__other__' : resolved.selectedCarrier);
  const [customCarrier, setCustomCarrier] = useState(resolved.customCarrier);
  const [trackingCode, setTrackingCode] = useState(initialTrackingCode || '');

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    dialogRef.current?.showModal();
    return () => previousFocus?.focus();
  }, []);

  const carrier = selectedCarrier === '__other__' ? customCarrier.trim() : selectedCarrier.trim();
  const help = !deliveryMethod ? 'Elegí si el pedido se envió o si el cliente lo retiró en el local.'
    : status === 'shipped' && deliveryMethod === 'shipping' ? 'Los cambios se verán en el detalle del pedido.'
    : wholesaleBankTransfer ? 'El cliente verá el estado dentro de la web.'
    : deliveryMethod === 'pickup' ? 'Se registrará la entrega en el local. No se enviará un correo de seguimiento.'
    : !hasEmail ? 'No hay un correo del cliente registrado. El estado se guardará sin aviso por correo.'
    : 'Se enviará un correo para avisar que el pedido fue despachado.';

  return <dialog ref={dialogRef} className="shipment-modal" aria-labelledby={titleId} aria-describedby={descriptionId}
    onCancel={event => { event.preventDefault(); if (!busy) onCancel(); }}
    onClick={event => { if (event.target === dialogRef.current && !busy) onCancel(); }}>
      <form onSubmit={event => { event.preventDefault(); if (deliveryMethod) void onSubmit({ deliveryMethod, shippingCarrier: carrier, trackingCode: trackingCode.trim() }); }}>
        <header className="shipment-modal__header">
          <div>
            <h2 id={titleId}>{status === 'shipped' ? 'Editar datos de envío' : 'Marcar como enviado'}</h2>
            <div id={descriptionId}>Al confirmar, los artículos quedarán terminados en producción.</div>
          </div>
          <button type="button" className="shipment-modal__close" aria-label="Cerrar" disabled={busy} onClick={onCancel}><X size={22} aria-hidden="true" /></button>
        </header>
        <section className="order-delivery-summary order-delivery-summary--compact" aria-label="Datos de entrega">
          <div className="order-delivery-summary__heading"><div><small>Pedido</small><strong>{reference}</strong></div></div>
          <div className="order-delivery-grid">
            <div><small>Cliente</small><strong>{customer}</strong></div>
            <div><small>Entrega actual</small><strong>{currentDelivery}</strong></div>
            {deliveryMethod === 'shipping' && destination && <div><small>Enviar a</small><strong>{destination}</strong></div>}
          </div>
        </section>
        <label htmlFor={methodId}>Modalidad de entrega</label>
        <select id={methodId} value={deliveryMethod} required autoFocus onChange={event => setDeliveryMethod(event.target.value as ShipmentDetails['deliveryMethod'])}>
          <option value="" disabled>Seleccioná una modalidad</option>
          <option value="shipping">Envío</option>
          <option value="pickup">Retiro en el local</option>
        </select>
        {deliveryMethod === 'shipping' && <>
          <label htmlFor={carrierId}>{manualSale ? 'Empresa de envío, opcional' : 'Empresa de envío'}</label>
          <select id={carrierId} required={!manualSale} value={selectedCarrier} onChange={event => setSelectedCarrier(event.target.value)}>
            <option value="" disabled={!manualSale}>{manualSale ? 'Sin empresa todavía' : 'Seleccioná una empresa'}</option>
            <optgroup label="Envíos nacionales (Uruguay)">
              {CARRIER_OPTIONS.filter(option => option.group === 'national').map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </optgroup>
            <optgroup label="Envíos internacionales">
              {CARRIER_OPTIONS.filter(option => option.group === 'international').map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </optgroup>
            <option value="__other__">Otra empresa (escribir nombre)…</option>
          </select>
          {selectedCarrier === '__other__' && <>
            <label htmlFor={customCarrierId}>Nombre de la empresa</label>
            <input id={customCarrierId} required minLength={2} maxLength={120} value={customCarrier} onChange={event => setCustomCarrier(event.target.value)} />
          </>}
          <label htmlFor={trackingId}>{manualSale ? 'Código de seguimiento, opcional' : 'Código de seguimiento'}</label>
          <input id={trackingId} required={!manualSale} minLength={3} maxLength={160} autoComplete="off" value={trackingCode} onChange={event => setTrackingCode(event.target.value)} />
        </>}
        <div className="field-help">{help}</div>
        {error && <div className="modal-error" role="alert">{error}</div>}
        <footer>
          <button type="button" className="secondary-button" disabled={busy} onClick={onCancel}>Cancelar</button>
          <button type="submit" disabled={busy}>{busy ? 'Guardando…' : deliveryMethod === 'pickup' ? 'Confirmar retiro' : status === 'shipped' ? 'Guardar cambios' : 'Confirmar envío'}</button>
        </footer>
      </form>
  </dialog>;
}
