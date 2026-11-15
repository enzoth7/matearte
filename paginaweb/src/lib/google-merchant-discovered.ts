import type { Locale, Product } from "@/types/catalog";

/** Offers already found by Google on 14 November 2026, kept in their original language and feed label. */
const discoveredOfferIds = {
  "en-us": "01c1,0998,1736,22e7,3788,3a5d,3af9,41e3,47b9,51a6,532b,5660,56da,576d,585c,5b6c,5cf3,6733,691a,7080,7816,78b7,7e13,8157,83ad,8b96,8dee,9259,93ec,9630,b148,b771,c0a4,c0bb,c4b3,c57a,c631,c745,c894,caea,cf30,d187,d4e8,dc82,dec5,e10f,e378,e629,ef76,f2a4,f426,fc39,ff32,torpedo",
  "en-uy": "4022,405e,4062,40da,412f,4176,417c,41dc,41e9,4218,4221,429b,429c,42d5,42fd,4372,43e2,4444,4468,44bd,4583,4594,45e5,4694,481f,485e,494d,4998,49b2,49ce,4a62,4a73,4af8,4b84,4bcd,4bf4,4c3c,4caf,4cf2,4d04,4dc2,4dc9,4ddc,4e9e,4edb,4f6c,4fac,4fc0,4ffd,mate",
  "pt-uy": "0486,065b,0998,0ab8,0d94,13df,1736,1a23,1e8a,22e7,26fd,2ade,2cd3,2e36,358e,3788,3a5d,3af9,3b79,3f36,41e3,425d,43b2,4473,44c1,4505,47b9,4db5,4fe2,51a6,532b,5528,5660,56da,576d,585c,5ce9,5cf3,6733,691a,7046,7080,7136,7816,7840,78b7,79f1,7bdd,7e13,8097,83ad,8565,8970,8ae7,8b96,8c2d,8c69,8f8c,9259,93b2,93ec,93fb,9630,97d3,9905,9b1a,9c66,9e76,9f34,a6a1,aadb,ab35,b2e5,b956,bd2a,c0a4,c0bb,c29b,c2a3,c4b3,c57a,c745,c798,c7d4,c894,c8af,caa4,caea,cf30,d3dd,d4e8,dc82,dcad,dd07,dec5,e10f,e2fe,e586,e5f9,e629,ec76,ed23,ed71,eeee,ef76,f2d7,f4b0,f6b6,fb90,fbfa,fc39,ff32,imperial,posa,torpedo",
} as const;

// Prices observed in the automatic source, in the same order as the IDs above.
// They identify the corresponding variant when a product has several prices.
// The feed always publishes the current catalog price, never these snapshots.
const discoveredPricesUYU = {
  "en-us": "1100,18100,1050,16950,1400,2050,1050,7300,2750,2650,1700,1850,16950,9100,7300,1400,2850,5150,2850,1400,2650,2800,5350,15600,7300,2750,2950,1400,5350,4650,1400,2650,2950,6050,2050,1400,4000,3100,8200,3100,4800,3300,2050,1500,1100,3650,3300,1950,2950,3650,3650,3250,3300,2650",
  "en-uy": "1500,5450,3250,1700,750,9200,3150,6050,1150,1850,4450,1400,2050,1700,8200,1700,1500,3150,9550,4350,1850,2850,3500,2950,1700,1500,3300,4800,3300,3250,3250,3300,6700,9650,2400,4450,3300,5350,4400,4500,6400,2650,2950,4400,4800,1700,6600,3900,4000,1250",
  "pt-uy": "8200,4400,18100,3300,3250,7100,1050,1850,6700,16950,1700,4500,2850,6100,7300,1400,2050,1050,5450,6600,7300,1400,1700,7100,3300,3150,2750,6050,9550,2650,1700,3250,1850,16950,9100,7300,6700,2850,5150,2850,4400,1400,3250,2650,1850,2800,4450,3900,5350,1700,7300,1150,6700,4600,2750,9650,1500,3300,1400,7300,5350,3300,4650,4800,7300,2650,3650,5600,6400,5600,2850,3150,750,9200,750,2950,6050,3300,3300,2050,1400,3100,3300,6700,8200,6400,2550,3100,4800,1500,2050,1500,1500,4450,1100,3650,3650,2950,1400,1950,2400,1400,5800,2950,2950,4800,1800,2850,1700,2050,3250,3300,3750,1250,2650",
} as const;

export type DiscoveredSource = keyof typeof discoveredOfferIds;

export const discoveredSources: Record<DiscoveredSource, { locale: Locale; country: "UY" | "US"; offerIds: string[]; pricesUYU: number[] }> = {
  "en-us": { locale: "en", country: "US", offerIds: discoveredOfferIds["en-us"].split(","), pricesUYU: discoveredPricesUYU["en-us"].split(",").map(Number) },
  "en-uy": { locale: "en", country: "UY", offerIds: discoveredOfferIds["en-uy"].split(","), pricesUYU: discoveredPricesUYU["en-uy"].split(",").map(Number) },
  "pt-uy": { locale: "pt", country: "UY", offerIds: discoveredOfferIds["pt-uy"].split(","), pricesUYU: discoveredPricesUYU["pt-uy"].split(",").map(Number) },
};

const explicitSlugs: Record<string, string> = {
  "en-us:torpedo": "mate-torpedo-alpaca-grande-cincelada",
  "en-uy:4694": "mate-criollo-vaqueta-personalizada-colonia",
  "en-uy:4f6c": "cinto-con-yunta",
  "en-uy:mate": "mate-criollo-camionero-sin-virola",
  "pt-uy:imperial": "mate-imperial-pie-de-alpaca-fleje-pampa",
  "pt-uy:posa": "mate-criollo-camionero-sin-virola",
  "pt-uy:torpedo": "mate-torpedo-alpaca-grande-cincelada",
};

export type DiscoveredOffer = { id: string; product: Product; referencePriceMinor: number };

export function resolveDiscoveredOffers(products: Product[], source: DiscoveredSource) {
  const segment = source === "en-uy" ? 2 : 1;
  const bySegment = new Map<string, Product[]>();
  const bySlug = new Map(products.map((product) => [product.slug, product]));
  for (const product of products) {
    const idSegment = product.id.split("-")[segment];
    if (!idSegment) continue;
    const matches = bySegment.get(idSegment) ?? [];
    matches.push(product);
    bySegment.set(idSegment, matches);
  }

  const offers: DiscoveredOffer[] = [];
  const unresolvedIds: string[] = [];
  for (const [index, id] of discoveredSources[source].offerIds.entries()) {
    const explicitSlug = explicitSlugs[`${source}:${id}`];
    const product = explicitSlug ? bySlug.get(explicitSlug) : bySegment.get(id)?.length === 1 ? bySegment.get(id)![0] : undefined;
    if (product) offers.push({ id, product, referencePriceMinor: discoveredSources[source].pricesUYU[index] * 100 });
    else unresolvedIds.push(id);
  }
  return { offers, unresolvedIds };
}
