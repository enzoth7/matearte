// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { resolveCouponAgainstSale } from "./storewide-sale-checkout";

const lines = [{ itemType: "catalog", category: "mates", quantity: 2, listUnitMinor: 10000, saleUnitMinor: 8000 }];
const client = (discountMinor: number | Error) => ({
  rpc: vi.fn(async () => discountMinor instanceof Error ? { data: null, error: discountMinor } : { data: { discountMinor }, error: null }),
}) as never;

describe("resolveCouponAgainstSale", () => {
  it("does nothing without a code", async () => {
    const supabase = client(1);
    expect(await resolveCouponAgainstSale(supabase, { userId: "u", code: "", salePercent: 20, lines })).toMatchObject({ useCode: false, saleWins: false });
    expect((supabase as unknown as { rpc: ReturnType<typeof vi.fn> }).rpc).not.toHaveBeenCalled();
  });

  it("uses the code when there is no general discount", async () => {
    const supabase = client(1);
    expect(await resolveCouponAgainstSale(supabase, { userId: "u", code: "A", salePercent: 0, lines })).toMatchObject({ useCode: true });
    expect((supabase as unknown as { rpc: ReturnType<typeof vi.fn> }).rpc).not.toHaveBeenCalled();
  });

  it("keeps the general discount when the code saves the same or less", async () => {
    expect(await resolveCouponAgainstSale(client(4000), { userId: "u", code: "A", salePercent: 20, lines })).toMatchObject({ useCode: false, saleWins: true, saleSavingsMinor: 4000 });
    expect(await resolveCouponAgainstSale(client(100), { userId: "u", code: "A", salePercent: 20, lines })).toMatchObject({ useCode: false, saleWins: true });
  });

  it("uses the code only when it saves more than the general discount", async () => {
    expect(await resolveCouponAgainstSale(client(4001), { userId: "u", code: "A", salePercent: 20, lines })).toMatchObject({ useCode: true, saleWins: false });
  });

  it("surfaces an invalid code instead of silently dropping it", async () => {
    await expect(resolveCouponAgainstSale(client(new Error("discount:not_found")), { userId: "u", code: "A", salePercent: 20, lines })).rejects.toThrow("discount:not_found");
  });
});
