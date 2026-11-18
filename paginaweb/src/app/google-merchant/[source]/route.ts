import { buildGoogleMerchantFeedForOffers } from "@/lib/google-merchant-feed";
import { discoveredSources, resolveDiscoveredOffers, type DiscoveredSource } from "@/lib/google-merchant-discovered";
import { siteUrl } from "@/lib/metadata";
import { getStorefrontProducts, getStorewideSale } from "@/lib/storefront-catalog";
import { activeStorewideSalePercent } from "../../../../../shared/storewide-sale";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ source: string }> }) {
  const { source: filename } = await context.params;
  const source = filename.replace(/\.xml$/, "") as DiscoveredSource;
  if (!filename.endsWith(".xml") || !Object.hasOwn(discoveredSources, source)) {
    return new Response("No se encontró la fuente de productos.", { status: 404 });
  }

  const settings = discoveredSources[source];
  const products = await getStorefrontProducts(settings.locale);
  const { offers, unresolvedIds } = resolveDiscoveredOffers(products, source);
  const feed = buildGoogleMerchantFeedForOffers(offers, siteUrl, settings.locale, activeStorewideSalePercent(await getStorewideSale()));

  // An empty catalog indicates a temporary failure. Individual unpublished products leave the feed normally.
  if (feed.itemCount === 0) {
    console.error("[google-merchant] La fuente descubierta está vacía.", {
      source,
      unresolvedIds,
      excludedCount: feed.excludedCount,
    });
    return new Response("El catálogo no está disponible temporalmente.", {
      status: 503,
      headers: { "Retry-After": "300" },
    });
  }

  if (unresolvedIds.length || feed.excludedCount) {
    console.warn("[google-merchant] Se omitieron fichas de la fuente descubierta.", {
      source,
      unresolvedIds,
      excludedCount: feed.excludedCount,
    });
  }

  return new Response(feed.xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Content-Disposition": `inline; filename="matearte-${source}.xml"`,
      "Cache-Control": "public, s-maxage=120, stale-while-revalidate=600",
      "X-Content-Type-Options": "nosniff",
      "X-Merchant-Item-Count": String(feed.itemCount),
    },
  });
}
