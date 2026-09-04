import { defineRouting } from "next-intl/routing";

export const localizedPathnames = {
    "/": "/",
    "/catalogo": { es: "/catalogo", en: "/catalog", pt: "/catalogo" },
    "/personalizados": { es: "/personalizados", en: "/custom", pt: "/personalizados" },
    "/clientes": { es: "/clientes", en: "/customers", pt: "/clientes" },
    "/nosotros": { es: "/nosotros", en: "/about", pt: "/sobre-nos" },
    "/contacto": { es: "/contacto", en: "/contact", pt: "/contato" },
    "/carrito": { es: "/carrito", en: "/cart", pt: "/carrinho" },
    "/checkout": { es: "/checkout", en: "/checkout", pt: "/finalizar-compra" },
    "/perfil": { es: "/perfil", en: "/account", pt: "/perfil" },
    "/perfil/editar": { es: "/perfil/editar", en: "/account/edit", pt: "/perfil/editar" },
    "/producto/[slug]": { es: "/producto/[slug]", en: "/product/[slug]", pt: "/produto/[slug]" },
    "/pedidos/[id]": { es: "/pedidos/[id]", en: "/orders/[id]", pt: "/pedidos/[id]" },
    "/compras/terminos-y-condiciones": {
      es: "/compras/terminos-y-condiciones",
      en: "/purchases/terms-and-conditions",
      pt: "/compras/termos-e-condicoes",
    },
    "/compras/politica-de-privacidad": {
      es: "/compras/politica-de-privacidad",
      en: "/purchases/privacy-policy",
      pt: "/compras/politica-de-privacidade",
    },
    "/compras/condiciones-de-compra": {
      es: "/compras/condiciones-de-compra",
      en: "/purchases/purchase-terms",
      pt: "/compras/condicoes-de-compra",
    },
    "/compras/envios": {
      es: "/compras/envios",
      en: "/purchases/shipping",
      pt: "/compras/envios",
    },
} as const;

export const routing = defineRouting({
  locales: ["es", "en", "pt"],
  defaultLocale: "es",
  localePrefix: "as-needed",
  localeDetection: false,
  pathnames: localizedPathnames,
});

export type AppLocale = (typeof routing.locales)[number];
