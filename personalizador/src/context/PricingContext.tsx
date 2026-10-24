/* oxlint-disable react/only-export-components -- el provider y su hook forman una única API de contexto */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { PublishedPricingCatalog } from "../catalog/pricingCatalog";
import { fetchPublishedPricingCatalog } from "../lib/supabase";

type PricingLoadStatus = "loading" | "ready" | "unavailable";

interface PricingContextValue {
  catalog: PublishedPricingCatalog | null;
  status: PricingLoadStatus;
  error: string | null;
  refresh: (silent?: boolean) => Promise<PublishedPricingCatalog | null>;
}

const PricingContext = createContext<PricingContextValue | null>(null);

export function PricingProvider({ children }: { children: ReactNode }) {
  const [catalog, setCatalog] = useState<PublishedPricingCatalog | null>(null);
  const [status, setStatus] = useState<PricingLoadStatus>("loading");
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (silent = false) => {
    if (!silent) setStatus("loading");
    try {
      const nextCatalog = await fetchPublishedPricingCatalog();
      setCatalog(nextCatalog);
      setError(null);
      setStatus("ready");
      return nextCatalog;
    } catch (reason) {
      setCatalog(null);
      setError(reason instanceof Error ? reason.message : "No se pudieron cargar los precios.");
      setStatus("unavailable");
      return null;
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const value = useMemo(() => ({ catalog, status, error, refresh }), [catalog, error, refresh, status]);
  return <PricingContext.Provider value={value}>{children}</PricingContext.Provider>;
}

export function usePricing() {
  const value = useContext(PricingContext);
  if (!value) throw new Error("usePricing debe usarse dentro de PricingProvider.");
  return value;
}
