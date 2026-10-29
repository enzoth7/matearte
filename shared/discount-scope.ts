export type DiscountScope = {
  applicability: "all_items" | "design_items" | "categories";
  category_codes: string[];
  include_design_items: boolean;
};

export type DiscountCategory = { code: string; label_es: string; active?: boolean };

export const allDiscountProducts = (): DiscountScope => ({ applicability: "all_items", category_codes: [], include_design_items: false });

export function readDiscountScope(value: Partial<DiscountScope>): DiscountScope {
  return {
    applicability: value.applicability || "all_items",
    category_codes: value.category_codes || [],
    include_design_items: value.applicability === "design_items" || Boolean(value.include_design_items),
  };
}

export function discountScopeLabels(value: Partial<DiscountScope>, categories: DiscountCategory[]): string[] {
  const scope = readDiscountScope(value);
  if (scope.applicability === "all_items") return ["Todos"];
  if (scope.applicability === "design_items") return ["Mates Personalizados"];
  return [
    ...scope.category_codes.map(code => categories.find(category => category.code === code)?.label_es || code),
    ...(scope.include_design_items ? ["Mates Personalizados"] : []),
  ];
}

export function validDiscountScope(scope: DiscountScope) {
  return scope.applicability === "all_items" || scope.applicability === "design_items" || scope.category_codes.length > 0 || scope.include_design_items;
}

/** Totals come from server-priced items, never from the customer's request. */
export function discountCategorySubtotals(items: Array<{ itemType: string; category?: string | null; unitPriceMinor: number; quantity: number }>): Record<string, number> {
  const totals: Record<string, number> = Object.create(null);
  for (const item of items) {
    if (item.itemType !== "catalog") continue;
    const category = item.category?.trim().toLowerCase() || "";
    const amount = item.unitPriceMinor * item.quantity;
    if (!Number.isSafeInteger(amount) || amount < 0) throw new Error("discount:invalid");
    totals[category] = (totals[category] || 0) + amount;
  }
  return totals;
}
