import type { SupabaseClient } from "@supabase/supabase-js";
import { discountCategorySubtotals } from "../../../shared/discount-scope";
import { couponBeatsSale, saleSavingsMinor, type SaleComparisonLine } from "../../../shared/storewide-sale";
import type { ValidatedDiscount } from "@/lib/discounts";

export type CouponSaleResolution = {
  /** El código descuenta más que el descuento general y se usa en el cobro. */
  useCode: boolean;
  /** El descuento general es mayor o igual: el código no se usa ni se consume. */
  saleWins: boolean;
  saleSavingsMinor: number;
  discount: ValidatedDiscount | null;
};

/**
 * El descuento general y un código no se acumulan: gana el que más descuenta al cliente.
 * Cada línea trae el precio sin descuento general (listUnitMinor, con la transferencia si corresponde)
 * y el precio con él (saleUnitMinor). La base de datos apaga el descuento general cuando el pedido
 * trae un código, por eso el código solo se envía cuando gana.
 */
export async function resolveCouponAgainstSale(
  client: SupabaseClient,
  input: { userId: string; code: string; salePercent: number; lines: SaleComparisonLine[] },
): Promise<CouponSaleResolution> {
  if (!input.code) return { useCode: false, saleWins: false, saleSavingsMinor: 0, discount: null };
  if (input.salePercent <= 0) return { useCode: true, saleWins: false, saleSavingsMinor: 0, discount: null };

  const savings = saleSavingsMinor(input.lines);
  const priced = input.lines.map((line) => ({
    itemType: line.itemType, category: line.category, unitPriceMinor: line.listUnitMinor, quantity: line.quantity,
  }));
  const subtotalMinor = priced.reduce((sum, line) => sum + line.unitPriceMinor * line.quantity, 0);
  const designSubtotalMinor = priced.filter((line) => line.itemType === "design")
    .reduce((sum, line) => sum + line.unitPriceMinor * line.quantity, 0);
  const { data, error } = await client.rpc("validate_commerce_discount_scoped", {
    p_user_id: input.userId,
    p_code: input.code,
    p_items_subtotal_minor: subtotalMinor,
    p_design_subtotal_minor: designSubtotalMinor,
    p_category_subtotals: discountCategorySubtotals(priced),
  });
  if (error || !data) throw error || new Error("discount:invalid");
  const discount = data as ValidatedDiscount;
  const useCode = couponBeatsSale(Number(discount.discountMinor), savings);
  return { useCode, saleWins: !useCode, saleSavingsMinor: savings, discount };
}
