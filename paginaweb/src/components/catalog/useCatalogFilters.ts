"use client";

import { startTransition, useMemo, useOptimistic } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "@/i18n/navigation";
import {
  parseCatalogFilters,
  toggleFilterValue,
  writeCatalogFilters,
  type CatalogFilters,
  type CatalogSort,
  type PriceRangeId,
} from "@/lib/catalog-filters";
import type { CatalogColorId, CatalogFinishId, CatalogMaterialId, CatalogProductTypeId } from "@/types/catalog";

export function useCatalogFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const sourceFilters = useMemo(() => parseCatalogFilters(new URLSearchParams(query)), [query]);
  const [filters, setOptimisticFilters] = useOptimistic(sourceFilters);

  const commit = (next: CatalogFilters) => {
    startTransition(() => {
      setOptimisticFilters(next);
      const params = writeCatalogFilters(next);
      const query = [...new Set(params.keys())].reduce<Record<string, string | string[]>>((result, key) => {
        const values = params.getAll(key);
        result[key] = values.length > 1 ? values : values[0];
        return result;
      }, {});
      router.replace({ pathname: "/catalogo", query }, { scroll: false });
    });
  };

  return {
    filters,
    setCategory: (category: CatalogFilters["category"]) => commit({ ...filters, category }),
    setSort: (sort: CatalogSort) => commit({ ...filters, sort }),
    togglePrice: (value: PriceRangeId) => commit({ ...filters, prices: toggleFilterValue(filters.prices, value) }),
    toggleMaterial: (value: CatalogMaterialId) => commit({ ...filters, materials: toggleFilterValue(filters.materials, value) }),
    toggleProductType: (value: CatalogProductTypeId) => commit({ ...filters, productTypes: toggleFilterValue(filters.productTypes, value) }),
    toggleFinish: (value: CatalogFinishId) => commit({ ...filters, finishes: toggleFilterValue(filters.finishes, value) }),
    toggleColor: (value: CatalogColorId) => commit({ ...filters, colors: toggleFilterValue(filters.colors, value) }),
    clearFilters: () => commit({ ...filters, category: "todas", prices: [], materials: [], productTypes: [], finishes: [], colors: [] }),
  };
}
