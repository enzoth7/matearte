import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { resolve } from "node:path";
import { productSlugRedirectRules } from "./src/lib/product-slug-redirects";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // Catalog taxonomy is shared with the commerce admin one directory above.
  turbopack: {
    root: resolve(__dirname, ".."),
  },
  async redirects() {
    return [
      { source: "/rural", destination: "/sorteo", permanent: true },
      { source: "/es/rural", destination: "/sorteo", permanent: true },
      { source: "/en/rural", destination: "/en/sorteo", permanent: true },
      { source: "/pt/rural", destination: "/pt/sorteo", permanent: true },
      { source: "/es", destination: "/", permanent: true },
      { source: "/es/:path*", destination: "/:path*", permanent: true },
      // Cada categoría tiene su página (/catalogo/mates); estos son alias viejos.
      { source: "/catalogo/kit-matero", destination: "/catalogo/kits-materos", permanent: true },
      { source: "/catalogo/cuchillo", destination: "/catalogo/cuchillos", permanent: true },
      { source: "/catalogo/regalos", destination: "/personalizados", permanent: true },
      { source: "/en/catalog/kit-matero", destination: "/en/catalog/kits-materos", permanent: true },
      { source: "/en/catalog/cuchillo", destination: "/en/catalog/cuchillos", permanent: true },
      { source: "/en/catalog/regalos", destination: "/en/custom", permanent: true },
      { source: "/pt/catalogo/kit-matero", destination: "/pt/catalogo/kits-materos", permanent: true },
      { source: "/pt/catalogo/cuchillo", destination: "/pt/catalogo/cuchillos", permanent: true },
      { source: "/pt/catalogo/regalos", destination: "/pt/personalizados", permanent: true },
      ...productSlugRedirectRules(),
    ];
  },
  images: {
    formats: ["image/avif", "image/webp"],
    qualities: [75, 95, 100],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "agdkljuulwjwjasftcce.supabase.co",
        pathname: "/storage/v1/object/sign/**",
      },
      {
        protocol: "https",
        hostname: "agdkljuulwjwjasftcce.supabase.co",
        pathname: "/storage/v1/object/public/product-images/**",
      },
    ],
  },
};

export default withNextIntl(nextConfig);
