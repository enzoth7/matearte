import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { resolve } from "node:path";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // Catalog taxonomy is shared with the commerce admin one directory above.
  turbopack: {
    root: resolve(__dirname, ".."),
  },
  async redirects() {
    return [
      { source: "/es", destination: "/", permanent: true },
      { source: "/es/:path*", destination: "/:path*", permanent: true },
      { source: "/catalogo/mates", destination: "/catalogo?categoria=mates", permanent: true },
      { source: "/catalogo/bombillas", destination: "/catalogo?categoria=bombillas", permanent: true },
      { source: "/catalogo/materas", destination: "/catalogo?categoria=materas", permanent: true },
      { source: "/catalogo/termos", destination: "/catalogo?categoria=termos", permanent: true },
      { source: "/catalogo/regalos", destination: "/catalogo?categoria=regalos", permanent: true },
      { source: "/en/catalog/:category(mates|bombillas|materas|termos|regalos)", destination: "/en/catalog?categoria=:category", permanent: true },
      { source: "/pt/catalogo/:category(mates|bombillas|materas|termos|regalos)", destination: "/pt/catalogo?categoria=:category", permanent: true },
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
