import { useState } from 'react';

interface CheckoutStepProps {
  subtotalUYU: number;
  pricingReady: boolean;
  onBack: () => void;
  onContinue: () => void | Promise<void>;
}

export function CheckoutStep({ subtotalUYU, pricingReady, onBack, onContinue }: CheckoutStepProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const continueToStore = async () => {
    if (!pricingReady || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      await onContinue();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo abrir el carrito.');
      setSubmitting(false);
    }
  };

  return (
    <main id="main-content" className="transaction-checkout">
      <section
        className="transaction-checkout__card"
        aria-labelledby="checkout-title"
        aria-describedby="checkout-description"
        aria-busy={submitting}
      >
        <h1 id="checkout-title">Continuá en el carrito</h1>
        <div data-copy className="transaction-checkout__price">
          {pricingReady ? `$ ${subtotalUYU.toLocaleString('es-UY')} UYU` : 'Precio pendiente'}
        </div>
        <div data-copy id="checkout-description" className="transaction-checkout__copy">
          En el carrito podés elegir la entrega, sumar otros productos y pagar.
        </div>

        {!pricingReady && (
          <div data-copy role="alert" className="transaction-checkout__error">
            Falta completar el precio de este diseño. Volvé al resumen para revisarlo.
          </div>
        )}
        {error && <div data-copy role="alert" className="transaction-checkout__error">{error}</div>}

        <div className="transaction-checkout__actions">
          <button type="button" className="brand-button" disabled={!pricingReady || submitting} onClick={() => void continueToStore()}>
            {submitting ? 'Abriendo carrito…' : 'Ir al carrito'}
          </button>
          <button type="button" className="brand-button brand-button--secondary" disabled={submitting} onClick={onBack}>Volver al resumen</button>
        </div>
        {submitting && <strong data-inline className="transaction-checkout__status" role="status" aria-live="polite">Guardando el diseño y conectando con la tienda.</strong>}
      </section>
    </main>
  );
}
