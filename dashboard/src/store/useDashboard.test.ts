import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDashboard } from "./useDashboard";

describe("useDashboard hook", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("permite agregar un nuevo producto mediante addProduct", async () => {
    const { result } = renderHook(() => useDashboard());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.addProduct({
        model: "Imperial",
        variant: "Vaqueta Negra",
        rimType: "Alpaca",
        leatherType: "Negro",
        priceArg: 65000,
      });
    });

    const added = result.current.data.products.find(
      (p) => p.model === "Imperial" && p.variant === "Vaqueta Negra"
    );
    expect(added).toBeDefined();
    expect(added?.priceArg).toBe(65000);
  });

  it("ejecuta refresh y actualiza datos", async () => {
    const { result } = renderHook(() => useDashboard());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.data).toBeDefined();
    expect(result.current.error).toBe("");
  });

  it("configura sincronización periódica y ante foco", async () => {
    const { result } = renderHook(() => useDashboard());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Disparar foco de ventana
    act(() => {
      window.dispatchEvent(new Event("focus"));
    });

    // Disparar visibilidad
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    // Avanzar intervalo de 8 segundos
    act(() => {
      vi.advanceTimersByTime(8000);
    });

    expect(result.current.data).toBeDefined();
  });
});
