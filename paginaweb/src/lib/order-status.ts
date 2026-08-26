export const orderStatusLabels: Record<string, string> = {
  pending_payment: "Esperando el pago",
  paid_pending_review: "Pago recibido · revisando tu personalizado",
  ready_for_fulfillment: "Preparando tu pedido",
  ready_for_production: "Personalizado aprobado · en producción",
  payment_failed: "El pago no fue aprobado",
  cancelled: "Pedido cancelado",
  refunded: "Pago reembolsado",
  manual_review: "Pedido en revisión",
};

export const orderStatusDescriptions: Record<string, string> = {
  pending_payment: "Mercado Pago todavía no confirmó el pago.",
  paid_pending_review: "Recibimos el pago y estamos revisando los detalles del personalizado.",
  ready_for_fulfillment: "El pedido está confirmado y lo estamos preparando.",
  ready_for_production: "El diseño fue aprobado y ya puede pasar a producción.",
  payment_failed: "El pago fue rechazado o no pudo completarse.",
  cancelled: "Este pedido fue cancelado.",
  refunded: "El importe de este pedido fue reembolsado.",
  manual_review: "Necesitamos verificar este pedido antes de continuar.",
};

export function orderStatusTone(status: string) {
  if (["ready_for_fulfillment", "ready_for_production"].includes(status)) {
    return "border-[var(--yerba)]/35 bg-[var(--yerba)]/10 text-[#394322]";
  }
  if (["payment_failed", "cancelled", "refunded"].includes(status)) {
    return "border-[var(--danger)]/30 bg-[var(--danger)]/8 text-[var(--danger)]";
  }
  if (status === "pending_payment") {
    return "border-[var(--rawhide)]/60 bg-[var(--rawhide)]/15 text-[var(--walnut)]";
  }
  return "border-[var(--leather)]/35 bg-[var(--leather)]/10 text-[var(--walnut)]";
}

export function isConfirmedOrder(status: string) {
  return ["paid_pending_review", "ready_for_fulfillment", "ready_for_production"].includes(status);
}

export function isActiveOrder(status: string) {
  return ["pending_payment", "paid_pending_review", "ready_for_fulfillment", "ready_for_production", "manual_review"].includes(status);
}
