import type { Locale } from "@/types/catalog";

export const locale: Locale = "es";

export const es = {
  brand: {
    name: "MateArte Uruguay",
    shortName: "MateArte",
    tagline: "Arte & Tradición",
  },
  navigation: [
    { label: "Catálogo", href: "/catalogo" },
    { label: "Personalizados", href: "/personalizados" },
    { label: "Clientes", href: "/clientes" },
    { label: "Nosotros", href: "/nosotros" },
    { label: "Contacto", href: "/contacto" },
  ],
  contact: {
    address: "25 de Mayo 1734, Paysandú, Uruguay",
    phoneDisplay: "+598 91 674 231",
    phoneHref: "+59891674231",
    email: "matearte.ventas@gmail.com",
    instagram: "@matearteuruguay",
    instagramUrl: "https://www.instagram.com/matearteuruguay/",
  },
} as const;
