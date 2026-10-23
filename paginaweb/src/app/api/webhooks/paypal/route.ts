import { paypalUsdMinor } from '@/lib/paypal-money';
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
        const amountMinor = paypalUsdMinor(resource.amount);
        const paypal_order_id = resource.supplementary_data?.related_ids?.order_id;

        if (!event.id || !paypal_order_id || !capture_id || resource.status !== 'COMPLETED') throw new Error('Evento de captura incompleto.');
        {
          const { data: rpcResult, error: rpcError } = await admin.rpc('process_paypal_payment', {
            p_event_id: event.id,
            p_event_type: event.event_type,
            p_paypal_order_id: paypal_order_id,
            p_capture_id: capture_id,
            p_amount_usd_minor: amountMinor,
            p_capture_payload: event,
          });

          if (rpcError) throw rpcError;
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
        const upHref = resource.links?.find((link: { rel?: string; href?: string }) => link.rel === 'up')?.href || '';
        const captureId = resource.supplementary_data?.related_ids?.capture_id || upHref.match(/\/captures\/([A-Z0-9]+)(?:[/?#]|$)/)?.[1];
        if (!event.id || !resource.id || !captureId) throw new Error('Reembolso sin referencia a su captura.');
        if (resource.status !== 'COMPLETED') throw new Error('Reembolso aún no confirmado.');
        const { error } = await admin.rpc('process_paypal_refund', {
          p_event_id: event.id, p_capture_id: captureId, p_refund_id: resource.id,
          p_amount_usd_minor: paypalUsdMinor(resource.amount), p_payload: event,
        });
        if (error) throw error;
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
