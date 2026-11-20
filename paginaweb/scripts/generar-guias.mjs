// Pasa las guías de `../marketing/guias/*.md` (español), `en/*.md` y `pt/*.md` a `src/content/guias.ts`,
// que es lo que lee la web. Cada traducción empieza con el mismo número que su original (1-, 2-…).
// Los textos se editan en los .md y después se corre: node scripts/generar-guias.mjs
//
// Formato de cada .md: frontmatter (ruta, titulo_seo, descripcion), un «# Título», los párrafos de
// introducción, secciones «## …» con párrafos, listas («- » o «1. ») y tablas, una sección
// «Preguntas frecuentes» con «**Pregunta**» y la respuesta debajo, y «Para seguir» con enlaces.

import fs from "node:fs";
import path from "node:path";

const ORIGEN = path.resolve("..", "marketing", "guias");
const DESTINO = path.resolve("src", "content", "guias.ts");

function leer(carpeta, archivo) {
  let texto = fs.readFileSync(path.join(carpeta, archivo), "utf8").replace(/\r\n/g, "\n").replace(/<!--[\s\S]*?-->/g, "");
  const meta = {};
  const fm = texto.match(/^---\n([\s\S]*?)\n---\n/);
  if (fm) {
    for (const linea of fm[1].split("\n")) {
      const i = linea.indexOf(":");
      if (i > 0) meta[linea.slice(0, i).trim()] = linea.slice(i + 1).trim();
    }
    texto = texto.slice(fm[0].length);
  }
  const lineas = texto.split("\n");
  let titulo = "";
  const intro = [];
  const secciones = [];
  let actual = null;
  let parrafo = [];
  const cerrarParrafo = () => {
    if (!parrafo.length) return;
    const t = parrafo.join(" ").trim();
    if (t) (actual ? actual.bloques.push({ tipo: "parrafo", texto: t }) : intro.push(t));
    parrafo = [];
  };
  for (let n = 0; n < lineas.length; n++) {
    const l = lineas[n];
    if (l.startsWith("# ")) { titulo = l.slice(2).trim(); continue; }
    if (l.startsWith("## ")) { cerrarParrafo(); actual = { titulo: l.slice(3).trim(), bloques: [] }; secciones.push(actual); continue; }
    if (!l.trim()) { cerrarParrafo(); continue; }
    if (/^(- |\d+\. )/.test(l)) {
      cerrarParrafo();
      const ordenada = /^\d+\. /.test(l);
      const items = [];
      while (n < lineas.length && /^(- |\d+\. )/.test(lineas[n])) { items.push(lineas[n].replace(/^(- |\d+\. )/, "").trim()); n++; }
      n--;
      actual.bloques.push({ tipo: "lista", ordenada, items });
      continue;
    }
    if (l.startsWith("|")) {
      cerrarParrafo();
      const filas = [];
      while (n < lineas.length && lineas[n].startsWith("|")) {
        const celdas = lineas[n].split("|").slice(1, -1).map((c) => c.trim());
        if (!celdas.every((c) => /^-+$/.test(c))) filas.push(celdas);
        n++;
      }
      n--;
      actual.bloques.push({ tipo: "tabla", encabezado: filas[0], filas: filas.slice(1) });
      continue;
    }
    parrafo.push(l.trim());
  }
  cerrarParrafo();

  // Preguntas frecuentes: «**Pregunta**» y la respuesta en el párrafo.
  const faq = [];
  const iFaq = secciones.findIndex((s) => /preguntas frecuentes|frequently asked questions|perguntas frequentes/i.test(s.titulo));
  if (iFaq >= 0) {
    for (const b of secciones[iFaq].bloques) {
      const m = b.tipo === "parrafo" && b.texto.match(/^\*\*(.+?)\*\*\s*(.*)$/);
      if (m && m[2]) faq.push({ pregunta: m[1].trim(), respuesta: m[2].trim() });
    }
    secciones.splice(iFaq, 1);
  }
  // Para seguir: los enlaces del final.
  let seguir = [];
  const iSeguir = secciones.findIndex((s) => /para seguir|keep reading|continue lendo/i.test(s.titulo));
  if (iSeguir >= 0) {
    seguir = secciones[iSeguir].bloques.flatMap((b) => (b.tipo === "lista" ? b.items : []));
    secciones.splice(iSeguir, 1);
  }
  const slug = (meta.ruta ?? "").split("/").filter(Boolean).pop() ?? "";
  const id = archivo.split("-")[0];
  if (!slug || !titulo) throw new Error(`A ${archivo} le falta la ruta o el título`);
  return { id, slug, titulo, tituloSeo: meta.titulo_seo ?? titulo, descripcion: meta.descripcion ?? "", intro, secciones, faq, seguir };
}

const IDIOMAS = { es: ORIGEN, en: path.join(ORIGEN, "en"), pt: path.join(ORIGEN, "pt") };
const guias = Object.fromEntries(
  Object.entries(IDIOMAS).map(([idioma, carpeta]) => [idioma, fs.readdirSync(carpeta).filter((a) => a.endsWith(".md")).sort().map((a) => leer(carpeta, a))]),
);
const ids = guias.es.map((g) => g.id).join();
for (const idioma of Object.keys(IDIOMAS)) {
  if (guias[idioma].map((g) => g.id).join() !== ids) throw new Error(`Las guías en «${idioma}» no coinciden con las de español`);
}
const ts = `// Generado por scripts/generar-guias.mjs desde marketing/guias/*.md. No editar a mano: editar los .md.

export type BloqueGuia =
  | { tipo: "parrafo"; texto: string }
  | { tipo: "lista"; ordenada: boolean; items: string[] }
  | { tipo: "tabla"; encabezado: string[]; filas: string[][] };

export type IdiomaGuia = "es" | "en" | "pt";

export type Guia = {
  /** Igual en los tres idiomas: une cada guía con sus traducciones. */
  id: string;
  slug: string;
  titulo: string;
  tituloSeo: string;
  descripcion: string;
  intro: string[];
  secciones: { titulo: string; bloques: BloqueGuia[] }[];
  faq: { pregunta: string; respuesta: string }[];
  seguir: string[];
};

export const guias: Record<IdiomaGuia, Guia[]> = ${JSON.stringify(guias, null, 2)};

export function guiaPorSlug(idioma: IdiomaGuia, slug: string): Guia | undefined {
  return guias[idioma].find((guia) => guia.slug === slug);
}

/** La misma guía en otro idioma: sirve para el selector de idioma, que conserva el slug. */
export function traduccionDeGuia(slug: string, idioma: IdiomaGuia): Guia | undefined {
  const id = Object.values(guias).flat().find((guia) => guia.slug === slug)?.id;
  return guias[idioma].find((guia) => guia.id === id);
}

export function slugsDeGuia(id: string): Record<IdiomaGuia, string> {
  const slug = (idioma: IdiomaGuia) => guias[idioma].find((guia) => guia.id === id)?.slug ?? "";
  return { es: slug("es"), en: slug("en"), pt: slug("pt") };
}
`;
fs.writeFileSync(DESTINO, ts);
for (const [idioma, lista] of Object.entries(guias)) console.log(`${idioma}: ${lista.map((g) => g.slug).join(", ")}`);
