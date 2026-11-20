import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { es } from "@/content/es";
import type { Guia } from "@/content/guias";
import { Link } from "@/i18n/navigation";
import { buildWhatsAppUrl } from "@/lib/whatsapp";

// Guías (español, inglés y portugués): mismo diseño que las páginas de compras (purchase-policy-*), sin <p> ni <span>.

/** Texto con **negrita** y [enlaces](/ruta). Los enlaces externos abren en otra pestaña. */
function Texto({ texto }: { texto: string }) {
  const partes: ReactNode[] = [];
  const re = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)]+)\)/g;
  let ultimo = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(texto))) {
    if (m.index > ultimo) partes.push(texto.slice(ultimo, m.index));
    if (m[1]) partes.push(<strong key={m.index}>{m[1]}</strong>);
    else {
      const externo = /^https?:\/\//.test(m[3]);
      partes.push(<a key={m.index} href={m[3]} {...(externo ? { target: "_blank", rel: "noreferrer" } : {})}>{m[2]}</a>);
    }
    ultimo = m.index + m[0].length;
  }
  if (ultimo < texto.length) partes.push(texto.slice(ultimo));
  return <>{partes}</>;
}

async function Contacto() {
  const t = await getTranslations("purchasePolicy");
  const whatsapp = await getTranslations("whatsapp");
  const whatsappUrl = buildWhatsAppUrl(es.contact.phoneHref, whatsapp("message"));
  return (
    <section className="purchase-policy-contact">
      <h2>{t("contactTitle")}</h2>
      <div data-copy>{t("contactBody")}</div>
      <div>
        <a className="purchase-policy-whatsapp" href={whatsappUrl} target="_blank" rel="noreferrer">{t("whatsappAction")}</a>
        <a href={`mailto:${es.contact.email}`}>{es.contact.email}</a>
      </div>
    </section>
  );
}

export async function GuiaDetalle({ guia }: { guia: Guia }) {
  const t = await getTranslations("guidesPage");
  return (
    <main id="contenido" className="purchase-policy-page guide-page">
      <article className="purchase-policy-shell">
        <div className="purchase-policy-heading">
          <Link className="guide-back" href="/guias">{t("title")}</Link>
          <h1>{guia.titulo}</h1>
          {guia.intro.map((parrafo) => <div data-copy key={parrafo}><Texto texto={parrafo} /></div>)}
        </div>

        <div className="purchase-policy-content">
          {guia.secciones.map((seccion) => (
            <section key={seccion.titulo}>
              <h2>{seccion.titulo}</h2>
              {seccion.bloques.map((bloque, i) => {
                if (bloque.tipo === "parrafo") return <div data-copy key={i}><Texto texto={bloque.texto} /></div>;
                if (bloque.tipo === "lista") {
                  const Lista = bloque.ordenada ? "ol" : "ul";
                  return <Lista key={i}>{bloque.items.map((item) => <li key={item}><Texto texto={item} /></li>)}</Lista>;
                }
                return (
                  <table key={i} className="guide-table">
                    <thead><tr>{bloque.encabezado.map((c) => <th key={c} scope="col">{c}</th>)}</tr></thead>
                    <tbody>{bloque.filas.map((fila) => <tr key={fila.join()}>{fila.map((c, j) => <td key={j}><Texto texto={c} /></td>)}</tr>)}</tbody>
                  </table>
                );
              })}
            </section>
          ))}

          {guia.faq.length > 0 && (
            <section>
              <h2>{t("faq")}</h2>
              <dl className="guide-faq">
                {guia.faq.map((f) => (
                  <div key={f.pregunta}>
                    <dt>{f.pregunta}</dt>
                    <dd><Texto texto={f.respuesta} /></dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          {guia.seguir.length > 0 && (
            <section>
              <h2>{t("more")}</h2>
              <ul>{guia.seguir.map((item) => <li key={item}><Texto texto={item} /></li>)}</ul>
            </section>
          )}
        </div>

        <Contacto />
      </article>
    </main>
  );
}

export async function GuiasIndice({ guias }: { guias: Guia[] }) {
  const t = await getTranslations("guidesPage");
  return (
    <main id="contenido" className="purchase-policy-page guide-page">
      <div className="purchase-policy-shell">
        <div className="purchase-policy-heading">
          <h1>{t("title")}</h1>
          <div data-copy>{t("intro")}</div>
        </div>
        <div className="purchase-policy-content">
          {guias.map((guia) => (
            <section key={guia.slug}>
              <h2><Link href={{ pathname: "/guias/[slug]", params: { slug: guia.slug } }}>{guia.titulo}</Link></h2>
              <div data-copy>{guia.descripcion}</div>
              <div data-copy><Link className="guide-read" href={{ pathname: "/guias/[slug]", params: { slug: guia.slug } }}>{t("read")}</Link></div>
            </section>
          ))}
        </div>
        <Contacto />
      </div>
    </main>
  );
}
