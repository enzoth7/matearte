import { buildGoogleMerchantFeed } from "@/lib/google-merchant-feed";
import { getMerchantShippingRates } from "@/lib/merchant-shipping-rates";
import { siteUrl } from "@/lib/metadata";
import { getStorefrontProducts } from "@/lib/storefront-catalog";

export const dynamic = "force-dynamic";

export async function GET() {
  const [products, shippingRates] = await Promise.all([
    getStorefrontProducts("es"),
    getMerchantShippingRates(),
  ]);
  const feed = buildGoogleMerchantFeed(products, siteUrl, shippingRates);

  // A temporary catalog/database failure must not replace Google's last good feed with an empty one.
  if (feed.itemCount === 0) {
    return new Response("El catálogo no está disponible temporalmente.", {
      status: 503,
      headers: { "Retry-After": "300" },
    });
  }

  return new Response(feed.xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Content-Disposition": 'inline; filename="matearte-productos.xml"',
      "Cache-Control": "public, s-maxage=120, stale-while-revalidate=600",
      "X-Content-Type-Options": "nosniff",
      "X-Merchant-Item-Count": String(feed.itemCount),
    },
  });
}
