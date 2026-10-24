import { describe, expect, it } from "vitest";
import {
  filterAndSortCatalog,
  findMatchingVariantForColors,
  getProductColors,
  getColorSwatchBackground,
  getVariantColorBackground,
  getVariantColorHex,
  getVariantColorId,
  hasActiveCatalogFilters,
  matchVariantWithColor,
  parseCatalogFilters,
  writeCatalogFilters,
  type CatalogFilters,
} from "./catalog-filters";
import type { Product } from "@/types/catalog";

function product(id: string, priceUYU: number, overrides: Partial<Product["filterData"]> = {}) {
  return {
    product: {
      id,
      slug: id,
      name: id,
      category: "mates",
      eyebrow: "",
      summary: "",
      description: "",
      materials: [],
      filterData: { priceUYU, materials: ["cuero"], mateType: "imperial", ...overrides },
      images: [],
      variants: [],
    } satisfies Product,
  };
}

const defaults: CatalogFilters = { search: "", category: "todas", collections: [], prices: [], materials: [], closures: [], productTypes: [], colors: [], sort: "nuevo" };

describe("filtros del catálogo", () => {
  it("respeta los límites sin superponer rangos", () => {
    const entries = [product("2999", 2999), product("3000", 3000), product("4999", 4999), product("5000", 5000), product("6999", 6999), product("7000", 7000)];
    expect(filterAndSortCatalog(entries, { ...defaults, prices: ["menos-3000"] }).map(({ product }) => product.id)).toEqual(["2999"]);
    expect(filterAndSortCatalog(entries, { ...defaults, prices: ["3000-4999"] }).map(({ product }) => product.id)).toEqual(["3000", "4999"]);
    expect(filterAndSortCatalog(entries, { ...defaults, prices: ["5000-6999"] }).map(({ product }) => product.id)).toEqual(["5000", "6999"]);
    expect(filterAndSortCatalog(entries, { ...defaults, prices: ["7000-mas"] }).map(({ product }) => product.id)).toEqual(["7000"]);
  });

  it("incluye un producto en cada rango que contenga una variante disponible", () => {
    const cartera: Product = product("cartera", 4800).product;
    cartera.variants = [
      { id: "variante-4800", label: "Negra", value: "NEG", available: true, price: { amountMinor: 480000, currency: "UYU" } },
      { id: "variante-5150", label: "Dorada", value: "DOR", available: true, price: { amountMinor: 515000, currency: "UYU" } },
      { id: "variante-inactiva", label: "Premium", value: "PRE", available: false, price: { amountMinor: 750000, currency: "UYU" } },
    ];

    expect(filterAndSortCatalog([{ product: cartera }], { ...defaults, prices: ["3000-4999"] })).toHaveLength(1);
    expect(filterAndSortCatalog([{ product: cartera }], { ...defaults, prices: ["5000-6999"] })).toHaveLength(1);
    expect(filterAndSortCatalog([{ product: cartera }], { ...defaults, prices: ["7000-mas"] })).toHaveLength(0);
  });

  it("usa el precio editorial cuando no hay variantes con precio", () => {
    expect(filterAndSortCatalog([product("editorial", 3200)], { ...defaults, prices: ["3000-4999"] })).toHaveLength(1);
    expect(filterAndSortCatalog([product("editorial", 3200)], { ...defaults, prices: ["5000-6999"] })).toHaveLength(0);
  });

  it("combina grupos con AND y opciones de un mismo grupo con OR", () => {
    const entries: Array<{ product: Product }> = [
      product("imperial-cuero", 4500),
      product("camionero-acero", 5500, { materials: ["acero-inoxidable"], mateType: "camionero" }),
      product("imperial-alpaca", 3800, { materials: ["alpaca"], mateType: "imperial" }),
    ];
    const visible = filterAndSortCatalog(entries, { ...defaults, prices: ["3000-4999", "5000-6999"], materials: ["cuero", "alpaca"], productTypes: ["imperial"] });
    expect(visible.map(({ product }) => product.id)).toEqual(["imperial-alpaca", "imperial-cuero"]);
  });

  it("permite filtrar calzado de gamuza y charol como materiales propios", () => {
    const entries = [product("bota-gamuza", 4200, { materials: ["gamuza"] }), product("zueco-charol", 4200, { materials: ["charol"] }), product("bota-cuero", 4200)];
    expect(parseCatalogFilters(new URLSearchParams("material=gamuza")).materials).toEqual(["gamuza"]);
    expect(parseCatalogFilters(new URLSearchParams("material=charol")).materials).toEqual(["charol"]);
    expect(filterAndSortCatalog(entries, { ...defaults, materials: ["gamuza"] }).map(({ product }) => product.id)).toEqual(["bota-gamuza"]);
    expect(filterAndSortCatalog(entries, { ...defaults, materials: ["charol"] }).map(({ product }) => product.id)).toEqual(["zueco-charol"]);
  });

  it("lee, valida y vuelve a escribir parámetros repetibles", () => {
    const filters = parseCatalogFilters(new URLSearchParams("filter=matera&categoria=billeteras&coleccion=estribo&coleccion=alfonsina&coleccion=invalida&precio=menos-3000&precio=7000-mas&material=estampado&tipo=torpedo&orden=precio&precio=invalido&forma=ovalada"));
    expect(filters).toMatchObject({ search: "matera", category: "billeteras", collections: ["estribo", "alfonsina"], prices: ["menos-3000", "7000-mas"], materials: ["estampado"], productTypes: ["torpedo"], sort: "precio-asc" });
    expect(writeCatalogFilters(filters).get("filter")).toBe("matera");
    expect(filters).not.toHaveProperty("shapes");
    expect(writeCatalogFilters(filters).getAll("precio")).toEqual(["menos-3000", "7000-mas"]);
    expect(writeCatalogFilters(filters).getAll("material")).toEqual(["estampado"]);
    expect(writeCatalogFilters(filters).getAll("coleccion")).toEqual(["estribo", "alfonsina"]);
    expect(writeCatalogFilters(filters).has("forma")).toBe(false);
  });

  it("filtra por colección y combina varias colecciones con OR", () => {
    const estribo = product("mate-estribo", 4500).product;
    estribo.filterData.collection = "estribo";
    const uruguay = product("mate-uruguay", 4800).product;
    uruguay.filterData.collection = "uruguay";
    const sinColeccion = product("mate-clasico", 3900).product;

    const visible = filterAndSortCatalog(
      [{ product: estribo }, { product: uruguay }, { product: sinColeccion }],
      { ...defaults, collections: ["estribo", "alfonsina"] },
    );

    expect(visible.map(({ product }) => product.id)).toEqual(["mate-estribo"]);
  });

  it("busca por texto sin distinguir mayúsculas ni tildes", () => {
    const matera = product("matera-cuero", 4200).product;
    matera.name = "Matera Clásica";
    matera.category = "materas";
    matera.summary = "Hecha a mano en Paysandú";
    const termo = product("termo", 3500).product;
    termo.name = "Termo de acero";

    expect(filterAndSortCatalog([{ product: matera }, { product: termo }], { ...defaults, search: "matera clasica" }).map(({ product }) => product.id)).toEqual(["matera-cuero"]);
    expect(filterAndSortCatalog([{ product: matera }, { product: termo }], { ...defaults, search: "paysandu" }).map(({ product }) => product.id)).toEqual(["matera-cuero"]);
  });

  it("encuentra características por su nombre y valor legible", () => {
    const mate: Product = product("mate-natural", 4200).product;
    mate.attributes = { "tipo-virola": "lisa", tamano: "mediano" };
    mate.attributeDetails = [
      { code: "tipo-virola", label: "Tipo de virola", rawValue: "lisa", values: ["Lisa"] },
      { code: "tamano", label: "Tamaño", rawValue: "mediano", values: ["Mediano"] },
    ];
    const entries = [{ product: mate }, product("termo", 3500)];
    expect(filterAndSortCatalog(entries, { ...defaults, search: "virola lisa" }).map(item => item.product.id)).toEqual(["mate-natural"]);
    expect(filterAndSortCatalog(entries, { ...defaults, search: "tamaño mediano" }).map(item => item.product.id)).toEqual(["mate-natural"]);
  });

  it("redirige el filtro histórico a la categoría única", () => {
    const parsed = parseCatalogFilters(new URLSearchParams("categoria=mates-personalizados"));
    expect(parsed.category).toBe("personalizados");
    expect(parsed.sort).toBe("nuevo");
  });

  it("permite filtrar zuecos como categoría propia", () => {
    const zueco = product("zueco", 3200).product;
    zueco.category = "zuecos";
    const bota = product("bota", 3500).product;
    bota.category = "botas";
    const filters = parseCatalogFilters(new URLSearchParams("categoria=zuecos"));
    expect(filters.category).toBe("zuecos");
    expect(filterAndSortCatalog([{ product: zueco }, { product: bota }], filters).map(item => item.product.id)).toEqual(["zueco"]);
  });

  it("filtra zapatos por varias formas de cierre y conserva la selección en la URL", () => {
    const zapato: Product = product("zapato", 3800).product;
    zapato.category = "zapatos";
    zapato.attributes = { "tipo-cierre": ["con-cordones", "con-elastico"] };
    const bota: Product = product("bota", 4200).product;
    bota.category = "botas";
    bota.attributes = { "tipo-cierre": ["con-hebilla"] };
    const filters = parseCatalogFilters(new URLSearchParams("categoria=zapatos&cierre=con-cierre&cierre=con-cordones"));
    expect(filters).toMatchObject({ category: "zapatos", closures: ["con-cierre", "con-cordones"] });
    expect(writeCatalogFilters(filters).getAll("cierre")).toEqual(["con-cierre", "con-cordones"]);
    expect(filterAndSortCatalog([{ product: zapato }, { product: bota }], filters).map(item => item.product.id)).toEqual(["zapato"]);
    expect(filterAndSortCatalog([{ product: zapato }, { product: bota }], { ...defaults, closures: ["con-hebilla", "con-elastico"] })).toHaveLength(2);
    expect(filterAndSortCatalog([{ product: zapato }], { ...defaults, search: "cordones" })).toHaveLength(1);
  });

  it("muestra primero los productos modificados más recientemente y resuelve empates por nombre", () => {
    const entries: Array<{ product: Product }> = [
      { product: { ...product("Termo Stanley", 3500).product, lastModifiedAt: 100 } },
      { product: { ...product("Bombilla Pico de Loro", 1200).product, lastModifiedAt: 300 } },
      { product: { ...product("Mate Imperial", 4500).product, lastModifiedAt: 100 } },
    ];
    const sorted = filterAndSortCatalog(entries, defaults);
    expect(sorted.map(({ product }) => product.name)).toEqual([
      "Bombilla Pico de Loro",
      "Mate Imperial",
      "Termo Stanley",
    ]);
  });

  it("ordena precio y nombre en ambos sentidos", () => {
    const entries = [product("Zeta", 5000), product("Alfa", 3000), product("Beta", 4000)];
    expect(filterAndSortCatalog(entries, { ...defaults, sort: "precio-asc" }).map(({ product }) => product.id)).toEqual(["Alfa", "Beta", "Zeta"]);
    expect(filterAndSortCatalog(entries, { ...defaults, sort: "precio-desc" }).map(({ product }) => product.id)).toEqual(["Zeta", "Beta", "Alfa"]);
    expect(filterAndSortCatalog(entries, { ...defaults, sort: "nombre-asc" }).map(({ product }) => product.id)).toEqual(["Alfa", "Beta", "Zeta"]);
    expect(filterAndSortCatalog(entries, { ...defaults, sort: "nombre-desc" }).map(({ product }) => product.id)).toEqual(["Zeta", "Beta", "Alfa"]);
  });

  it("usa Nuevo por defecto y descarta enlaces antiguos de Destacados", () => {
    expect(parseCatalogFilters(new URLSearchParams()).sort).toBe("nuevo");
    expect(parseCatalogFilters(new URLSearchParams("orden=editorial")).sort).toBe("nuevo");
    expect(writeCatalogFilters(defaults).has("orden")).toBe(false);
  });

  it("reconoce y normaliza la categoria de kits materos", () => {
    const fromSingular = parseCatalogFilters(new URLSearchParams("categoria=kit-matero"));
    const fromPlural = parseCatalogFilters(new URLSearchParams("categoria=kits-materos"));
    expect(fromSingular.category).toBe("kits-materos");
    expect(fromPlural.category).toBe("kits-materos");
  });

  it("reconoce y normaliza la categoria de cuchillos", () => {
    const fromSingular = parseCatalogFilters(new URLSearchParams("categoria=cuchillo"));
    const fromPlural = parseCatalogFilters(new URLSearchParams("categoria=cuchillos"));
    expect(fromSingular.category).toBe("cuchillos");
    expect(fromPlural.category).toBe("cuchillos");
  });

  it("filtra tarjeteros como categoría propia", () => {
    expect(parseCatalogFilters(new URLSearchParams("categoria=tarjetero")).category).toBe("tarjeteros");
    const cardHolder = { product: { ...product("tarjetero", 2500).product, category: "tarjeteros" as const } };
    const wallet = { product: { ...product("billetera", 3000).product, category: "billeteras" as const } };
    expect(filterAndSortCatalog([cardHolder, wallet], { ...defaults, category: "tarjeteros" }).map(item => item.product.id)).toEqual(["tarjetero"]);
  });

  it("filtra los nuevos productos por categoría, material y color", () => {
    const entries: Array<{ product: Product }> = [
      {
        product: {
          ...product("bombillon-cincelado", 4200).product,
          category: "bombillas",
          filterData: { priceUYU: 4200, materials: ["plata"], productTypes: [], colors: ["marron"] },
        },
      },
      {
        product: {
          ...product("billetera-dama", 3500).product,
          category: "billeteras",
          filterData: { priceUYU: 3500, materials: ["cuero"], productTypes: [], colors: ["negro", "natural"] },
        },
      },
    ];
    const visible = filterAndSortCatalog(entries, { ...defaults, category: "bombillas", materials: ["plata"], colors: ["marron"] });
    expect(visible.map(({ product }) => product.id)).toEqual(["bombillon-cincelado"]);
  });

  it("reconoce colores de variantes y permite filtrar por ellos", () => {
    const p1: Product = {
      ...product("mate-camionero-cuero", 4000).product,
      variants: [
        { id: "v-negro", label: "Negro", value: "negro" },
        { id: "v-marron", label: "Marrón", value: "marron" },
      ],
      filterData: { priceUYU: 4000, materials: ["cuero"], productTypes: [] },
    };
    const p2: Product = {
      ...product("mate-imperial-rojo", 4500).product,
      variants: [
        { id: "v-rojo", label: "Rojo", value: "rojo" },
      ],
      filterData: { priceUYU: 4500, materials: ["cuero"], productTypes: [] },
    };

    const entries = [{ product: p1 }, { product: p2 }];

    const filteredNegro = filterAndSortCatalog(entries, { ...defaults, colors: ["negro"] });
    expect(filteredNegro.map(({ product }) => product.id)).toEqual(["mate-camionero-cuero"]);

    const filteredRojo = filterAndSortCatalog(entries, { ...defaults, colors: ["rojo"] });
    expect(filteredRojo.map(({ product }) => product.id)).toEqual(["mate-imperial-rojo"]);
  });

  it("representa y filtra colores combinados como una sola opción", () => {
    const mate: Product = product("mate-negro-blanco", 4500).product;
    mate.variants = [{ id: "negro-blanco", label: "Negro/Blanco", value: "NB", color: "negro-blanco", available: true }];
    expect(getVariantColorId("Negro / Blanco")).toBe("negro-blanco");
    expect(getProductColors(mate)).toEqual(["negro-blanco"]);
    expect(getColorSwatchBackground("negro-blanco")).toBe("linear-gradient(90deg, #241d1a 0 50%, #f5f5f5 50% 100%)");
    expect(getVariantColorBackground(mate.variants[0])).toBe(getColorSwatchBackground("negro-blanco"));
    expect(getColorSwatchBackground("beige-dorado")).toBe("linear-gradient(90deg, #dfd1b8 0 50%, #c9a859 50% 100%)");
    expect(filterAndSortCatalog([{ product: mate }], { ...defaults, colors: ["negro-blanco"] })).toHaveLength(1);
    expect(filterAndSortCatalog([{ product: mate }], { ...defaults, colors: ["negro"] })).toHaveLength(0);
    expect(findMatchingVariantForColors(mate, ["negro-blanco"])?.id).toBe("negro-blanco");
  });

  it("distingue Chocolate de Marrón al reconocer y filtrar variantes", () => {
    const mate: Product = product("mate-chocolate", 4500).product;
    mate.variants = [{ id: "chocolate", label: "Chocolate", value: "Chocolate", color: "chocolate", available: true }];
    expect(getVariantColorId("Chocolate")).toBe("chocolate");
    expect(matchVariantWithColor("Chocolate", "marron")).toBe(false);
    expect(matchVariantWithColor("Chocolate", "chocolate")).toBe(true);
    expect(getColorSwatchBackground("chocolate")).toBe("#4b2e24");
    expect(filterAndSortCatalog([{ product: mate }], { ...defaults, colors: ["chocolate"] })).toHaveLength(1);
    expect(filterAndSortCatalog([{ product: mate }], { ...defaults, colors: ["marron"] })).toHaveLength(0);
  });

  it("reconoce Mostaza y los nuevos colores combinados sin mezclarlos con sus componentes", () => {
    expect(getVariantColorId("Mostaza")).toBe("mostaza");
    expect(getVariantColorId("Chocolate/Mostaza")).toBe("mostaza-chocolate");
    expect(getVariantColorId("Beige/Marrón")).toBe("marron-beige");
    expect(matchVariantWithColor("Mostaza/Chocolate", "mostaza-chocolate")).toBe(true);
    expect(matchVariantWithColor("Mostaza/Chocolate", "mostaza")).toBe(false);
    expect(matchVariantWithColor("Mostaza/Chocolate", "chocolate")).toBe(false);
    expect(matchVariantWithColor("Marrón/Beige", "marron-beige")).toBe(true);
    expect(matchVariantWithColor("Marrón/Beige", "marron")).toBe(false);
    expect(matchVariantWithColor("Marrón/Beige", "beige")).toBe(false);
    expect(getColorSwatchBackground("mostaza-chocolate")).toBe("linear-gradient(90deg, #c49632 0 50%, #4b2e24 50% 100%)");
    expect(getColorSwatchBackground("marron-beige")).toBe("linear-gradient(90deg, #6c4530 0 50%, #dfd1b8 50% 100%)");
  });

  it("distingue Plateado de Blanco/Plateado", () => {
    const mate: Product = product("mate-plateado", 4500).product;
    mate.variants = [{ id: "plateado", label: "Plateado", value: "Plateado", color: "plateado", available: true }];
    expect(getVariantColorId("Plateado")).toBe("plateado");
    expect(getVariantColorId("Plateado/Blanco")).toBe("blanco-plateado");
    expect(matchVariantWithColor("Plateado", "plateado")).toBe(true);
    expect(matchVariantWithColor("Blanco/Plateado", "plateado")).toBe(false);
    expect(getColorSwatchBackground("plateado")).toBe("#c0c0c0");
    expect(filterAndSortCatalog([{ product: mate }], { ...defaults, colors: ["plateado"] })).toHaveLength(1);
    expect(filterAndSortCatalog([{ product: mate }], { ...defaults, colors: ["blanco-plateado"] })).toHaveLength(0);
  });

  it("reconoce Dorado/Natural como un solo color combinado", () => {
    const mate: Product = product("mate-dorado-natural", 4500).product;
    mate.variants = [{ id: "dorado-natural", label: "Dorado/Natural", value: "Dorado/Natural", color: "dorado-natural", available: true }];
    expect(getVariantColorId("Dorado/Natural")).toBe("dorado-natural");
    expect(getVariantColorId("Natural/Dorado")).toBe("dorado-natural");
    expect(matchVariantWithColor("Natural/Dorado", "dorado-natural")).toBe(true);
    expect(matchVariantWithColor("Dorado/Natural", "dorado")).toBe(false);
    expect(matchVariantWithColor("Dorado/Natural", "natural")).toBe(false);
    expect(getColorSwatchBackground("dorado-natural")).toBe("linear-gradient(90deg, #c9a859 0 50%, #cfaf79 50% 100%)");
    expect(filterAndSortCatalog([{ product: mate }], { ...defaults, colors: ["dorado-natural"] })).toHaveLength(1);
    expect(filterAndSortCatalog([{ product: mate }], { ...defaults, colors: ["natural"] })).toHaveLength(0);
  });

  it("reconoce Marrón/Rojo como un solo color combinado", () => {
    const mate: Product = product("mate-marron-rojo", 4500).product;
    mate.variants = [{ id: "marron-rojo", label: "Marrón/Rojo", value: "Marrón/Rojo", color: "marron-rojo", available: true }];
    expect(getVariantColorId("Marrón/Rojo")).toBe("marron-rojo");
    expect(getVariantColorId("Rojo/Marrón")).toBe("marron-rojo");
    expect(matchVariantWithColor("Rojo/Marrón", "marron-rojo")).toBe(true);
    expect(matchVariantWithColor("Marrón/Rojo", "marron")).toBe(false);
    expect(matchVariantWithColor("Marrón/Rojo", "rojo")).toBe(false);
    expect(getColorSwatchBackground("marron-rojo")).toBe("linear-gradient(90deg, #6c4530 0 50%, #a83232 50% 100%)");
    expect(filterAndSortCatalog([{ product: mate }], { ...defaults, colors: ["marron-rojo"] })).toHaveLength(1);
    expect(filterAndSortCatalog([{ product: mate }], { ...defaults, colors: ["marron"] })).toHaveLength(0);
  });

  it("prioriza el campo color explícito de las variantes", () => {
    const p: Product = {
      ...product("mate-imperial-especial", 5000).product,
      variants: [
        { id: "v-1", label: "Edición A", value: "ed-a", color: "cuero-crudo" },
        { id: "v-2", label: "Edición B (negro)", value: "ed-b", color: "marron" },
      ],
      filterData: { priceUYU: 5000, materials: ["cuero"], productTypes: [], colors: ["blanco"] },
    };

    // getProductColors prioriza los colores de las variantes sobre filterData
    const colors = getProductColors(p);
    expect(colors).toEqual(["cuero-crudo", "marron"]);

    // findMatchingVariantForColors busca primero por v.color
    const matchMarron = findMatchingVariantForColors(p, ["marron"]);
    expect(matchMarron?.id).toBe("v-2");

    // getVariantColorId y getVariantColorHex usan v.color directamente
    expect(getVariantColorId(p.variants[0])).toBe("cuero-crudo");
    expect(getVariantColorHex(p.variants[0])).toBe("#e8d9bb");
    expect(getVariantColorId(p.variants[1])).toBe("marron");
    expect(getVariantColorHex(p.variants[1])).toBe("#6c4530");
  });

  it("excluye colores que solo existen en variantes no disponibles", () => {
    const p: Product = {
      ...product("matera", 5000).product,
      filterData: { priceUYU: 5000, materials: ["cuero"], colors: ["negro", "beige"] },
      variants: [
        { id: "negra", label: "Negra", value: "NEG", color: "negro", available: true },
        { id: "beige", label: "Beige", value: "BEI", color: "beige", available: false },
      ],
    };

    expect(getProductColors(p)).toEqual(["negro"]);
    expect(filterAndSortCatalog([{ product: p }], { ...defaults, colors: ["negro"] })).toHaveLength(1);
    expect(filterAndSortCatalog([{ product: p }], { ...defaults, colors: ["beige"] })).toHaveLength(0);
  });

  it("reconoce y procesa correctamente los nuevos colores celeste, azul y beige", () => {
    expect(matchVariantWithColor("Mate Celeste Cielo", "celeste")).toBe(true);
    expect(matchVariantWithColor("Sky blue edition", "celeste")).toBe(true);
    expect(matchVariantWithColor("Mate Azul Marino", "azul")).toBe(true);
    expect(matchVariantWithColor("Blue classic", "azul")).toBe(true);
    expect(matchVariantWithColor("Mate Beige Suave", "beige")).toBe(true);
    expect(matchVariantWithColor("Color Arena", "beige")).toBe(true);

    expect(getVariantColorId("Celeste")).toBe("celeste");
    expect(getVariantColorId("Azul profundo")).toBe("azul");
    expect(getVariantColorId("Arena")).toBe("beige");
    expect(getVariantColorId("Beige claro")).toBe("beige");

    expect(getVariantColorHex("celeste")).toBe("#74acdf");
    expect(getVariantColorHex("azul")).toBe("#1e3a8a");
    expect(getVariantColorHex("beige")).toBe("#dfd1b8");
  });

  it("determina correctamente si existen filtros activos", () => {
    expect(hasActiveCatalogFilters(defaults)).toBe(false);
    expect(hasActiveCatalogFilters({ ...defaults, category: "mates" })).toBe(true);
    expect(hasActiveCatalogFilters({ ...defaults, collections: ["uruguay"] })).toBe(true);
    expect(hasActiveCatalogFilters({ ...defaults, prices: ["menos-3000"] })).toBe(true);
    expect(hasActiveCatalogFilters({ ...defaults, materials: ["cuero"] })).toBe(true);
    expect(hasActiveCatalogFilters({ ...defaults, productTypes: ["imperial"] })).toBe(true);
    expect(hasActiveCatalogFilters({ ...defaults, colors: ["negro"] })).toBe(true);
    expect(hasActiveCatalogFilters({ ...defaults, closures: ["con-cierre"] })).toBe(true);
  });

  it("reconoce formas femeninas y variantes reales como Ovalada Negra y Celeste", () => {
    expect(getVariantColorId("Ovalada Negra")).toBe("negro");
    expect(getVariantColorHex("Ovalada Negra")).toBe("#241d1a");
    expect(getVariantColorId("Celeste Seleccion Uruguaya")).toBe("celeste");
    expect(getVariantColorHex("Celeste Seleccion Uruguaya")).toBe("#74acdf");
    expect(getVariantColorId("Cuadrada Roja")).toBe("rojo");
    expect(getVariantColorHex("Cuadrada Roja")).toBe("#a83232");
  });

  it("conserva la forma como atributo descriptivo sin usarla para filtrar", () => {
    const matera: Product = {
      ...product("matera-ovalada", 3900).product,
      category: "materas",
      attributes: { forma: "ovalada" },
      filterData: { priceUYU: 3900, materials: ["cuero"] },
      variants: [
        { id: "beige-39", label: "Beige · Talle 39", value: "MAT-BEI-39", color: "beige", options: { color: "beige", talle: "39" }, available: true },
        { id: "negra-39", label: "Negro · Talle 39", value: "MAT-NEG-39", color: "negro", options: { color: "negro", talle: "39" }, available: true },
      ],
    };
    expect(matera.attributes?.forma).toBe("ovalada");
    expect(filterAndSortCatalog([{product:matera}], {...defaults,colors:["beige"]})).toHaveLength(1);
  });

  it("no convierte materiales metálicos en gris o dorado", () => {
    expect(getVariantColorId("Acero inoxidable")).toBeUndefined();
    expect(getVariantColorId("Plata artesanal")).toBeUndefined();
    expect(getVariantColorId("Bronce y cobre")).toBeUndefined();
    expect(getVariantColorId("Metálico")).toBe("metalico");
  });
});
