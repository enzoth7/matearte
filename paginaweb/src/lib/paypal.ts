const PAYPAL_ENV = process.env.PAYPAL_ENV || 'sandbox';
const PAYPAL_API_BASE = PAYPAL_ENV === 'production' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';

let cachedToken: string | null = null;
let tokenExpiresAt: number = 0;

export async function getPayPalAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiresAt) {
    return cachedToken;
  }

  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET not set');
  }

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  
  const response = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
    cache: 'no-store',
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get PayPal access token: ${errorText}`);
  }

  const data = await response.json();
  
  cachedToken = data.access_token;
  // Safety margin of 60 seconds
  tokenExpiresAt = Date.now() + (data.expires_in - 60) * 1000;

  return data.access_token;
}

export async function createPayPalOrder(params: {
  referenceId: string;
  description: string;
  totalUsd: number;
  items: Array<{ name: string; quantity: number; unitPriceUsd: number }>;
}) {
  const token = await getPayPalAccessToken();

  const totalString = params.totalUsd.toFixed(2);
  const items = params.items.map(item => ({
    name: item.name,
    quantity: item.quantity.toString(),
    unit_amount: {
      currency_code: 'USD',
      value: item.unitPriceUsd.toFixed(2),
    },
  }));

  const response = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'PayPal-Request-Id': params.referenceId,
    },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: params.referenceId,
          description: params.description,
          amount: {
            currency_code: 'USD',
            value: totalString,
            breakdown: {
              item_total: {
                currency_code: 'USD',
                value: totalString,
              },
            },
          },
          items,
        },
      ],
      payment_source: {
        paypal: {
          experience_context: {
            brand_name: 'MateArte',
            user_action: 'PAY_NOW',
            shipping_preference: 'NO_SHIPPING',
          },
        },
      },
    }),
    cache: 'no-store',
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to create PayPal order: ${errorText}`);
  }

  return response.json();
}

export async function capturePayPalOrder(paypalOrderId: string) {
  const token = await getPayPalAccessToken();

  const response = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders/${paypalOrderId}/capture`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'PayPal-Request-Id': paypalOrderId,
    },
    body: JSON.stringify({}),
    cache: 'no-store',
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to capture PayPal order: ${errorText}`);
  }

  return response.json();
}

export async function verifyPayPalWebhookSignature(params: {
  authAlgo: string;
  certUrl: string;
  transmissionId: string;
  transmissionSig: string;
  transmissionTime: string;
  webhookId: string;
  webhookEvent: any;
}): Promise<boolean> {
  const token = await getPayPalAccessToken();

  const response = await fetch(`${PAYPAL_API_BASE}/v1/notifications/verify-webhook-signature`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      auth_algo: params.authAlgo,
      cert_url: params.certUrl,
      transmission_id: params.transmissionId,
      transmission_sig: params.transmissionSig,
      transmission_time: params.transmissionTime,
      webhook_id: params.webhookId,
      webhook_event: params.webhookEvent,
    }),
    cache: 'no-store',
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to verify PayPal webhook signature: ${errorText}`);
  }

  const data = await response.json();
  return data.verification_status === 'SUCCESS';
}
