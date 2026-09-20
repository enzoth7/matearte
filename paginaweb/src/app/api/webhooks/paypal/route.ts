import { apiError, apiOk } from '@/lib/api';
import { verifyPayPalWebhookSignature } from '@/lib/paypal';
import { dispatchCommerceEmails } from '@/lib/commerce-email';
import { createAdminSupabase } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const event = JSON.parse(rawBody);

    const authAlgo = req.headers.get('paypal-auth-algo');
    const certUrl = req.headers.get('paypal-cert-url');
    const transmissionId = req.headers.get('paypal-transmission-id');
    const transmissionSig = req.headers.get('paypal-transmission-sig');
    const transmissionTime = req.headers.get('paypal-transmission-time');
    
    if (!authAlgo || !certUrl || !transmissionId || !transmissionSig || !transmissionTime) {
      return apiError('Missing PayPal signature headers', 400);
    }

    const webhookId = process.env.PAYPAL_WEBHOOK_ID;
    if (!webhookId) {
      console.error('PAYPAL_WEBHOOK_ID not set');
      return apiError('Internal configuration error', 500);
    }

    const isValid = await verifyPayPalWebhookSignature({
      authAlgo,
      certUrl,
      transmissionId,
      transmissionSig,
      transmissionTime,
      webhookId,
      webhookEvent: event,
    });

    if (!isValid) {
      return apiError('Invalid signature', 401);
    }

    const admin = createAdminSupabase();

    switch (event.event_type) {
      case 'PAYMENT.CAPTURE.COMPLETED': {
        const resource = event.resource;
        const capture_id = resource.id;
        const amount_usd = resource.amount?.value;
        const paypal_order_id = resource.supplementary_data?.related_ids?.order_id;

        if (paypal_order_id && capture_id && amount_usd) {
          const { data: rpcResult } = await admin.rpc('process_paypal_payment', {
            p_event_id: event.id,
            p_event_type: event.event_type,
            p_paypal_order_id: paypal_order_id,
            p_capture_id: capture_id,
            p_amount_usd_minor: Math.round(parseFloat(amount_usd) * 100),
            p_capture_payload: event,
          });

          const orderId = rpcResult && typeof rpcResult === 'object'
            && 'orderId' in rpcResult && typeof rpcResult.orderId === 'string'
            ? rpcResult.orderId
            : null;
          if (orderId) await dispatchCommerceEmails(orderId);
        }
        break;
      }
      case 'PAYMENT.CAPTURE.DENIED': {
        const resource = event.resource;
        const paypal_order_id = resource.supplementary_data?.related_ids?.order_id;
        if (paypal_order_id) {
          const { error: discardError } = await admin.rpc('discard_unconfirmed_paypal_order', {
            p_paypal_order_id: paypal_order_id,
          });
          if (discardError) throw discardError;
        }
        break;
      }
      case 'PAYMENT.CAPTURE.REFUNDED': {
        const resource = event.resource;
        const paypal_order_id = resource.supplementary_data?.related_ids?.order_id; // Check if supplementary_data exists, sometimes refunded has different structure
        const links = resource.links || [];
        const upLink = links.find((l: Record<string, unknown>) => l.rel === 'up');
        // Sometimes the order ID is in links. We'll do our best to find it.
        const upHref = typeof upLink?.href === "string" ? upLink.href : "";
        const order_id_extracted = paypal_order_id || (upHref.match(/orders\/([A-Z0-9]+)/)?.[1]);
        if (order_id_extracted) {
           await admin.from('orders').update({ status: 'refunded' }).eq('paypal_order_id', order_id_extracted);
        }
        break;
      }
      default:
        // Other events ignored
        break;
    }

    return apiOk({ received: true });
  } catch (err) {
    console.error('PayPal webhook error:', err);
    return apiError(err instanceof Error ? err.message : "Error procesando webhook.", 500);
  }
}
