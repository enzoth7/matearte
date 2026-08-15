import type { MetadataRoute } from "next";
import { categories, products } from "@/data/catalog";
import { absoluteUrl } from "@/lib/metadata";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes = ["", "/catalogo", "/personalizados", "/clientes", "/nosotros", "/contacto"];
  return [
    ...staticRoutes.map((route, index) => ({ url: absoluteUrl(route || "/"), changeFrequency: index === 0 ? "weekly" as const : "monthly" as const, priority: index === 0 ? 1 : 0.8 })),
    ...categories.map((category) => ({ url: absoluteUrl(`/catalogo/${category.slug}`), changeFrequency: "monthly" as const, priority: 0.75 })),
    ...products.map((product) => ({ url: absoluteUrl(`/producto/${product.slug}`), changeFrequency: "monthly" as const, priority: 0.7 })),
  ];
}
