'use client';

import { useState } from 'react';
import { PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js';
import { useTranslations } from 'next-intl';

interface PayPalCheckoutSectionProps {
  orderId: string;
  amountUsd: string;
  onSuccess: (captureId: string) => void;
  onError: (message: string) => void;
}

export function PayPalCheckoutSection({ orderId, amountUsd, onSuccess, onError }: PayPalCheckoutSectionProps) {
  const t = useTranslations('checkout');
  const [error, setError] = useState<string | null>(null);

  const handleError = (msg: string) => {
    setError(msg);
    onError(msg);
  };

  return (
    <div className="w-full">
      {error && (
        <div className="mb-4 rounded-lg bg-red-900/50 p-4 text-sm text-red-100">
          {error}
        </div>
      )}
      
      <div className="w-full bg-[var(--paper)] rounded-xl p-4">
        <PayPalScriptProvider
          options={{
            clientId: process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || '',
            currency: 'USD',
            intent: 'capture'
          }}
        >
          <PayPalButtons
            style={{ layout: 'vertical', color: 'gold', shape: 'rect', label: 'pay', height: 48 }}
            createOrder={async () => {
              try {
                const res = await fetch('/api/paypal/create-order', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ orderId }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Failed to create order');
                return data.id;
              } catch (err) {
                handleError(t('paypalError'));
                throw err;
              }
            }}
            onApprove={async (data, actions) => {
              try {
                const res = await fetch('/api/paypal/capture-order', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ orderID: data.orderID }),
                });
                const captureResult = await res.json();
                
                if (captureResult.status === 'COMPLETED') {
                  onSuccess(captureResult.id);
                } else if (captureResult.status === 'DECLINED' && captureResult.recoverable) {
                  actions.restart();
                } else {
                  handleError(t('paypalDeclined'));
                }
              } catch (err) {
                handleError(t('paypalError'));
              }
            }}
            onCancel={() => {
              handleError(t('paypalCancelled'));
            }}
            onError={(err) => {
              console.error('PayPal Checkout onError', err);
              handleError(t('paypalError'));
            }}
          />
        </PayPalScriptProvider>
      </div>
    </div>
  );
}
