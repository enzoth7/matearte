/**
 * URLs de producto que cambiaron cuando el slug pasó a derivarse del nombre del producto.
 * Cada par es [slug anterior, slug actual] y se publica como redirección permanente en es, en y pt.
 * La migración `20261024190000_product_slugs_from_names.sql` aplica los mismos cambios en `commerce_products`.
 */
export const productSlugRedirects: ReadonlyArray<readonly [string, string]> = [
  ["bombillon-pico-de-loro", "bombillon-pico-de-loro-alpaca"],
  ["bota", "bota-texana-corta"],
  ["bota-estampada", "bota-modelo-sophie"],
  ["bota-hombre", "bota-de-hombre-larga"],
  ["bota-modelo-sophie-7732adff", "bota-modelo-sophie-2"],
  ["bota-vaquera", "bota-texana-larga"],
  ["camionero-cuero-crudo-alpaca-cincelada", "mate-camionero-cuero-crudo-alpaca-cincelada"],
  ["camionero-plata-900", "mate-camionero-plata-900"],
  ["camionero-sin-patass-virola-de-acero", "mate-camionero-sin-patas-virola-de-acero"],
  ["cartera-de-cuero", "cartera-matera"],
  ["cinto-de-cuero", "cinto-de-cuero-hebilla-dorada"],
  ["cinto-negro", "cinto-de-vestir"],
  ["criollo-camionero-con-posa-mate-de-cuero-crudo-alpaca-cincelada", "mate-criollo-camionero-con-posa-mate-de-cuero-crudo-alpaca-cincelada"],
  ["criollo-premium-con-posa-mate", "mate-criollo-premium-con-posa-mate"],
  ["imperial-croco-fleje-pampa", "mate-imperial-croco-fleje-pampa"],
  ["kit-matero", "kit-matero-cuadrado"],
  ["kit-matero-9a144bdf", "kit-matero-ovalado"],
  ["mate-criollo-con-posa-mate", "mate-criollo-camionero-sin-virola"],
  ["mate-criollo-imperial-cuero-fleje-floral", "mate-imperial-cuero-crudo-sin-patas-con-posa-mate-de-cuero-crudo"],
  ["mate-criollo-imperial-cuero-fleje-griego", "mate-imperial-cuero-crudo-sin-patas-fleje-griego"],
  ["mate-criollo-imperial-cuero-fleje-pampa", "mate-imperial-forrado-en-cuero-crudo-sin-patas-con-posa-mate-de-cuero-crudo-cinta-pampa"],
  ["mate-criollo-imperial-fleje-abstracto", "mate-criollo-imperial-fleje-abstracto-con-posa-mate-de-cuero-crudo"],
  ["mate-criollo-imperial-fleje-flores", "mate-criollo-imperial-fleje-flores-con-posa-mate-de-cuero-crudo"],
  ["mate-criollo-imperial-fleje-griego", "mate-criollo-imperial-fleje-griego-con-posa-mate-de-cuero-crudo"],
  ["mate-criollo-imperial-fleje-liso", "mate-criollo-imperial-fleje-liso-con-posa-mate-de-cuero-crudo"],
  ["mate-criollo-imperial-fleje-pampa", "mate-criollo-imperial-fleje-pampa-con-posa-mate-de-cuero-crudo"],
  ["mate-criollo-imperial-fleje-pampa-62f080fc", "mate-criollo-imperial-fleje-pampa-virola-de-acero"],
  ["mate-criollo-personalizado-escudo-de-uruguay", "mate-criollo-vaqueta-personalizada-escudo-de-uruguay"],
  ["mate-criollo-torpedo-virola-lisa", "mate-criollo-virola-alpaca-lisa"],
  ["mate-criollo-vaqueta-personalizada-paysandu-4c338e7b", "mate-criollo-vaqueta-personalizada-paysandu-2"],
  ["mate-criollo-vaqueta-personalizada-uruguay", "mate-criollo-virola-alpaca-y-bronce-vaqueta-personalizada-uruguay"],
  ["mate-criollo-vaqueta-personalizada-uruguay-185ff284", "mate-criollo-vaqueta-personalizada-uruguay-2"],
  ["mate-de-plata-900", "mate-cuero-crudo-virola-de-plata-900"],
  ["mate-estribo-camionero", "mate-camionero-coleccion-estribo"],
  ["mate-estribo-imperial", "mate-imperial-coleccion-estribo"],
  ["mate-estribo-torpedo-alpaca-y-bronce", "mate-coquito-coleccion-estribo-alpaca-y-bronce"],
  ["mate-imperial", "mate-imperial-pie-de-alpaca-fleje-pampa"],
  ["mate-imperial-fleje-abstractp", "mate-imperial-fleje-abstracto"],
  ["mate-torpedo", "mate-torpedo-alpaca-grande-cincelada"],
  ["mate-torpedo-cuero-liso-virola-personalizada-escudo-auf", "mate-torpedo-personalizado-auf-2"],
  ["mate-torpedo-plata-cincelado-premium", "mate-torpedo-plata-900"],
  ["mate-torpedo-virola-personalizada-escudo-auf", "mate-torpedo-personalizado-auf"],
  ["matera", "matera-ovalada"],
  ["matera-criolla", "matera-cuero-crudo-aza-con-argolla"],
  ["matera-estampada-db362cbe", "matera-estampada"],
  ["mayorista-1", "mate-camionero-virola-alpaca-cincelada"],
  ["mayorista-10", "mate-criollo-coquito-con-posa-mate-copa"],
  ["mayorista-11", "mate-criollo-torpedo-alpaca-grande-cincelada-con-posa-mate"],
  ["mayorista-12", "mate-imperial-premium-auf"],
  ["mayorista-19", "mate-torpedo-cuero-crudo-alpaca-grande-cincelada"],
  ["mayorista-2", "mate-criollo-camionero-con-posa-mate-copa"],
  ["mayorista-20", "mate-torpedo-cuero-liso-alpaca-grande-lisa"],
  ["mayorista-22", "mate-torpedo-alpaca-cincelada-pelos"],
  ["mayorista-25", "mate-torpedo-virola-alpaca-y-bronce-croco"],
  ["mayorista-28", "mate-torpedo-cuero-liso-alpaca-cincelada"],
  ["mayorista-31", "mate-torpedo-cuero-estampado-alpaca-cincelada"],
  ["mayorista-32", "mate-torpedo-cuero-estampado-alpaca-grande-cincelada"],
  ["mayorista-33", "mate-torpedo-cuero-estampado-alpaca-grande-lisa"],
  ["mayorista-34", "mate-torpedo-acero-liso"],
  ["mayorista-36", "bombillon-pico-alpaca"],
  ["mayorista-38", "bombillon-con-aros-pico-alpaca"],
  ["mayorista-4", "mate-camionero-virola-acero-liso"],
  ["mayorista-40", "bombilla-cincelada"],
  ["mayorista-6", "mate-criollo-coquito-virola-acero-liso"],
  ["mayorista-8", "mate-criollo-alpaca-grande-cincelada-con-posa-mate"],
  ["mayorista-9", "mate-criollo-coquito-con-posa-mate-cinta"],
  ["termo-stanley", "termo-stanley-con-manija"],
  ["termo-stanley-21994043", "termo-stanley-2"],
  ["torpedo-alpaca-cincelado-premium", "mate-torpedo-alpaca-cincelado-premium"],
  ["torpedo-alpaca-premium", "mate-torpedo-alpaca-premium"],
  ["torpedo-cuerdo-crudo-alpaca-lisa", "mate-torpedo-cuerdo-crudo-alpaca-lisa"],
  ["torpedo-cuero-estampado-pie-de-alpaca", "mate-torpedo-cuero-estampado-pie-de-alpaca"],
  ["torpedo-pelos-premium", "mate-torpedo-pelos-premium"],
  ["torpedo-premium-pie-de-alpaca", "mate-torpedo-premium-pie-de-alpaca"],
  ["torpedo-virola-de-alpaca-croco", "mate-torpedo-virola-de-alpaca-croco"],
];

/** Productos sin publicar que ocupaban un slug que ahora necesita un producto publicado; no tienen URL pública. */
export const unpublishedSlugChanges: ReadonlyArray<readonly [string, string]> = [
  ["bota-modelo-sophie", "bota-modelo-sophie-3"],
  ["matera-estampada", "matera-cuero-y-madera"],
];

const productRoutes = [
  { prefix: "", segment: "producto" },
  { prefix: "/en", segment: "product" },
  { prefix: "/pt", segment: "produto" },
] as const;

/** Reglas de redirección permanente para `next.config.ts`, una por idioma y producto. */
export function productSlugRedirectRules() {
  return productSlugRedirects.flatMap(([from, to]) =>
    productRoutes.map(({ prefix, segment }) => ({
      source: `${prefix}/${segment}/${from}`,
      destination: `${prefix}/${segment}/${to}`,
      permanent: true as const,
    })),
  );
}
