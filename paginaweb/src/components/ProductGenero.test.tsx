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
  id: "bota-de-campo",
  slug: "bota-de-campo",
  name: "Bota de Campo",
  category: "botas",
  eyebrow: "Cuero vacuno",
  summary: "Bota tradicional de cuero.",
  description: "Bota artesanal uruguaya.",
  materials: ["Cuero"],
  filterData: { priceUYU: 8500, materials: ["cuero"] },
  images: [{ src: "/boot.png", alt: "Bota", width: 600, height: 600, source: "web", sourceUrl: "", rightsStatus: "brand-public" }],
  variants: [],
};

describe("Atributo Genero en ProductDesktop y ProductMobile", () => {
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
    it("muestra Género en español correctamente (hombre)", () => {
      const product = { ...baseProduct, attributes: { genero: "hombre" } };
      renderComponent(<ProductDesktop product={product} />, "es");
      expect(screen.getByText("Género: Hombre")).toBeInTheDocument();
    });

    it("muestra Gender en inglés correctamente (mujer)", () => {
      const product = { ...baseProduct, attributes: { genero: "mujer" } };
      renderComponent(<ProductDesktop product={product} />, "en");
      expect(screen.getByText("Gender: Women")).toBeInTheDocument();
    });

    it("muestra Gênero en portugués correctamente (unisex)", () => {
      const product = { ...baseProduct, attributes: { genero: "unisex" } };
      renderComponent(<ProductDesktop product={product} />, "pt");
      expect(screen.getByText("Gênero: Unissex")).toBeInTheDocument();
    });

    it("no muestra párrafo de género si el atributo no está presente", () => {
      renderComponent(<ProductDesktop product={baseProduct} />, "es");
      expect(screen.queryByText(/género|gender|gênero/i)).not.toBeInTheDocument();
    });
  });

  describe("ProductMobile", () => {
    it("muestra Gender en inglés correctamente (hombre -> Men)", () => {
      const product = { ...baseProduct, attributes: { genero: "hombre" } };
      renderComponent(<ProductMobile product={product} />, "en");
      expect(screen.getByText("Gender: Men")).toBeInTheDocument();
    });

    it("muestra Gênero en portugués correctamente (mujer -> Feminino)", () => {
      const product = { ...baseProduct, attributes: { genero: "mujer" } };
      renderComponent(<ProductMobile product={product} />, "pt");
      expect(screen.getByText("Gênero: Feminino")).toBeInTheDocument();
    });

    it("muestra Género en español correctamente (unisex -> Unisex)", () => {
      const product = { ...baseProduct, attributes: { genero: "unisex" } };
      renderComponent(<ProductMobile product={product} />, "es");
      expect(screen.getByText("Género: Unisex")).toBeInTheDocument();
    });

    it("no muestra párrafo de género si el atributo no está presente", () => {
      renderComponent(<ProductMobile product={baseProduct} />, "es");
      expect(screen.queryByText(/género|gender|gênero/i)).not.toBeInTheDocument();
    });
  });
});
