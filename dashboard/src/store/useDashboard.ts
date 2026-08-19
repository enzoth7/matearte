import { useCallback, useEffect, useState } from "react";
import seed from "../data/seed.json";
import { demoRequest } from "../lib/demoDashboard";
import { isSupabaseConfigured } from "../lib/supabaseClient";
import * as supabaseService from "../lib/supabaseService";
import type {
  CustomerProfile,
  DashboardData,
  DraftOrderItem,
  Product,
  ProductionItem,
} from "../types";

const initialData = seed as DashboardData;

async function apiRequest<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "No se pudo guardar el cambio.");
  return payload as T;
}

const useDirectSupabase =
  isSupabaseConfigured &&
  import.meta.env.MODE !== "test" &&
  import.meta.env.VITE_DASHBOARD_DATA_MODE !== "demo" &&
  import.meta.env.VITE_DASHBOARD_DATA_MODE !== "api";

const request =
  import.meta.env.VITE_DASHBOARD_DATA_MODE === "api" ? apiRequest : demoRequest;

export function useDashboard() {
  const [data, setData] = useState<DashboardData>(initialData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const run = useCallback(
    async <T,>(action: () => Promise<T>, selectData: (result: T) => DashboardData) => {
      setError("");
      try {
        const result = await action();
        setData(selectData(result));
        return result;
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : "No se pudo guardar el cambio.";
        setError(message);
        throw caught;
      }
    },
    [],
  );

  const refresh = useCallback(async () => {
    try {
      if (useDirectSupabase) {
        const nextData = await supabaseService.fetchDashboardData();
        setData(nextData);
      } else {
        const nextData = await request<DashboardData>("/api/dashboard");
        setData(nextData);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudieron cargar los datos.");
    }
  }, []);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  useEffect(() => {
    const handleFocus = () => {
      void refresh();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void refresh();
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    const interval = setInterval(() => {
      void refresh();
    }, 8000);

    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      clearInterval(interval);
    };
  }, [refresh]);

  const addProduct = useCallback(
    (product: { model: string; variant: string; rimType?: string; leatherType?: string; priceArg: number }) =>
      run(
        () =>
          useDirectSupabase
            ? supabaseService.createProduct(product)
            : request<DashboardData>("/api/products", {
                method: "POST",
                body: JSON.stringify(product),
              }),
        (payload) => payload,
      ),
    [run],
  );

  const addOrder = useCallback(
    async (customer: string, items: DraftOrderItem[]) => {
      const result = await run(
        () =>
          useDirectSupabase
            ? supabaseService.createOrder(customer, items)
            : request<{ data: DashboardData; orderId: string }>("/api/orders", {
                method: "POST",
                body: JSON.stringify({ customer, items }),
              }),
        (payload) => payload.data,
      );
      return result.orderId;
    },
    [run],
  );

  const addCustomer = useCallback(
    (customer: CustomerProfile) =>
      run(
        () =>
          useDirectSupabase
            ? supabaseService.createCustomer(customer)
            : request<DashboardData>("/api/customers", {
                method: "POST",
                body: JSON.stringify(customer),
              }),
        (payload) => payload,
      ),
    [run],
  );

  const renameCustomer = useCallback(
    (previousCustomer: string, customer: CustomerProfile) =>
      run(
        () =>
          useDirectSupabase
            ? supabaseService.mergeOrUpdateCustomer(previousCustomer, customer)
            : request<DashboardData>(`/api/customers/${encodeURIComponent(previousCustomer)}`, {
                method: "PUT",
                body: JSON.stringify(customer),
              }),
        (payload) => payload,
      ),
    [run],
  );

  const updateProduction = useCallback(
    (item: ProductionItem) =>
      run(
        () =>
          useDirectSupabase
            ? supabaseService.updateProductionLine(item.lineId, item)
            : request<DashboardData>(`/api/production/${encodeURIComponent(item.lineId)}`, {
                method: "PATCH",
                body: JSON.stringify(item),
              }),
        (payload) => payload,
      ),
    [run],
  );

  const completeLine = useCallback(
    (lineId: string) =>
      run(
        () =>
          useDirectSupabase
            ? supabaseService.completeProductionLine(lineId)
            : request<DashboardData>(`/api/production/${encodeURIComponent(lineId)}/complete`, {
                method: "POST",
              }),
        (payload) => payload,
      ),
    [run],
  );

  const updateProduct = useCallback(
    (product: Product) =>
      run(
        () =>
          useDirectSupabase
            ? supabaseService.updateProduct(product.id, product)
            : request<DashboardData>(`/api/products/${encodeURIComponent(product.id)}`, {
                method: "PATCH",
                body: JSON.stringify(product),
              }),
        (payload) => payload,
      ),
    [run],
  );

  const updateExchangeRate = useCallback(
    (exchangeRate: number) =>
      run(
        () =>
          useDirectSupabase
            ? supabaseService.updateExchangeRate(exchangeRate)
            : request<DashboardData>("/api/settings/exchange-rate", {
                method: "PUT",
                body: JSON.stringify({ exchangeRate }),
              }),
        (payload) => payload,
      ),
    [run],
  );

  const resetData = useCallback(
    () =>
      run(
        () =>
          useDirectSupabase
            ? supabaseService.resetData()
            : request<DashboardData>("/api/reset", { method: "POST" }),
        (payload) => payload,
      ),
    [run],
  );

  return {
    data,
    loading,
    error,
    refresh,
    addProduct,
    addOrder,
    addCustomer,
    renameCustomer,
    updateProduction,
    completeLine,
    updateProduct,
    updateExchangeRate,
    resetData,
  };
}
