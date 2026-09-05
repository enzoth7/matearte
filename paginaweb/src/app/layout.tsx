import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { Newsreader, Outfit } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { CartMerger } from "@/components/CartMerger";
import SmoothScroll from "@/components/ui/smooth-scroll";
import { localeConfig } from "@/i18n/config";
import { defaultSocialImage, localizedAlternates } from "@/i18n/metadata";
import { siteUrl } from "@/lib/metadata";
import "lenis/dist/lenis.css";
import "country-flag-icons/3x2/flags.css";
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

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = await getTranslations("metadata");
  const image = defaultSocialImage(locale);
  const verification: Metadata["verification"] = {
    google: process.env.GOOGLE_SITE_VERIFICATION || undefined,
    other: process.env.BING_SITE_VERIFICATION
      ? { "msvalidate.01": process.env.BING_SITE_VERIFICATION }
      : undefined,
  };
  return {
    metadataBase: new URL(siteUrl),
    applicationName: "MateArte Uruguay",
    title: { default: t("title"), template: "%s | MateArte Uruguay" },
    description: t("description"),
    authors: [{ name: "MateArte Uruguay", url: siteUrl }],
    creator: "MateArte Uruguay",
    publisher: "MateArte Uruguay",
    category: "E-commerce",
    manifest: "/manifest.webmanifest",
    alternates: localizedAlternates(locale, "/"),
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1,
      },
    },
    verification,
    openGraph: {
      type: "website",
      locale: localeConfig[locale].openGraphLocale,
      alternateLocale: ["es_UY", "en_US", "pt_BR"].filter((value) => value !== localeConfig[locale].openGraphLocale),
      url: localizedAlternates(locale, "/")?.canonical?.toString() ?? "/",
      title: t("title"),
      description: t("openGraphDescription"),
      siteName: "MateArte Uruguay",
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title: t("title"),
      description: t("twitterDescription"),
      images: [image],
    },
  };
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  const messages = await getMessages();
  const common = await getTranslations("common");
  return (
    <html lang={localeConfig[locale].htmlLang} className={`${newsreader.variable} ${outfit.variable}`}>
      <body>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <CartMerger />
          <a className="skip-link" href="#contenido">{common("skipToContent")}</a>
          <SmoothScroll>
            <Header key={locale} />
            {children}
            <Footer />
          </SmoothScroll>
        </NextIntlClientProvider>
        <Analytics />
      </body>
    </html>
  );
}
