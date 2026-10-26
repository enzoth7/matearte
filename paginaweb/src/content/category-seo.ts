import type { Locale } from "@/types/catalog";
import type { CategoryPageSlug } from "@/lib/catalog-filters";

/** Texto de cada página de categoría: título para buscadores, encabezado visible y una bajada corta. */
export type CategorySeoCopy = { title: string; heading: string; intro: string };

export const categorySeo: Record<CategoryPageSlug, Record<Locale, CategorySeoCopy>> = {
  mates: {
    es: { title: "Mates uruguayos hechos a mano", heading: "Mates", intro: "Mates imperial, camionero, torpedo y criollo en calabaza, cuero y cerámica, con virolas de alpaca, acero y plata." },
    en: { title: "Handmade Uruguayan mate gourds", heading: "Mate gourds", intro: "Imperial, camionero, torpedo and criollo mates in gourd, leather and ceramic, with alpaca, steel and silver rims." },
    pt: { title: "Cuias uruguaias feitas à mão", heading: "Cuias", intro: "Cuias imperial, camionero, torpedo e criollo em cabaça, couro e cerâmica, com virolas de alpaca, aço e prata." },
  },
  personalizados: {
    es: { title: "Mates personalizados hechos a mano", heading: "Mates personalizados", intro: "Mates con nombres, escudos y diseños grabados o aplicados en la virola y el fleje." },
    en: { title: "Personalized handmade mate gourds", heading: "Personalized mates", intro: "Mates with names, crests and designs engraved or applied on the rim and band." },
    pt: { title: "Cuias personalizadas feitas à mão", heading: "Cuias personalizadas", intro: "Cuias com nomes, escudos e desenhos gravados ou aplicados na virola e na faixa." },
  },
  bombillas: {
    es: { title: "Bombillas y bombillones de alpaca", heading: "Bombillas", intro: "Bombillas y bombillones de alpaca y acero, con pico de alpaca o bronce, en largos para cada mate." },
    en: { title: "Alpaca bombillas and mate straws", heading: "Bombillas", intro: "Alpaca and steel bombillas and bombillones, with alpaca or bronze tips, in lengths for every mate." },
    pt: { title: "Bombas de alpaca para chimarrão e mate", heading: "Bombas", intro: "Bombas e bombillones de alpaca e aço, com bico de alpaca ou bronze, em comprimentos para cada cuia." },
  },
  materas: {
    es: { title: "Materas de cuero hechas a mano", heading: "Materas", intro: "Materas de cuero ovaladas y cuadradas para llevar el termo, el mate y la yerba." },
    en: { title: "Handmade leather mate bags", heading: "Mate bags", intro: "Oval and square leather materas to carry the thermos, the mate and the yerba." },
    pt: { title: "Mateiras de couro feitas à mão", heading: "Mateiras", intro: "Mateiras de couro ovais e quadradas para levar a garrafa térmica, a cuia e a erva." },
  },
  termos: {
    es: { title: "Termos para mate", heading: "Termos", intro: "Termos de acero inoxidable para mate, también forrados en cuero." },
    en: { title: "Thermoses for mate", heading: "Thermoses", intro: "Stainless steel thermoses for mate, also covered in leather." },
    pt: { title: "Garrafas térmicas para mate", heading: "Garrafas térmicas", intro: "Garrafas térmicas de aço inoxidável para mate, também revestidas de couro." },
  },
  "kits-materos": {
    es: { title: "Kits materos de cuero", heading: "Kits materos", intro: "Kits materos con matera de cuero para llevar todo lo necesario para el mate." },
    en: { title: "Leather mate kits", heading: "Mate kits", intro: "Mate kits with a leather bag to carry everything you need for mate." },
    pt: { title: "Kits de mate em couro", heading: "Kits de mate", intro: "Kits de mate com mateira de couro para levar tudo o que o mate precisa." },
  },
  cuchillos: {
    es: { title: "Cuchillos artesanales", heading: "Cuchillos", intro: "Cuchillos con vaina de cuero." },
    en: { title: "Handcrafted knives", heading: "Knives", intro: "Knives with a leather sheath." },
    pt: { title: "Facas artesanais", heading: "Facas", intro: "Facas com bainha de couro." },
  },
  cintos: {
    es: { title: "Cintos de cuero hechos a mano", heading: "Cintos", intro: "Cintos de cuero con hebilla dorada o plateada, en distintos largos." },
    en: { title: "Handmade leather belts", heading: "Belts", intro: "Leather belts with gold or silver buckles, in several lengths." },
    pt: { title: "Cintos de couro feitos à mão", heading: "Cintos", intro: "Cintos de couro com fivela dourada ou prateada, em vários comprimentos." },
  },
  botas: {
    es: { title: "Botas de cuero hechas a mano", heading: "Botas", intro: "Botas de cuero de mujer y de hombre, cortas y largas, en todos los talles." },
    en: { title: "Handmade leather boots", heading: "Boots", intro: "Women's and men's leather boots, short and tall, in every size." },
    pt: { title: "Botas de couro feitas à mão", heading: "Botas", intro: "Botas de couro femininas e masculinas, curtas e longas, em todos os números." },
  },
  zuecos: {
    es: { title: "Zuecos de cuero hechos a mano", heading: "Zuecos", intro: "Zuecos de cuero en distintos colores y números." },
    en: { title: "Handmade leather clogs", heading: "Clogs", intro: "Leather clogs in several colors and sizes." },
    pt: { title: "Tamancos de couro feitos à mão", heading: "Tamancos", intro: "Tamancos de couro em várias cores e números." },
  },
  zapatos: {
    es: { title: "Zapatos de cuero hechos a mano", heading: "Zapatos", intro: "Zapatos de cuero en distintos modelos y números." },
    en: { title: "Handmade leather shoes", heading: "Shoes", intro: "Leather shoes in several styles and sizes." },
    pt: { title: "Sapatos de couro feitos à mão", heading: "Sapatos", intro: "Sapatos de couro em vários modelos e números." },
  },
  billeteras: {
    es: { title: "Billeteras de cuero hechas a mano", heading: "Billeteras", intro: "Billeteras de cuero de hombre y de mujer, en cuero liso y crudo." },
    en: { title: "Handmade leather wallets", heading: "Wallets", intro: "Men's and women's leather wallets, in smooth and raw leather." },
    pt: { title: "Carteiras de couro feitas à mão", heading: "Carteiras", intro: "Carteiras de couro masculinas e femininas, em couro liso e cru." },
  },
  tarjeteros: {
    es: { title: "Tarjeteros de cuero hechos a mano", heading: "Tarjeteros", intro: "Tarjeteros de cuero para llevar tarjetas y documentos." },
    en: { title: "Handmade leather card holders", heading: "Card holders", intro: "Leather card holders for cards and documents." },
    pt: { title: "Porta-cartões de couro feitos à mão", heading: "Porta-cartões", intro: "Porta-cartões de couro para cartões e documentos." },
  },
  carteras: {
    es: { title: "Carteras de cuero hechas a mano", heading: "Carteras", intro: "Carteras de cuero, también con espacio para el mate." },
    en: { title: "Handmade leather bags", heading: "Bags", intro: "Leather bags, some with room for the mate." },
    pt: { title: "Bolsas de couro feitas à mão", heading: "Bolsas", intro: "Bolsas de couro, algumas com espaço para a cuia." },
  },
};
