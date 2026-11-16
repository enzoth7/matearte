import { describe, expect, it } from "vitest";
import { complementFamily, priceInUyu, quickAddSelection, quickAddVariant, recommendForCart, toCartCatalog, type CartCatalogProduct, type ComplementFamily } from "./cart-recommendations";
import type { Product } from "@/types/catalog";

export function fixtureProduct(id: string, family: ComplementFamily, pesos: number): CartCatalogProduct {
  return { id, slug: id, name: id, category: family === "mate" ? "mates" : `${family}s`, family, attributes: {}, purchaseAxes: [], images: [{ src: "/assets/matearte/profile-orders-desktop/catalog-fallback.webp", alt: id, width: 1200, height: 1200, source: "provided", sourceUrl: "", rightsStatus: "brand-public" }], variants: [{ id: `${id}-variant`, commerceId: `${id}-variant`, label: "Única", value: id, available: true, options: {}, price: { amountMinor: pesos * 100, currency: "UYU" } }], quickVariantId: `${id}-variant` };
}
const source = (family: ComplementFamily, pesos: number) => ({ family, price: { amountMinor: pesos * 100, currency: "UYU" as const } });
const ids = (items: ReturnType<typeof recommendForCart>) => items.map(i => i.product.id);
describe("cart complements", () => {
  it("prioritizes 35%, allows 70% inclusively and rejects higher prices and substitute mates", () => {
    const catalog = [fixtureProduct("mate", "mate", 1000), fixtureProduct("over", "termo", 3500.01), fixtureProduct("edge", "termo", 3500), fixtureProduct("cheap", "bombilla", 1750), fixtureProduct("above", "yerbero", 1750.01)];
    const result = recommendForCart(catalog, [source("mate", 5000)], {});
    expect(ids(result)).toEqual(["cheap", "edge", "above"]);
    expect(result.map(i => i.tier)).toEqual([0,1,1]);
  });
  it("recommends mates for yerberos and termos, cleaners for bombillas", () => {
    const catalog = [fixtureProduct("mate", "mate", 1500), fixtureProduct("bombilla", "bombilla", 1000), fixtureProduct("cleaner", "limpiabombillas", 100)];
    for (const family of ["yerbero", "termo"] as const) expect(ids(recommendForCart(catalog, [source(family,5000)], {}))).toEqual(["mate", "bombilla"]);
    expect(ids(recommendForCart(catalog, [source("bombilla",1000)], {}))).toEqual(["cleaner"]);
  });
  it("limits generic accessories to 35%, never expands their budget", () => {
    const catalog = [fixtureProduct("tarjetero", "tarjetero",1750), fixtureProduct("llavero", "llavero",1751),fixtureProduct("mate", "mate",500)];
    expect(ids(recommendForCart(catalog,[source("other",5000)],{}))).toEqual(["tarjetero"]);
  });
  it("considers the whole cart, excludes existing families and IDs, deduplicates and caps each family", () => {
    const mate = fixtureProduct("in-cart", "mate",5000);
    const catalog = [mate, ...[1,2,3].map(i => fixtureProduct(`bombilla-${i}`,"bombilla",i*200)), fixtureProduct("termo","termo",2000),fixtureProduct("yerbero","yerbero",1000),fixtureProduct("accessory","tarjetero",1000)];
    const result = recommendForCart(catalog,[{ variantId: mate.variants[0].id, price: mate.variants[0].price! },source("other",5000)],{});
    expect(result).toHaveLength(4);
    expect(ids(result)).not.toContain("in-cart");
    expect(result.filter(i => i.product.family === "bombilla")).toHaveLength(2);
    const afterAdd = recommendForCart(catalog,[source("mate",5000),{ variantId: "bombilla-1-variant",price:{amountMinor:20000,currency:"UYU"}}],{});
    expect(ids(afterAdd)).not.toContain("bombilla-1");
    expect(afterAdd.every(i => i.product.family !== "bombilla")).toBe(true);
  });
  it("uses live unit prices, independent of cart quantity or a stale cart price", () => {
    const mate=fixtureProduct("mate","mate",5000), complement=fixtureProduct("termo","termo",3501);
    expect(recommendForCart([mate,complement],[{ variantId: "mate-variant",price:{amountMinor:5000000,currency:"UYU"}}],{})).toEqual([]);
    for (const quantity of [1,10,99]) {
      const line = { ...source("mate",5000), quantity };
      expect(recommendForCart([complement],[line],{})).toEqual([]);
    }
  });
  it("converts prices with the same rate-to-UYU convention and fails closed without a rate", () => {
    const thermo=fixtureProduct("termo","termo",50); thermo.variants[0].price!.currency="USD";
    expect(ids(recommendForCart([thermo],[source("mate",5000)],{USD:40}))).toEqual(["termo"]);
    expect(recommendForCart([thermo],[source("mate",5000)],{})).toEqual([]);
    expect(priceInUyu({amountMinor:10000,currency:"BRL"},{BRL:8})).toBe(80000);
    expect(priceInUyu({amountMinor:10000,currency:"ARS"},{ARS:.025})).toBe(250);
  });
  it("uses base prices consistently for the Argentina base-price policy", () => {
    const mate=fixtureProduct("mate","mate",5000), thermo=fixtureProduct("termo","termo",4000);
    mate.variants[0].basePrice={amountMinor:400000,currency:"UYU"}; thermo.variants[0].basePrice={amountMinor:250000,currency:"UYU"};
    expect(ids(recommendForCart([mate,thermo],[{variantId:"mate-variant",price:mate.variants[0].price!}],{},true))).toEqual(["termo"]);
  });
  it("excludes unavailable, noncommercial, zero, negative and nonfinite prices", () => {
    const catalog=[fixtureProduct("disabled","bombilla",100),fixtureProduct("editorial","termo",100),fixtureProduct("zero","yerbero",0),fixtureProduct("negative","bombilla",-1),fixtureProduct("nan","bombilla",NaN)];
    catalog[0].variants[0].available=false; delete catalog[1].variants[0].commerceId;
    expect(recommendForCart(catalog,[source("mate",5000)],{})).toEqual([]);
    expect(toCartCatalog([{...fixtureProduct("editorial","mate",500),editorial:true} as unknown as Product])).toEqual([]);
    expect(recommendForCart([],[],{})).toEqual([]);
  });
  it("classifies using stable taxonomy and identifiers regardless of displayed language", () => {
    expect(complementFamily({id:"a",slug:"limpia-bombillas",category:"bombillas",attributes:{}})).toBe("limpiabombillas");
    expect(complementFamily({id:"a",slug:"a",category:"yerberos",attributes:{}})).toBe("yerbero");
    expect(complementFamily({id:"a",slug:"a",category:"personalizados",attributes:{"tipo-personalizado":"matera"}})).toBe("matera");
  });
  it("permits quick add with one fixed combination but rejects choices and customization", () => {
    const product=fixtureProduct("plain","bombilla",500);
    expect(quickAddVariant(product)).toBe("plain-variant");
    expect(quickAddVariant({...product,variants:[...product.variants,...product.variants]})).toBeUndefined();
    expect(quickAddVariant({...product,purchaseAxes:[{code:"talle",label:"Talle",values:[]}]})).toBeUndefined();
    expect(quickAddVariant({...product,category:"personalizados"})).toBeUndefined();
    expect(quickAddVariant({...product,saleMode:"made_to_order"})).toBeUndefined();
    expect(quickAddVariant({...product,variants:[{...product.variants[0],options:{tamano:"todos"}}]})).toBeUndefined();
    expect(quickAddSelection({...product,variants:[{...product.variants[0],color:"negro"}],purchaseAxes:[{code:"talle",label:"Talle",values:[{value:"39",label:"39"}]}]})).toEqual({variantId:"plain-variant",optionValues:{color:"negro",talle:"39"}});
    expect(quickAddSelection({...product,variants:[{...product.variants[0],options:{color:"marron"}}]})).toEqual({variantId:"plain-variant",optionValues:{color:"marron"}});
    expect(quickAddVariant({...product,purchaseAxes:[{code:"talle",label:"Talle",values:[{value:"39",label:"39"},{value:"40",label:"40"}]}]})).toBeUndefined();
    expect(quickAddVariant({...product,variants:[{...product.variants[0],available:false}]})).toBeUndefined();
  });
});
