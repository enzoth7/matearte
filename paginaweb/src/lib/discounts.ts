export type DiscountReason =
  | "not_found"
  | "disabled"
  | "not_started"
  | "expired"
  | "already_used"
  | "in_use"
  | "not_applicable"
  | "invalid_reservation"
  | "invalid";

export type ValidatedDiscount = {
  discountId: string;
  code: string;
  discountType: "percentage" | "fixed";
  discountValue: number;
  applicability: "all_items" | "design_items";
  eligibleSubtotalMinor: number;
  discountMinor: number;
  itemsSubtotalMinor: number;
  discountedItemsSubtotalMinor: number;
};

export const normalizeDiscountCode = (value: unknown) =>
  typeof value === "string" ? value.trim().toUpperCase().slice(0, 32) : "";

export function discountReasonFromError(value: unknown): DiscountReason {
  const message = value instanceof Error
    ? value.message
    : value && typeof value === "object" && "message" in value
      ? String(value.message)
      : String(value || "");
  const match = message.match(/discount:([a-z_]+)/i)?.[1] as DiscountReason | undefined;
  return match || "invalid";
}

export const discountErrorMessage = (reason: DiscountReason) => ({
  not_found: "El código no existe.",
  disabled: "El código está deshabilitado.",
  not_started: "El código todavía no está vigente.",
  expired: "El código ya venció.",
  already_used: "Ya usaste este código en otra compra.",
  in_use: "Este código está reservado por otro intento de pago. Volvé a intentar más tarde.",
  not_applicable: "El descuento no puede aplicarse al subtotal de esta compra.",
  invalid_reservation: "No se pudo reservar el descuento.",
  invalid: "No se pudo validar el código de descuento.",
})[reason];
