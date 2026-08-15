export const destinationCountries = [
  { code: "RU", mapId: "ru", name: "Rusia", city: "Moscú", region: "Europa y Asia" },
  { code: "GB", mapId: "gb", name: "Reino Unido", city: "Londres", region: "Europa" },
  { code: "IT", mapId: "it", name: "Italia", city: "Milán", region: "Europa" },
  { code: "ES", mapId: "es", name: "España", city: "Madrid", region: "Europa" },
  { code: "FR", mapId: "fr", name: "Francia", city: "París", region: "Europa" },
  { code: "HN", mapId: "hn", name: "Honduras", city: "Tegucigalpa", region: "América Central" },
  { code: "US", mapId: "us", name: "Estados Unidos", city: "Miami", region: "América del Norte" },
  { code: "CL", mapId: "cl", name: "Chile", city: "Santiago", region: "América del Sur" },
  { code: "AR", mapId: "ar", name: "Argentina", city: "Buenos Aires", region: "América del Sur" },
  { code: "BR", mapId: "br", name: "Brasil", city: "São Paulo", region: "América del Sur" },
  { code: "CR", mapId: "cr", name: "Costa Rica", city: "San José", region: "América Central" },
  { code: "SG", mapId: "sg", name: "Singapur", city: "Singapur", region: "Asia" },
  { code: "MX", mapId: "mx", name: "México", city: "Ciudad de México", region: "América del Norte" },
] as const;

export type DestinationCountry = (typeof destinationCountries)[number];
export type DestinationCode = DestinationCountry["code"];

export type DemoTestimonial = {
  id: string;
  quote: string;
  authorName: string;
  authorTitle: string;
  countryCode: DestinationCode;
  isDemo: true;
};

export const demoTestimonials: readonly DemoTestimonial[] = [
  { id: "demo-01", quote: "El mate llegó con una presencia increíble y se volvió parte de nuestro ritual de cada mañana.", authorName: "Lucía R.", authorTitle: "Madrid, España", countryCode: "ES", isDemo: true },
  { id: "demo-02", quote: "Se nota el trabajo manual en cada terminación. Es una pieza para usar y también para conservar.", authorName: "Marco B.", authorTitle: "Milán, Italia", countryCode: "IT", isDemo: true },
  { id: "demo-03", quote: "Buscábamos un regalo con identidad uruguaya y la personalización lo hizo verdaderamente único.", authorName: "Camila S.", authorTitle: "Miami, Estados Unidos", countryCode: "US", isDemo: true },
  { id: "demo-04", quote: "La combinación de cuero y metal se siente honesta, sobria y muy bien resuelta.", authorName: "Sophie L.", authorTitle: "París, Francia", countryCode: "FR", isDemo: true },
  { id: "demo-05", quote: "Llegó a Chile con el cuidado de una pieza especial. El empaque acompañó muy bien la experiencia.", authorName: "Tomás V.", authorTitle: "Santiago, Chile", countryCode: "CL", isDemo: true },
  { id: "demo-06", quote: "Una forma preciosa de mantener cerca el ritual del mate estando lejos del Río de la Plata.", authorName: "Valentina M.", authorTitle: "Londres, Reino Unido", countryCode: "GB", isDemo: true },
  { id: "demo-07", quote: "El grabado quedó delicado y preciso. El resultado superó lo que imaginábamos para el regalo.", authorName: "Mateo C.", authorTitle: "San José, Costa Rica", countryCode: "CR", isDemo: true },
  { id: "demo-08", quote: "Tiene carácter uruguayo sin perder una estética contemporánea. Se reconoce el oficio.", authorName: "Renata A.", authorTitle: "São Paulo, Brasil", countryCode: "BR", isDemo: true },
  { id: "demo-09", quote: "La distancia no le quitó cercanía al proceso; pudimos seguir cada decisión de la personalización.", authorName: "Elena K.", authorTitle: "Moscú, Rusia", countryCode: "RU", isDemo: true },
  { id: "demo-10", quote: "Es un objeto cotidiano que cuenta de dónde viene. Eso fue lo que más nos gustó.", authorName: "Diego F.", authorTitle: "Ciudad de México, México", countryCode: "MX", isDemo: true },
  { id: "demo-11", quote: "Los materiales se sienten nobles y la forma es muy cómoda. Se volvió mi mate de todos los días.", authorName: "Martina P.", authorTitle: "Buenos Aires, Argentina", countryCode: "AR", isDemo: true },
  { id: "demo-12", quote: "Desde Paysandú hasta Singapur: una pieza pequeña que trae consigo una cultura enorme.", authorName: "Noah T.", authorTitle: "Singapur", countryCode: "SG", isDemo: true },
  { id: "demo-13", quote: "La atención al detalle aparece en las costuras, el calce y el acabado del metal.", authorName: "Andrea G.", authorTitle: "Tegucigalpa, Honduras", countryCode: "HN", isDemo: true },
  { id: "demo-14", quote: "El mate personalizado fue el regalo más comentado de la celebración.", authorName: "Javier N.", authorTitle: "Barcelona, España", countryCode: "ES", isDemo: true },
  { id: "demo-15", quote: "Tradición y diseño en el equilibrio justo. Se siente artesanal sin verse antiguo.", authorName: "Giulia P.", authorTitle: "Roma, Italia", countryCode: "IT", isDemo: true },
  { id: "demo-16", quote: "Queríamos llevar un recuerdo auténtico de Uruguay y encontramos algo hecho para durar.", authorName: "Claire D.", authorTitle: "Lyon, Francia", countryCode: "FR", isDemo: true },
  { id: "demo-17", quote: "La matera viajó muy bien y tiene el tamaño perfecto para acompañarnos todos los días.", authorName: "Ben H.", authorTitle: "Manchester, Reino Unido", countryCode: "GB", isDemo: true },
  { id: "demo-18", quote: "El proceso fue claro y el resultado conserva esa calidez que solo tienen las piezas hechas a mano.", authorName: "Fernanda O.", authorTitle: "Monterrey, México", countryCode: "MX", isDemo: true },
  { id: "demo-19", quote: "Una pieza de Paysandú que ahora acompaña nuestras reuniones en São Paulo.", authorName: "Rafael C.", authorTitle: "São Paulo, Brasil", countryCode: "BR", isDemo: true },
  { id: "demo-20", quote: "La historia detrás del objeto hace que compartir un mate también sea compartir un origen.", authorName: "Agustina E.", authorTitle: "Córdoba, Argentina", countryCode: "AR", isDemo: true },
] as const;

export const testimonialRows = [
  { id: "fila-uno", speed: "68s", direction: "left" as const, testimonials: demoTestimonials.slice(0, 10) },
  { id: "fila-dos", speed: "74s", direction: "right" as const, testimonials: demoTestimonials.slice(10, 20) },
] as const;
