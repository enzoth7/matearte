import type { Metadata } from "next";
import { Newsreader, Outfit } from "next/font/google";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { CartMerger } from "@/components/CartMerger";
import { JsonLd } from "@/components/JsonLd";
import SmoothScroll from "@/components/ui/smooth-scroll";
import { es } from "@/content/es";
import { absoluteUrl, siteUrl } from "@/lib/metadata";
import "lenis/dist/lenis.css";
import "./globals.css";

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  display: "swap",
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "MateArte Uruguay — Arte & Tradición",
    template: "%s | MateArte Uruguay",
  },
  description: "Mates, bombillas, materas, termos y piezas personalizadas nacidas de una tradición familiar en Paysandú, Uruguay.",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "es_UY",
    url: "/",
    title: "MateArte Uruguay — Arte & Tradición",
    description: "Piezas artesanales para acompañar historias, viajes y rituales cotidianos.",
    siteName: "MateArte Uruguay",
    images: [
      {
        url: "/assets/matearte/04-instagram/seleccion-hd/02-set-premium.jpg",
        width: 1200,
        height: 1500,
        alt: "Set premium MateArte de cuero, metal y madera",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "MateArte Uruguay — Arte & Tradición",
    description: "Piezas artesanales nacidas en Paysandú, Uruguay.",
    images: ["/assets/matearte/04-instagram/seleccion-hd/02-set-premium.jpg"],
  },
};

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": ["Organization", "LocalBusiness"],
  name: es.brand.name,
  url: absoluteUrl(),
  email: es.contact.email,
  telephone: es.contact.phoneHref,
  address: {
    "@type": "PostalAddress",
    streetAddress: "25 de Mayo 1734",
    addressLocality: "Paysandú",
    addressCountry: "UY",
  },
  sameAs: [es.contact.instagramUrl],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={`${newsreader.variable} ${outfit.variable}`}>
      <body>
        <CartMerger />
        <a className="skip-link" href="#contenido">Saltar al contenido</a>
        <JsonLd data={organizationSchema} />
        <SmoothScroll>
          <Header />
          {children}
          <Footer />
        </SmoothScroll>
      </body>
    </html>
  );
}
