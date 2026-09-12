import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextIntlClientProvider } from "next-intl";
import type { Locale, Product } from "@/types/catalog";
import esMessages from "../../messages/es.json";
import enMessages from "../../messages/en.json";
import ptMessages from "../../messages/pt.json";
import { ProductDesktop } from "./ProductDesktop";
import { ProductMobile } from "./ProductMobile";

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  Link: ({ children, href, className }: { children: React.ReactNode; href: string; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}));

const messagesByLocale: Record<string, any> = {
  es: esMessages,
  en: enMessages,
  pt: ptMessages,
};

function renderComponent(ui: React.ReactElement, locale: Locale = "es") {
  return render(
    <NextIntlClientProvider locale={locale} messages={messagesByLocale[locale]}>
      {ui}
    </NextIntlClientProvider>
  );
}

const baseProduct: Product = {
  id: "cinto-cuero-crudo",
  slug: "cinto-cuero-crudo",
  name: "Cinto de Cuero Crudo",
  category: "cintos",
  eyebrow: "Cuero vacuno",
  summary: "Cinto tradicional.",
  description: "Cinto artesanal.",
  materials: ["Cuero"],
  filterData: { priceUYU: 2500, materials: ["cuero"] },
  images: [{ src: "/cinto.png", alt: "Cinto", width: 600, height: 600, source: "web", sourceUrl: "", rightsStatus: "brand-public" }],
  variants: [],
};

describe("Atributo largo-cinto-cm en ProductDesktop y ProductMobile", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ available: false, commerceEnabled: false, product: null }),
    }));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  describe("ProductDesktop", () => {
    it("muestra Largo del cinto en español correctamente", () => {
      const product = { ...baseProduct, attributes: { "largo-cinto-cm": 110 } };
      renderComponent(<ProductDesktop product={product} />, "es");
      expect(screen.getByText("Largo del cinto: 110 cm")).toBeInTheDocument();
    });

    it("muestra Belt length en inglés correctamente", () => {
      const product = { ...baseProduct, attributes: { "largo-cinto-cm": 105 } };
      renderComponent(<ProductDesktop product={product} />, "en");
      expect(screen.getByText("Belt length: 105 cm")).toBeInTheDocument();
    });

    it("muestra Comprimento do cinto en portugués correctamente", () => {
      const product = { ...baseProduct, attributes: { "largo-cinto-cm": 120 } };
      renderComponent(<ProductDesktop product={product} />, "pt");
      expect(screen.getByText("Comprimento do cinto: 120 cm")).toBeInTheDocument();
    });

    it("no muestra párrafo de largo del cinto si no está definido", () => {
      renderComponent(<ProductDesktop product={baseProduct} />, "es");
      expect(screen.queryByText(/largo del cinto|belt length|comprimento do cinto/i)).not.toBeInTheDocument();
    });
  });

  describe("ProductMobile", () => {
    it("muestra Belt length en inglés correctamente", () => {
      const product = { ...baseProduct, attributes: { "largo-cinto-cm": 105 } };
      renderComponent(<ProductMobile product={product} />, "en");
      expect(screen.getByText("Belt length: 105 cm")).toBeInTheDocument();
    });

    it("muestra Comprimento do cinto en portugués correctamente", () => {
      const product = { ...baseProduct, attributes: { "largo-cinto-cm": 120 } };
      renderComponent(<ProductMobile product={product} />, "pt");
      expect(screen.getByText("Comprimento do cinto: 120 cm")).toBeInTheDocument();
    });

    it("muestra Largo del cinto en español correctamente", () => {
      const product = { ...baseProduct, attributes: { "largo-cinto-cm": 110 } };
      renderComponent(<ProductMobile product={product} />, "es");
      expect(screen.getByText("Largo del cinto: 110 cm")).toBeInTheDocument();
    });

    it("no muestra párrafo de largo del cinto si no está definido", () => {
      renderComponent(<ProductMobile product={baseProduct} />, "es");
      expect(screen.queryByText(/largo del cinto|belt length|comprimento do cinto/i)).not.toBeInTheDocument();
    });
  });
});
