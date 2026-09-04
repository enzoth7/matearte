import type { MetadataRoute } from "next";
import { buildSitemapFile } from "@/lib/seo-files";
import { getStorefrontProducts } from "@/lib/storefront-catalog";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return buildSitemapFile(await getStorefrontProducts("es"));
}
