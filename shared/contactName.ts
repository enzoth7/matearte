const nonPersonWords = new Set([
  "agencia", "apartamento", "asociados", "banco", "bombilla", "bombillas", "bombillon",
  "camionero", "cambio", "carpa", "carteleria", "cobranzas", "comprador", "cuero",
  "fifa", "ford", "imperial", "imp", "juegos", "liga", "local", "masajes",
  "mate", "matera", "mayorista", "pago", "pagos", "perros", "pico", "prensa",
  "producto", "publicidad", "regalo", "serigrafista", "servicios", "sitio",
  "sorteo", "taxi", "termo", "torpedo", "transporte", "uniformes", "venta", "virola",
  "web", "fanpack", "fundasol", "espoli", "lider",
]);
const particles = new Set(["de", "del", "la", "las", "los", "da", "do", "dos", "y", "van", "von"]);
const acronyms = new Set(["EEUU", "AUF", "BBVA", "DHL", "SA", "SRL", "ML", "BS", "AS", "CNF"]);
const shortNames = new Set(["ana", "eva", "leo", "luz", "sol", "mia", "rui"]);
const simpleLatinName = /^[\p{Script=Latin}\p{M}]+(?: [\p{Script=Latin}\p{M}]+){0,3}$/u;

export function formatContactName(value: string): string {
  const name = value.trim().replace(/\s+/g, " ");
  if (!simpleLatinName.test(name)) return name;
  const words = name.split(" ");
  if (words.some((word) => nonPersonWords.has(word.toLocaleLowerCase("es")))) return name;
  return words.map((word, index) => {
    const lower = word.toLocaleLowerCase("es");
    if (index > 0 && particles.has(lower)) return lower;
    if (acronyms.has(word)) return word;
    if (/^[A-ZÁÉÍÓÚÜÑ]{2,3}$/u.test(word) && !shortNames.has(lower)) return word;
    if (/[a-záéíóúüñ][A-ZÁÉÍÓÚÜÑ]/u.test(word)) return word;
    return lower[0].toLocaleUpperCase("es") + lower.slice(1);
  }).join(" ");
}
