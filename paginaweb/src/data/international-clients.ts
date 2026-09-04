export const destinationCountries = [
  { code: "DE", mapId: "de", name: "Alemania", city: "Berlín", region: "Europa" },
  { code: "AR", mapId: "ar", name: "Argentina", city: "Buenos Aires", region: "América del Sur" },
  { code: "AU", mapId: "au", name: "Australia", city: "Sídney", region: "Oceanía" },
  { code: "BR", mapId: "br", name: "Brasil", city: "São Paulo", region: "América del Sur" },
  { code: "CL", mapId: "cl", name: "Chile", city: "Santiago", region: "América del Sur" },
  { code: "CR", mapId: "cr", name: "Costa Rica", city: "San José", region: "América Central" },
  { code: "AE", mapId: "ae", name: "Emiratos Árabes Unidos", city: "Dubái", region: "Medio Oriente" },
  { code: "ES", mapId: "es", name: "España", city: "Madrid", region: "Europa" },
  { code: "US", mapId: "us", name: "Estados Unidos", city: "Miami", region: "América del Norte" },
  { code: "FR", mapId: "fr", name: "Francia", city: "París", region: "Europa" },
  { code: "HN", mapId: "hn", name: "Honduras", city: "Tegucigalpa", region: "América Central" },
  { code: "IT", mapId: "it", name: "Italia", city: "Milán", region: "Europa" },
  { code: "MX", mapId: "mx", name: "México", city: "Ciudad de México", region: "América del Norte" },
  { code: "PY", mapId: "py", name: "Paraguay", city: "Asunción", region: "América del Sur" },
  { code: "GB", mapId: "gb", name: "Reino Unido", city: "Londres", region: "Europa" },
  { code: "RU", mapId: "ru", name: "Rusia", city: "Moscú", region: "Europa y Asia" },
  { code: "SG", mapId: "sg", name: "Singapur", city: "Singapur", region: "Asia" },
] as const;

export type DestinationCountry = (typeof destinationCountries)[number];
export type DestinationCode = DestinationCountry["code"];

export type TestimonialCountryCode = DestinationCode | "UY";

export type CustomerTestimonial = {
  id: string;
  quote: string;
  authorName: string;
  authorTitle: string;
  sourceLabel: string;
  countryCode: TestimonialCountryCode;
};

export const customerTestimonials: readonly CustomerTestimonial[] = [
  { id: "review-01", quote: "Llegaron justo para el partido de Uruguay. Muy buen trabajo; ¡vamo arriba Uruguay!", authorName: "Luis N.", authorTitle: "Australia", sourceLabel: "cliente", countryCode: "AU" },
  { id: "review-02", quote: "Gran variedad de mates y personalizaciones hermosas. Del 1 al 10, un 10.", authorName: "Yaquelin L.", authorTitle: "Uruguay", sourceLabel: "Google Maps", countryCode: "UY" },
  { id: "review-03", quote: "Tengo un imperial y un torpedo hechos por ustedes: los dos son excelentes.", authorName: "Fernando P.", authorTitle: "Uruguay", sourceLabel: "Google Maps", countryCode: "UY" },
  { id: "review-05", quote: "¡Lujo!", authorName: "Agustín Z.", authorTitle: "Uruguay", sourceLabel: "Google Maps", countryCode: "UY" },
  { id: "review-06", quote: "Excelente calidad y terminación. ¡Súper conforme!", authorName: "Luz del Alba H.", authorTitle: "Uruguay", sourceLabel: "Google Maps", countryCode: "UY" },
  { id: "review-07", quote: "El juego es una belleza. ¡Enamorada!", authorName: "Laura B.", authorTitle: "Uruguay", sourceLabel: "Google Maps", countryCode: "UY" },
  { id: "review-08", quote: "La matera es muy linda y todo llegó muy rápido. ¡Muchas gracias!", authorName: "Yayra D.", authorTitle: "Uruguay", sourceLabel: "Google Maps", countryCode: "UY" },
  { id: "review-09", quote: "Muy lindo trabajo y excelente calidad.", authorName: "Josefina R.", authorTitle: "Uruguay", sourceLabel: "Google Maps", countryCode: "UY" },
  { id: "review-10", quote: "Muy buen producto. ¡Muchas gracias! Recomiendo.", authorName: "Ignacio S.", authorTitle: "Uruguay", sourceLabel: "Google Maps", countryCode: "UY" },
  { id: "review-11", quote: "Súper recomendable: muy buena atención, rapidez y excelente calidad.", authorName: "Lucas M.", authorTitle: "Uruguay", sourceLabel: "Google Maps", countryCode: "UY" },
  { id: "review-12", quote: "Gran trabajo: hermoso cuchillo, rapidez y mucha amabilidad. 100% recomendados.", authorName: "Ian S.", authorTitle: "Uruguay", sourceLabel: "Google Maps", countryCode: "UY" },
] as const;

export const testimonialRows = [
  { id: "fila-uno", speed: "50s", direction: "left" as const, testimonials: customerTestimonials.slice(0, 6) },
  { id: "fila-dos", speed: "54s", direction: "right" as const, testimonials: customerTestimonials.slice(6, 12) },
] as const;

const destinationNames: Record<Exclude<Locale, "es">, Record<DestinationCode, { name: string; city: string; region: string }>> = {
  en: {
    DE: { name: "Germany", city: "Berlin", region: "Europe" }, AR: { name: "Argentina", city: "Buenos Aires", region: "South America" }, AU: { name: "Australia", city: "Sydney", region: "Oceania" }, BR: { name: "Brazil", city: "São Paulo", region: "South America" }, CL: { name: "Chile", city: "Santiago", region: "South America" }, CR: { name: "Costa Rica", city: "San José", region: "Central America" }, AE: { name: "United Arab Emirates", city: "Dubai", region: "Middle East" }, ES: { name: "Spain", city: "Madrid", region: "Europe" }, US: { name: "United States", city: "Miami", region: "North America" }, FR: { name: "France", city: "Paris", region: "Europe" }, HN: { name: "Honduras", city: "Tegucigalpa", region: "Central America" }, IT: { name: "Italy", city: "Milan", region: "Europe" }, MX: { name: "Mexico", city: "Mexico City", region: "North America" }, PY: { name: "Paraguay", city: "Asunción", region: "South America" }, GB: { name: "United Kingdom", city: "London", region: "Europe" }, RU: { name: "Russia", city: "Moscow", region: "Europe and Asia" }, SG: { name: "Singapore", city: "Singapore", region: "Asia" },
  },
  pt: {
    DE: { name: "Alemanha", city: "Berlim", region: "Europa" }, AR: { name: "Argentina", city: "Buenos Aires", region: "América do Sul" }, AU: { name: "Austrália", city: "Sydney", region: "Oceania" }, BR: { name: "Brasil", city: "São Paulo", region: "América do Sul" }, CL: { name: "Chile", city: "Santiago", region: "América do Sul" }, CR: { name: "Costa Rica", city: "San José", region: "América Central" }, AE: { name: "Emirados Árabes Unidos", city: "Dubai", region: "Oriente Médio" }, ES: { name: "Espanha", city: "Madri", region: "Europa" }, US: { name: "Estados Unidos", city: "Miami", region: "América do Norte" }, FR: { name: "França", city: "Paris", region: "Europa" }, HN: { name: "Honduras", city: "Tegucigalpa", region: "América Central" }, IT: { name: "Itália", city: "Milão", region: "Europa" }, MX: { name: "México", city: "Cidade do México", region: "América do Norte" }, PY: { name: "Paraguai", city: "Assunção", region: "América do Sul" }, GB: { name: "Reino Unido", city: "Londres", region: "Europa" }, RU: { name: "Rússia", city: "Moscou", region: "Europa e Ásia" }, SG: { name: "Singapura", city: "Singapura", region: "Ásia" },
  },
};

const testimonialQuotes: Record<Exclude<Locale, "es">, Record<string, string>> = {
  en: {
    "review-01": "They arrived just in time for Uruguay's match. Great work — let's go Uruguay!",
    "review-02": "A great variety of mates and beautiful customization. From 1 to 10, it's a 10.",
    "review-03": "I have an imperial and a torpedo made by you: both are excellent.",
    "review-05": "Outstanding!",
    "review-06": "Excellent quality and finish. I couldn't be happier!",
    "review-07": "The set is beautiful. I'm in love!",
    "review-08": "The matera is beautiful and everything arrived very quickly. Thank you so much!",
    "review-09": "Beautiful work and excellent quality.",
    "review-10": "A very good product. Thank you! Highly recommended.",
    "review-11": "Highly recommended: great service, speed and excellent quality.",
    "review-12": "Great work: a beautiful knife, fast service and wonderful attention. 100% recommended.",
  },
  pt: {
    "review-01": "Chegaram bem a tempo do jogo do Uruguai. Ótimo trabalho; vamos, Uruguai!",
    "review-02": "Grande variedade de mates e personalizações lindas. De 1 a 10, nota 10.",
    "review-03": "Tenho um imperial e um torpedo feitos por vocês: os dois são excelentes.",
    "review-05": "Um luxo!",
    "review-06": "Excelente qualidade e acabamento. Super satisfeita!",
    "review-07": "O conjunto é uma beleza. Apaixonada!",
    "review-08": "A matera é linda e tudo chegou muito rápido. Muito obrigada!",
    "review-09": "Trabalho muito bonito e excelente qualidade.",
    "review-10": "Produto muito bom. Muito obrigado! Recomendo.",
    "review-11": "Super recomendado: ótimo atendimento, rapidez e excelente qualidade.",
    "review-12": "Ótimo trabalho: faca linda, rapidez e muita gentileza. 100% recomendados.",
  },
};

export function getLocalizedInternationalData(locale: Locale) {
  if (locale === "es") return { destinations: destinationCountries, testimonialRows };
  const destinations = destinationCountries.map((destination) => ({ ...destination, ...destinationNames[locale][destination.code] }));
  const localizedTestimonials = customerTestimonials.map((testimonial) => ({
    ...testimonial,
    quote: testimonialQuotes[locale][testimonial.id],
    authorTitle: testimonial.countryCode === "AU" ? destinationNames[locale].AU.name : locale === "en" ? "Uruguay" : "Uruguai",
    sourceLabel: testimonial.sourceLabel === "cliente" ? (locale === "en" ? "customer" : "cliente") : testimonial.sourceLabel,
  }));
  return {
    destinations,
    testimonialRows: [
      { id: "fila-uno", speed: "50s", direction: "left" as const, testimonials: localizedTestimonials.slice(0, 6) },
      { id: "fila-dos", speed: "54s", direction: "right" as const, testimonials: localizedTestimonials.slice(6, 12) },
    ],
  };
}
import type { Locale } from "@/types/catalog";
