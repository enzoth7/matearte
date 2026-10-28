import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { FileArrowUp, MagnifyingGlass, PencilSimple, Plus, Trash, UserPlus } from "@phosphor-icons/react";
import type { PageProps } from "./pages";
import { money, today, type Customer, type Product } from "./data";
import { allowedSalesChannels } from "./access";
import { commerceSource } from "./commerceSource";
import { salePriceMinor, usesBasePrice } from "./localSalePricing";
import { matchesSaleProductSearch } from "./saleProductSearch";
import { countryOptions } from "./location";
import { customerDepartments } from "./customerLocation";
import {
  buildLocalPersonalizationSnapshot,
  createPersonalizationDraft,
  mateCharacteristicDetails,
  matePurchaseAxes,
  personalizationKind,
  productHasFleje,
  validatePersonalization,
  type LocalPersonalizationDraft,
  type PersonalizationKind,
  type StoredPersonalizationAsset,
} from "./localPersonalization";
import { calculateLocalPersonalizationPrice, parsePublishedLocalPricing, type PublishedLocalPricing } from "./localPersonalizationPricing";
import { CustomArticlePicker } from "./CustomArticlePicker";
import { MateAssemblyPicker } from "./MateAssemblyPicker";
import { captureLocalDesign } from "./localDesignPreviews";
import { mateAssemblyPresentation } from "./mateAssemblyPresentation";
import { assemblyHasFleje, priceMateAssembly, type MateAssembly } from "../../shared/mate-assembly";
import { LocalMateDesignPreview } from "./LocalMateDesignPreview";
import { formatDate } from "./dateFormat";
import { formatPercent, parseDiscountPercent } from "./wholesaleDiscount";
import { catalogValueLabel, defaultCatalogTaxonomy, normalizeCatalogValueMap } from "../../shared/catalog-taxonomy";

type SaleLine = { id: string; product: Product; quantity: number; unitPriceMinor: number; priceEntered?: boolean; priceOverridden?: boolean; personalization?: LocalPersonalizationDraft; notes?: string };
const cents = (value: string) => Math.round(Number(value.replace(",", ".")) * 100);
const categoryKey = (product: Product) => product.categoryCode || product.family;
const isService = (product: Product) => categoryKey(product) === "servicios";
const retailType = (product: Product) => {
  if (product.catalogType) return product.catalogType;
  const name = normalizeSearch(product.name);
  const category = normalizeSearch(categoryKey(product));
  if (category.includes("mate") && !category.includes("matera")) return ({ imperial: "Imperial", camionero: "Camionero", criollo: "Criollo", torpedo: "Torpedo" } as Record<string, string>)[name.match(/(imperial|camionero|criollo|torpedo)/)?.[1] || ""] || "General";
  if (category.includes("matera")) return ({ ovalada: "Ovalada", cuadrada: "Cuadrada" } as Record<string, string>)[name.match(/(ovalada|cuadrada)/)?.[1] || ""] || "General";
  if (category.includes("bombilla")) return /bombillon/.test(name) ? "Bombillón" : "Bombilla";
  return "General";
};
const hasVariableServicePrice = (product: Product) => isService(product) && product.prices.Local === 0;
const normalizeSearch = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase();
const visibleVariant = (value: string) => value.split(/\s*[·|]\s*/)
  .filter((part) => !["tamano todos los tamanos", "todos los tamanos"].includes(normalizeSearch(part.trim())))
  .join(" · ").trim();
const customizableKind = (product: Product): PersonalizationKind | null => {
  const category = normalizeSearch(categoryKey(product));
  if (category === "mates") return "mate";
  if (category === "materas") return "matera";
  if (category.startsWith("bombill")) return "bombilla";
  return personalizationKind(product);
};
const contentUsesText = (value: LocalPersonalizationDraft["rimContent"]) => value === "text" || value === "text-logo";
const contentUsesLogo = (value: LocalPersonalizationDraft["rimContent"]) => value === "logo" || value === "text-logo";
const techniqueOptions = [
  ["none", "Sin personalizar"],
  ["laser", "Grabado láser"],
  ["bronze-applique", "Aplique de bronce"],
  ["alpaca-applique", "Aplique de alpaca"],
] as const;
const contentOptions = [["text", "Texto"], ["logo", "Logo o imagen"], ["text-logo", "Texto y logo"]] as const;
const rimFinishOptions = [["none", "Lisa, sin terminación"], ["finish-1", "Laureles"], ["frame-1", "Sol"], ["frame-5", "Azteca"], ["frame-25", "Hojas"], ["applique-finish-espirales", "Espirales"], ["applique-finish-triangulos", "Triángulos"], ["applique-finish-escamas", "Escamas"], ["applique-finish-coronas", "Coronas"]] as const;
const flejeFinishOptions = [["none", "Liso, sin terminación"], ["pattern-1", "Laurel"], ["frame-25", "Azteca"], ["frame-26", "Sol"], ["frame-27", "Abstracta"], ["frame-28", "Griego"], ["frame-29", "Floral"], ["frame-30", "Guarda pampa"]] as const;
const uploadTypes = new Set(["image/png", "image/jpeg", "image/svg+xml", "application/pdf"]);

const mateFacet = (product: Product, code: "tipo-cuero" | "tipo-virola" | "color") => {
  if (code === "color") return String(product.options?.color || product.variant || "");
  const attributes = normalizeCatalogValueMap(product.attributes);
  return String(attributes[code] || (code === "tipo-cuero" ? attributes["material-mate"] || product.leather : product.rim) || "");
};
const mateModel = (product: Product) => {
  const value = normalizeCatalogValueMap(product.attributes)["tipo-mate"];
  if (typeof value === "string") return catalogValueLabel(defaultCatalogTaxonomy, "tipo-mate", value);
  return product.catalogType || product.name.match(/\b(imperial|camionero|criollo|torpedo)\b/i)?.[1] || product.name;
};

function PersonalizationFields({ line, index, update, replaceProduct, mateProducts, reportError, pricing, pricingLoading }: {
  line: SaleLine;
  index: number;
  update: (changes: Partial<LocalPersonalizationDraft>) => void;
  replaceProduct: (product: Product) => void;
  mateProducts: Product[];
  reportError: (message: string) => void;
  pricing: PublishedLocalPricing | null;
  pricingLoading: boolean;
  updateAssembly: (assembly: MateAssembly) => void;
}) {
  const draft = line.personalization!;
  const [mateStepIndex, setMateStepIndex] = useState(line.product.assembly ? 0 : 4);
  const mateSteps = [...(line.product.assembly ? [] : ["Modelo", "Textura y color", "Metal", "Tamaño e interior"]), ...(line.product.assembly?.["tipo-virola"] === "sin-virola" ? [] : ["Virola"]), ...(productHasFleje(line.product) ? ["Fleje"] : []), ...(line.product.assembly ? [] : ["Resumen"])];
  useEffect(() => setMateStepIndex(current => Math.max(0, Math.min(current, mateSteps.length - 1))), [mateSteps.length]);
  const mateStep = mateSteps[mateStepIndex] || (line.product.assembly ? "" : "Modelo");
  const mateDetails = draft.kind === "mate" ? mateCharacteristicDetails(line.product) : [];
  const mateAxes = draft.kind === "mate" ? matePurchaseAxes(line.product) : [];
  const sameModel = mateProducts.filter(product => mateModel(product) === mateModel(line.product));
  const sameTexture = sameModel.filter(product => mateFacet(product, "tipo-cuero") === mateFacet(line.product, "tipo-cuero"));
  const sameColor = sameTexture.filter(product => mateFacet(product, "color") === mateFacet(line.product, "color"));
  const facetOptions = (products: Product[], code: "tipo-cuero" | "tipo-virola" | "color") => [...new Map<string, Product>(products.map(product => [mateFacet(product, code), product] as const).filter(([value]) => Boolean(value))).entries()];
  const facetButtons = (products: Product[], code: "tipo-cuero" | "tipo-virola" | "color") => <div className="local-mate-facets">{facetOptions(products, code).map(([value, product]) => <button key={value} type="button" aria-pressed={value === mateFacet(line.product, code)} onClick={() => replaceProduct(product)}>{catalogValueLabel(defaultCatalogTaxonomy, code, value)}</button>)}</div>;
  const detailsFor = (codes: string[]) => mateDetails.filter(detail => codes.includes(detail.code));
  const characteristics = (details: typeof mateDetails) => <dl className="local-mate-characteristics">{details.map(detail => <div key={detail.code}><dt>{detail.label}</dt><dd>{detail.values.join(", ")}</dd></div>)}</dl>;
  const quote = calculateLocalPersonalizationPrice(draft, pricing);
  const needsMateLogo = draft.kind === "mate" && ((draft.rimTechnique !== "none" && contentUsesLogo(draft.rimContent)) || (draft.flejeTechnique !== "none" && contentUsesLogo(draft.flejeContent)));
  const needsMateraLogo = draft.kind === "matera" && contentUsesLogo(draft.materaContent);
  const needsBombillaLogo = draft.kind === "bombilla" && contentUsesLogo(draft.bombillaContent);
  const onFile = (field: "rimLogoFile" | "flejeLogoFile" | "materaLogoFile" | "bombillaLogoFile") => (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    if (file && (!uploadTypes.has(file.type) || file.size > 10 * 1024 * 1024)) {
      event.target.value = "";
      update({ [field]: null });
      reportError("El archivo debe ser PNG, JPG, SVG o PDF y pesar hasta 10 MB.");
      return;
    }
    update({ [field]: file });
    reportError("");
  };

  return <article className="local-personalization-card">
    <header className="local-personalization-card-heading">
      <div><small>Diseño de {draft.kind} {index + 1}</small><h3>{line.product.name}</h3></div>
      {line.quantity > 1 && <strong>Se aplica a {line.quantity} unidades</strong>}
    </header>

    {draft.kind === "mate" && mateSteps.length > 1 && <nav className="local-mate-steps" aria-label={`Pasos del diseño de ${line.product.name}`}>
      {mateSteps.map((label, step) => <button key={label} type="button" aria-current={mateStepIndex === step ? "step" : undefined} className={mateStepIndex === step ? "active" : ""} onClick={() => setMateStepIndex(step)}><span>{step + 1}</span>{label}</button>)}
    </nav>}

    {draft.kind === "mate" ? <div className="local-personalization-body">
      {mateStep === "Modelo" && <section className="local-personalization-surface">
        <div className="local-personalization-surface-title"><strong>Modelo y características</strong><small>Se toman del mate base seleccionado arriba</small></div>
        <div className="local-mate-facets">{[...new Map(mateProducts.map(product => [mateModel(product), product])).entries()].map(([model, product]) => <button key={model} type="button" aria-pressed={mateModel(line.product) === model} onClick={() => replaceProduct(product)}>{model}</button>)}</div>
        <div className="local-mate-base"><strong>{line.product.name}</strong><span>SKU {line.product.sku || "—"}</span></div>
        {mateDetails.length ? characteristics(mateDetails) : <p>Este mate no tiene características cargadas en el catálogo.</p>}
      </section>}
      {mateStep === "Textura y color" && <section className="local-personalization-surface">
        <div className="local-personalization-surface-title"><strong>Textura y color</strong><small>Opciones disponibles para este modelo</small></div>
        <div className="local-mate-choice"><strong>Textura o cuero</strong>{facetButtons(sameModel, "tipo-cuero")}</div>
        <div className="local-mate-choice"><strong>Color</strong>{facetButtons(sameTexture, "color")}</div>
        {characteristics(detailsFor(["material-mate", "tipo-cuero", "material"]))}
        <div className="local-mate-base"><strong>Color</strong><span>{typeof line.product.options?.color === "string" ? catalogValueLabel(defaultCatalogTaxonomy, "color", line.product.options.color) : visibleVariant(line.product.variant)}</span></div>
      </section>}
      {mateStep === "Metal" && <section className="local-personalization-surface">
        <div className="local-personalization-surface-title"><strong>Metal y detalles</strong><small>Opciones disponibles con este cuero y color</small></div>
        <div className="local-mate-choice"><strong>Virola</strong>{facetButtons(sameColor.length ? sameColor : sameTexture, "tipo-virola")}</div>
        {characteristics(detailsFor(["tipo-virola", "diseno-fleje", "posamate"]))}
      </section>}
      {mateStep === "Tamaño e interior" && <section className="local-personalization-surface">
        <div className="local-personalization-surface-title"><strong>Tamaño e interior</strong><small>Elegí las opciones disponibles para este mate</small></div>
        {mateAxes.map(axis => <fieldset key={axis.code} className="local-mate-choice"><legend>{axis.label}</legend>{!axis.values.length ? <p>Falta configurar esta opción en el catálogo.</p> : <div>{axis.values.map(option => <button key={option.value} type="button" aria-pressed={draft.selectedOptions[axis.code] === option.value} onClick={() => update({ selectedOptions: { ...draft.selectedOptions, [axis.code]: option.value } })}>{option.label}</button>)}</div>}</fieldset>)}
      </section>}
      {mateStep === "Resumen" && <section className="local-personalization-surface">
        <div className="local-personalization-surface-title"><strong>Resumen del mate</strong><small>Revisá las elecciones antes de guardar</small></div>
        {characteristics(mateDetails.filter(detail => detail.code !== "tamano" && detail.code !== "interior"))}
        {characteristics(mateAxes.map(axis => ({ code: axis.code, label: axis.label, values: [axis.values.find(option => option.value === draft.selectedOptions[axis.code])?.label || "Pendiente de elegir"], rawValue: draft.selectedOptions[axis.code] || "" })))}
      </section>}
      {mateStep === "Virola" && <section className="local-personalization-surface">
        <div className="local-personalization-surface-title"><strong>Virola</strong><small>Elegí técnica, contenido y terminación</small></div>
        <div className="local-personalization-fields">
          <label>Técnica<select aria-label={`Técnica de virola de ${line.product.name}`} value={draft.rimTechnique} onChange={(event) => update({ rimTechnique: event.target.value as LocalPersonalizationDraft["rimTechnique"] })}>{techniqueOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          {draft.rimTechnique !== "none" && <>
            <label>Contenido<select aria-label={`Contenido de virola de ${line.product.name}`} value={draft.rimContent} onChange={(event) => update({ rimContent: event.target.value as LocalPersonalizationDraft["rimContent"] })}>{contentOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label>Terminación<select aria-label={`Terminación de virola de ${line.product.name}`} value={draft.rimFinish} onChange={(event) => update({ rimFinish: event.target.value })}>{rimFinishOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            {contentUsesText(draft.rimContent) && <label className="local-personalization-text">Texto de la virola<input aria-label={`Texto de virola de ${line.product.name}`} value={draft.rimText} onChange={(event) => update({ rimText: event.target.value.toLocaleUpperCase("es").slice(0, 40) })} maxLength={40} placeholder="Texto exacto a grabar" required /></label>}
          </>}
        </div>
      </section>}

      {mateStep === "Fleje" && productHasFleje(line.product) && <section className="local-personalization-surface">
        <div className="local-personalization-surface-title"><strong>Fleje</strong><small>El frente y el dorso se registran por separado</small></div>
        <div className="local-personalization-fields">
            <label>Técnica<select aria-label={`Técnica de fleje de ${line.product.name}`} value={draft.flejeTechnique} onChange={(event) => update({ flejeTechnique: event.target.value as LocalPersonalizationDraft["flejeTechnique"] })}>{techniqueOptions.filter(([value]) => value !== "laser").map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          {draft.flejeTechnique !== "none" && <>
            <label>Contenido<select aria-label={`Contenido de fleje de ${line.product.name}`} value={draft.flejeContent} onChange={(event) => update({ flejeContent: event.target.value as LocalPersonalizationDraft["flejeContent"] })}>{contentOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label>Terminación<select aria-label={`Terminación de fleje de ${line.product.name}`} value={draft.flejeFinish} onChange={(event) => update({ flejeFinish: event.target.value })}>{flejeFinishOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            {contentUsesText(draft.flejeContent) && <>
              <label>Texto del frente<input aria-label={`Texto del frente del fleje de ${line.product.name}`} value={draft.flejeFrontText} onChange={(event) => update({ flejeFrontText: event.target.value.toLocaleUpperCase("es").slice(0, 40) })} maxLength={40} placeholder="Frente" /></label>
              <label>Texto del dorso<input aria-label={`Texto del dorso del fleje de ${line.product.name}`} value={draft.flejeBackText} onChange={(event) => update({ flejeBackText: event.target.value.toLocaleUpperCase("es").slice(0, 40) })} maxLength={40} placeholder="Dorso" /></label>
            </>}
          </>}
        </div>
      </section>}

      {(mateStep === "Virola" || mateStep === "Fleje") && <LocalMateDesignPreview product={line.product} draft={draft} surface={mateStep === "Virola" ? "rim" : "fleje"} update={update} />}
      {needsMateLogo && (mateStep === "Virola" || mateStep === "Fleje") && <div className="local-personalization-uploads">
        {mateStep === "Virola" && draft.rimTechnique !== "none" && contentUsesLogo(draft.rimContent) && <label className="local-personalization-upload"><span><FileArrowUp size={21} /><span><strong>Logo de la virola</strong><small>PNG, JPG, SVG o PDF · hasta 10 MB</small></span></span><input aria-label={`Logo de virola de ${line.product.name}`} type="file" accept="image/png,image/jpeg,image/svg+xml,application/pdf" onChange={onFile("rimLogoFile")} /><b>{draft.rimLogoFile?.name || "Seleccionar archivo"}</b></label>}
        {mateStep === "Fleje" && draft.flejeTechnique !== "none" && contentUsesLogo(draft.flejeContent) && <label className="local-personalization-upload"><span><FileArrowUp size={21} /><span><strong>Logo del fleje</strong><small>Puede ser distinto al de la virola</small></span></span><input aria-label={`Logo de fleje de ${line.product.name}`} type="file" accept="image/png,image/jpeg,image/svg+xml,application/pdf" onChange={onFile("flejeLogoFile")} /><b>{draft.flejeLogoFile?.name || "Seleccionar archivo"}</b></label>}
      </div>}
    </div> : draft.kind === "matera" ? <div className="local-personalization-body">
      <section className="local-personalization-surface">
        <div className="local-personalization-surface-title"><strong>Diseño de la matera</strong><small>El logo es la opción habitual; también podés registrar texto</small></div>
        <div className="local-personalization-fields">
          <label>Técnica<select aria-label={`Técnica de ${line.product.name}`} value={draft.materaTechnique} onChange={(event) => update({ materaTechnique: event.target.value as LocalPersonalizationDraft["materaTechnique"] })}>{techniqueOptions.slice(1).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label>Contenido<select aria-label={`Contenido de ${line.product.name}`} value={draft.materaContent} onChange={(event) => update({ materaContent: event.target.value as LocalPersonalizationDraft["materaContent"] })}>{contentOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label>Ubicación<select aria-label={`Ubicación de ${line.product.name}`} value={draft.materaPlacement} onChange={(event) => update({ materaPlacement: event.target.value as LocalPersonalizationDraft["materaPlacement"] })}><option value="front">Frente</option><option value="lid">Tapa</option><option value="front-lid">Frente y tapa</option></select></label>
          {contentUsesText(draft.materaContent) && <label className="local-personalization-text">Texto<input aria-label={`Texto de ${line.product.name}`} value={draft.materaText} onChange={(event) => update({ materaText: event.target.value.toLocaleUpperCase("es").slice(0, 60) })} maxLength={60} placeholder="Texto exacto a grabar" required /></label>}
        </div>
      </section>
      {needsMateraLogo && <label className="local-personalization-upload"><span><FileArrowUp size={21} /><span><strong>Logo original</strong><small>PNG, JPG, SVG o PDF · hasta 10 MB</small></span></span><input aria-label={`Logo de ${line.product.name}`} type="file" accept="image/png,image/jpeg,image/svg+xml,application/pdf" onChange={onFile("materaLogoFile")} /><b>{draft.materaLogoFile?.name || "Seleccionar archivo"}</b></label>}
    </div> : <div className="local-personalization-body">
      <section className="local-personalization-surface">
        <div className="local-personalization-surface-title"><strong>Diseño de la bombilla</strong><small>Indicá exactamente qué se graba o aplica</small></div>
        <div className="local-personalization-fields">
          <label>Técnica<select aria-label={`Técnica de ${line.product.name}`} value={draft.bombillaTechnique} onChange={(event) => update({ bombillaTechnique: event.target.value as LocalPersonalizationDraft["bombillaTechnique"] })}>{techniqueOptions.slice(1).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label>Contenido<select aria-label={`Contenido de ${line.product.name}`} value={draft.bombillaContent} onChange={(event) => update({ bombillaContent: event.target.value as LocalPersonalizationDraft["bombillaContent"] })}>{contentOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label>Ubicación<input aria-label={`Ubicación de ${line.product.name}`} value={draft.bombillaPlacement} onChange={(event) => update({ bombillaPlacement: event.target.value.slice(0, 80) })} maxLength={80} placeholder="Ej.: cuerpo o boquilla" required /></label>
          {contentUsesText(draft.bombillaContent) && <label className="local-personalization-text">Texto exacto<input aria-label={`Texto de ${line.product.name}`} value={draft.bombillaText} onChange={(event) => update({ bombillaText: event.target.value.toLocaleUpperCase("es").slice(0, 60) })} maxLength={60} required /></label>}
        </div>
      </section>
      {needsBombillaLogo && <label className="local-personalization-upload"><span><FileArrowUp size={21} /><span><strong>Logo o imagen</strong><small>PNG, JPG, SVG o PDF · hasta 10 MB</small></span></span><input aria-label={`Logo de ${line.product.name}`} type="file" accept="image/png,image/jpeg,image/svg+xml,application/pdf" onChange={onFile("bombillaLogoFile")} /><b>{draft.bombillaLogoFile?.name || "Seleccionar archivo"}</b></label>}
    </div>}
    {draft.kind === "mate" && !line.product.assembly && <div className="local-mate-step-actions"><button type="button" className="secondary" disabled={mateStepIndex === 0} onClick={() => setMateStepIndex(index => index - 1)}>Anterior</button><span>Paso {mateStepIndex + 1} de {mateSteps.length}</span><button type="button" className="secondary" disabled={mateStepIndex === mateSteps.length - 1} onClick={() => setMateStepIndex(index => index + 1)}>Siguiente</button></div>}
    {(draft.kind !== "mate" || Boolean(line.product.assembly) || mateStep === "Resumen") && <>{!line.product.assembly && <div className="local-personalization-price" aria-label={`Precio de ${line.product.name}`}>
      <div><span>Precio del artículo</span><strong>{money(line.unitPriceMinor / 100)}</strong></div>
      {quote.items.map((item) => <div key={item.ruleKey}><span>{item.label} · {item.quantity} × {money(item.unitPriceMinor / 100)}</span><strong>{money(item.totalMinor / 100)}</strong></div>)}
      <div className="local-personalization-price-total"><span>Total unitario</span><strong>{pricing && !quote.missingRuleKeys.length ? money((line.unitPriceMinor + quote.extrasMinor) / 100) : pricingLoading ? "Cargando precios…" : "Precio no disponible"}</strong></div>
      {!!quote.missingRuleKeys.length && !pricingLoading && <small>Falta publicar un precio de personalización en Productos → Personalizador.</small>}
    </div>}
    <label className="local-personalization-instructions">Indicaciones para el taller<textarea aria-label={`Indicaciones para ${line.product.name}`} value={draft.instructions} onChange={(event) => update({ instructions: event.target.value.slice(0, 1000) })} maxLength={1000} rows={3} placeholder="Ubicación precisa, tipografía, medidas u otro detalle acordado con el cliente" /></label></>}
  </article>;
}

export function LocalSaleRegister({ s, refresh, go }: PageProps) {
  const [articleTab, setArticleTab] = useState<"articles" | "custom">("articles");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [lines, setLines] = useState<SaleLine[]>([]);
  const [customKind, setCustomKind] = useState<PersonalizationKind | "">("");
  const [pricing, setPricing] = useState<PublishedLocalPricing | null>(null);
  const [pricingLoading, setPricingLoading] = useState(false);
  const [pricingError, setPricingError] = useState("");
  const [pricingRefresh, setPricingRefresh] = useState(0);
  const [customerId, setCustomerId] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [newCustomer, setNewCustomer] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [date, setDate] = useState(today);
  const [payment, setPayment] = useState("Efectivo");
  const [hasDeposit, setHasDeposit] = useState(false);
  const [discountOn, setDiscountOn] = useState(false);
  const [discountText, setDiscountText] = useState("10");
  const [channel, setChannel] = useState<"Local" | "Feria" | "Instagram" | "Facebook" | "WhatsApp">("Local");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [pickType, setPickType] = useState("");
  const [pickName, setPickName] = useState("");
  const [city, setCity] = useState("Paysandú");
  const [country, setCountry] = useState("Uruguay");
  const [department, setDepartment] = useState("Paysandú");
  const [deposit, setDeposit] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (articleTab !== "custom") return;
    let active = true;
    setPricingLoading(true);
    setPricingError("");
    void (async () => {
      if (!commerceSource) throw new Error("No hay conexión con los precios del Personalizador.");
      const { data, error: loadError } = await commerceSource.rpc("get_published_pricing_catalog");
      if (loadError) throw loadError;
      return parsePublishedLocalPricing(data);
    })().then((result) => { if (active) setPricing(result); })
      .catch(() => { if (active) { setPricing(null); setPricingError("No se pudieron cargar los precios publicados del Personalizador."); } })
      .finally(() => { if (active) setPricingLoading(false); });
    return () => { active = false; };
  }, [articleTab, pricingRefresh]);
  const customers = s.customers;
  const selectedCustomer = customers.find((customer) => customer.id === customerId);
  const sellable = (product: Product) => !product.wholesaleProductId && product.availableChannels?.includes("Local") && (channel === "Local" || !isService(product));
  const categories = useMemo(() => {
    const values = new Map<string, string>();
    for (const product of s.products.filter(sellable)) values.set(categoryKey(product), product.family);
    if (channel === "Local") values.set("servicios", "Servicios");
    return [...values].map(([code, label]) => ({ code, label })).sort((a, b) => a.label.localeCompare(b.label, "es"));
  }, [s.products, channel]);
  const customerMatches = useMemo(() => {
    const query = normalizeSearch(customerSearch.trim());
    if (!query) return [];
    return customers.filter((customer) => normalizeSearch(`${customer.name} ${customer.email || ""} ${customer.phone || ""} ${(customer.agendaAdditionalPhones || []).join(" ")}`).includes(query)).slice(0, 30);
  }, [customers, customerSearch]);
  const matches = useMemo(() => {
    if (!search.trim()) return [];
    return s.products.filter((product) => sellable(product) &&
      (!category || categoryKey(product) === category) && matchesSaleProductSearch({
        name: product.name, sku: product.sku, variant: product.variant, category: product.family, description: product.searchText,
        material: product.leather, rim: product.rim, attributes: product.attributes, options: product.options,
        price: salePriceMinor(product, payment) / 100,
      }, search)).slice(0, 50);
  }, [s.products, search, category, channel, payment]);
  const categoryProducts = useMemo(() => s.products.filter((product) => sellable(product) && categoryKey(product) === category)
    .sort((a, b) => `${a.name} ${a.variant}`.localeCompare(`${b.name} ${b.variant}`, "es")), [s.products, category, channel]);
  const pickTypes = useMemo(() => [...new Set(categoryProducts.map(retailType))].sort((a, b) => a.localeCompare(b, "es")), [categoryProducts]);
  const typedCategory = ["mates", "materas", "bombillas"].includes(normalizeSearch(category));
  const activeType = pickTypes.length === 1 ? pickTypes[0] : pickType;
  const pickNames = useMemo(() => [...new Set(categoryProducts.filter((product) => retailType(product) === activeType).map((product) => product.name))], [categoryProducts, activeType]);
  const activeName = pickNames.length === 1 ? pickNames[0] : pickName;
  const pickVariants = useMemo(() => categoryProducts.filter((product) => retailType(product) === activeType && product.name === activeName), [categoryProducts, activeType, activeName]);
  const pickedProduct = pickVariants.find((product) => product.id === selectedProductId) ?? pickVariants[0];
  const resetPicker = () => { setPickType(""); setPickName(""); setSelectedProductId(""); };
  const customProducts = useMemo(() => s.products.filter((product) => sellable(product) && customizableKind(product) === customKind)
    .sort((a, b) => `${a.name} ${a.variant}`.localeCompare(`${b.name} ${b.variant}`, "es")), [s.products, customKind, channel]);
  const articleLines = lines.filter((line) => !line.personalization);
  const basePriceMinor = (line: SaleLine) => line.product.assembly ? priceMateAssembly(line.product.assembly, pricing?.rules).totalMinor : line.unitPriceMinor;
  const unitPriceMinor = (line: SaleLine) => basePriceMinor(line) + (line.personalization ? calculateLocalPersonalizationPrice(line.personalization, pricing).extrasMinor : 0);
  const personalizedLines = lines.filter((line) => line.personalization);
  // El descuento aplica solo a los artículos personalizados (los demás ya tienen su precio por medio de pago).
  const discountPercent = discountOn && personalizedLines.length ? parseDiscountPercent(discountText) : 0;
  const soldUnitMinor = (line: SaleLine) => line.personalization && discountPercent > 0 ? Math.round(unitPriceMinor(line) * (100 - discountPercent) / 100) : unitPriceMinor(line);
  const listItemsMinor = lines.reduce((sum, line) => sum + line.quantity * unitPriceMinor(line), 0);
  const itemsMinor = lines.reduce((sum, line) => sum + line.quantity * soldUnitMinor(line), 0);
  const depositMinor = cents(deposit);
  const linePriceReady = (line: SaleLine) => !line.personalization || (Boolean(pricing) && !pricingLoading && (!line.product.assembly || priceMateAssembly(line.product.assembly, pricing?.rules).ready) && !calculateLocalPersonalizationPrice(line.personalization, pricing).missingRuleKeys.length);
  const customPricesReady = lines.every(linePriceReady);
  const updatePersonalization = (lineId: string, changes: Partial<LocalPersonalizationDraft>) => setLines((current) => current.map((line) => line.id === lineId && line.personalization
    ? { ...line, personalization: { ...line.personalization, ...changes } }
    : line));
  const updateAssembly = (lineId: string, assembly: MateAssembly) => setLines(current => current.map(line => {
    if (line.id !== lineId || !line.personalization) return line;
    const product = mateAssemblyPresentation(assembly, pricing?.rules);
    return { ...line, product, unitPriceMinor: salePriceMinor(product, payment), personalization: { ...line.personalization, selectedOptions: { tamano: assembly.tamano, interior: assembly.interior }, ...(assembly["tipo-virola"] === "sin-virola" ? { rimTechnique: "none" as const } : {}), ...(!assemblyHasFleje(assembly) ? { flejeTechnique: "none" as const } : {}) } };
  }));
  const replaceCustomProduct = (lineId: string, product: Product) => setLines(current => current.map(line => {
    if (line.id !== lineId || !line.personalization || line.personalization.kind !== "mate") return line;
    const available = matePurchaseAxes(product);
    const selectedOptions = Object.fromEntries(available.map(axis => [axis.code, axis.values.some(option => option.value === line.personalization!.selectedOptions[axis.code])
      ? line.personalization!.selectedOptions[axis.code] : axis.values.length === 1 ? axis.values[0].value : ""]).filter(([, value]) => Boolean(value)));
    return { ...line, product, unitPriceMinor: salePriceMinor(product, payment), personalization: { ...line.personalization, selectedOptions } };
  }));
  const add = (product: Product) => {
    if (isService(product) && channel !== "Local") { setError("Los servicios solo se registran como ventas de Local."); return; }
    setLines((current) => {
      const existing = current.find((line) => line.product.id === product.id && !line.personalization);
      return existing ? current.map((line) => line.id === existing.id ? { ...line, quantity: line.quantity + 1 } : line)
        : [...current, { id: crypto.randomUUID(), product, quantity: 1, unitPriceMinor: salePriceMinor(product, payment), priceEntered: !hasVariableServicePrice(product) }];
    });
    setSearch(""); setError("");
  };
  const addCustom = (product: Product, selectedOptions: Record<string, string> = {}) => {
    if (!product || !customKind) return;
    const draft = createPersonalizationDraft(customKind, product);
    draft.selectedOptions = { ...draft.selectedOptions, ...selectedOptions };
    setLines((current) => [...current, { id: crypto.randomUUID(), product, quantity: 1, unitPriceMinor: salePriceMinor(product, payment), priceEntered: true, personalization: draft }]);
    setError("");
  };
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!commerceSource) return;
    const source = commerceSource;
    if (!lines.length) { setError("Agregá al menos un producto."); return; }
    if (channel !== "Local" && lines.some((line) => isService(line.product))) { setError("Los servicios solo se registran como ventas de Local."); return; }
    if (lines.some((line) => hasVariableServicePrice(line.product) && (!line.priceEntered || line.unitPriceMinor <= 0))) { setError("Ingresá el precio acordado para cada servicio con precio a definir."); return; }
    if (lines.length > 100 || lines.some((line) => !Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > 1000 || !Number.isInteger(line.unitPriceMinor) || line.unitPriceMinor < 0 || line.unitPriceMinor > 1000000000)) {
      setError("Revisá cantidades y precios."); return;
    }
    if (!date || date > today) { setError("Revisá la fecha de venta."); return; }
    for (const line of personalizedLines) {
      const personalizationError = validatePersonalization(line.personalization!, line.product);
      if (personalizationError) { setArticleTab("custom"); setError(personalizationError); return; }
      const quote = calculateLocalPersonalizationPrice(line.personalization!, pricing);
      if (!pricing || quote.missingRuleKeys.length) { setArticleTab("custom"); setError("No se puede guardar el artículo personalizado sin sus precios publicados. Revisá Productos → Personalizador y actualizá los precios."); return; }
    }
    if (discountOn && personalizedLines.length && !(discountPercent > 0)) { setError("Ingresá un descuento mayor a 0%, o elegí \"No\"."); return; }
    if (hasDeposit && (!Number.isInteger(depositMinor) || depositMinor <= 0 || depositMinor > itemsMinor)) {
      setError("La seña debe ser mayor que cero y no superar el valor de los artículos."); return;
    }
    if (newCustomer && !name.trim()) { setError("Ingresá el nombre del cliente."); return; }
    setBusy(true); setError("");
    const uploadedPaths: string[] = [];
    try {
      const selectedCustomer = customers.find((customer) => customer.id === customerId);
      let selectedCustomerId = selectedCustomer?.localCustomerId || null;
      if (newCustomer || (selectedCustomer && !selectedCustomer.localCustomerId)) {
        const sourceCustomer: Customer | undefined = newCustomer ? undefined : selectedCustomer;
        if (sourceCustomer) {
          const linked = await commerceSource.from("local_sales_customers").select("id").eq("linked_customer_id", sourceCustomer.id).maybeSingle();
          if (linked.error) throw new Error("No se pudo verificar el vínculo del cliente.");
          selectedCustomerId = linked.data?.id || null;
        }
        if (!selectedCustomerId) {
          const { data, error } = await commerceSource.from("local_sales_customers").insert({
            full_name: sourceCustomer?.name || name.trim(), email: sourceCustomer?.email || email.trim() || null,
            phone: sourceCustomer?.phone || phone.trim() || null,
            city: sourceCustomer?.city || city.trim() || null,
            country: sourceCustomer?.country || country.trim() || null,
            department: sourceCustomer ? sourceCustomer.department || null : department || null,
            birth_date: sourceCustomer?.birthDate || birthDate || null,
            linked_customer_id: sourceCustomer?.id || null,
            origin_channel: sourceCustomer?.originChannel || channel,
            customer_type: sourceCustomer?.segment === "Mayorista" ? "Mayorista" : "Minorista",
          }).select("id").single();
          if (error) {
            if (error.code === "23505" && sourceCustomer) {
              const linked = await commerceSource.from("local_sales_customers").select("id").eq("linked_customer_id", sourceCustomer.id).maybeSingle();
              if (!linked.error) selectedCustomerId = linked.data?.id || null;
            }
            if (!selectedCustomerId) throw new Error(error.code === "23505" ? "Ya existe un cliente con esos datos. Actualizá la lista y volvé a seleccionarlo." : "No se pudo guardar el cliente.");
          } else selectedCustomerId = data.id;
        }
      }
      const { data: authData, error: authError } = personalizedLines.length ? await commerceSource.auth.getUser() : { data: { user: null }, error: null };
      if (authError || (personalizedLines.length && !authData.user)) throw new Error("No se pudo validar la sesión para adjuntar los diseños.");
      const items = [];
      for (const line of lines) {
        const assets: { rim?: StoredPersonalizationAsset; fleje?: StoredPersonalizationAsset; matera?: StoredPersonalizationAsset; bombilla?: StoredPersonalizationAsset } = {};
        const upload = async (file: File, role: keyof typeof assets) => {
          const safeName = file.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "archivo";
          const path = `local-sales/${authData.user!.id}/${crypto.randomUUID()}/${role}-${safeName}`;
          const { error: uploadError } = await source.storage.from("order-assets").upload(path, file, { contentType: file.type, cacheControl: "3600", upsert: false });
          if (uploadError) throw new Error(`No se pudo subir ${file.name}.`);
          uploadedPaths.push(path);
          assets[role] = { bucket_id: "order-assets", object_path: path, original_name: file.name, mime_type: file.type, byte_size: file.size };
        };
        if (line.personalization?.rimLogoFile) await upload(line.personalization.rimLogoFile, "rim");
        if (line.personalization?.flejeLogoFile) await upload(line.personalization.flejeLogoFile, "fleje");
        if (line.personalization?.materaLogoFile) await upload(line.personalization.materaLogoFile, "matera");
        if (line.personalization?.bombillaLogoFile) await upload(line.personalization.bombillaLogoFile, "bombilla");
        const snapshot = line.personalization ? buildLocalPersonalizationSnapshot(line.personalization, line.product, assets) : null;
        const previews = [];
        if (snapshot) for (const {role,blob} of await captureLocalDesign(snapshot)) {
          const path = `local-sales/${authData.user!.id}/${crypto.randomUUID()}/${role}.png`;
          const {error} = await source.storage.from("order-assets").upload(path, blob, {contentType:"image/png",upsert:false});
          if (error) throw new Error("No se pudo guardar la imagen final del diseño. Intentá nuevamente.");
          uploadedPaths.push(path);
          previews.push({role,bucket_id:"order-assets",object_path:path,mime_type:"image/png",byte_size:blob.size});
        }
        items.push({
          item_kind: line.product.assembly ? "custom_mate" : "catalog",
          variant_id: line.product.assembly ? null : line.product.id,
          ...(isService(line.product) && line.notes?.trim() ? { production_notes: line.notes.trim() } : {}),
          quantity: line.quantity,
          unit_price_minor: soldUnitMinor(line),
          ...(line.personalization && discountPercent > 0 ? { discount_percent: discountPercent } : {}),
          customization: line.personalization ? {
            ...snapshot,
            ...(discountPercent > 0 ? { discount: { percent: discountPercent, listUnitPriceMinor: unitPriceMinor(line) } } : {}),
            previews,
            ...(pricing ? { localPricing: { source: "published-personalizer", versionId: pricing.versionId, version: pricing.version, baseUnitPriceMinor: basePriceMinor(line), extrasUnitPriceMinor: calculateLocalPersonalizationPrice(line.personalization, pricing).extrasMinor, assemblyItems: line.product.assembly ? priceMateAssembly(line.product.assembly, pricing.rules).items : undefined, items: calculateLocalPersonalizationPrice(line.personalization, pricing).items } } : {}),
          } : null,
        });
      }
      const { data, error } = await commerceSource.rpc("gestion_create_local_sale_with_items", {
        p_customer_id: selectedCustomerId, p_sold_on: date, p_payment_method: payment,
        p_items: items,
        p_deposit_minor: hasDeposit ? depositMinor : null,
        p_channel: channel,
      });
      if (error) throw new Error(error.code === "22023" ? error.message : "No se pudo guardar la venta. Revisá los datos e intentá nuevamente.");
      await refresh?.().catch(() => undefined);
      go(`/comercial/pedidos?pedido=${encodeURIComponent(String((data as { id: string }).id))}`);
    } catch (cause) {
      if (uploadedPaths.length) await commerceSource.storage.from("order-assets").remove(uploadedPaths);
      setError(cause instanceof Error ? cause.message : "No se pudo guardar la venta.");
    }
    finally { setBusy(false); }
  }
  const renderLine = (line: SaleLine) => <div className="local-sale-line" key={line.id}>
    <div><strong>{line.product.name}</strong><small>{[line.product.sku, visibleVariant(line.product.variant)].filter(Boolean).join(" · ")}</small></div>
    {line.personalization ? <label>Precio unitario<input type="text" value={linePriceReady(line) ? money(soldUnitMinor(line) / 100) : ""} placeholder="Esperando tarifa" readOnly aria-label={`Precio unitario de ${line.product.name}`} /></label>
      : <label>{hasVariableServicePrice(line.product) ? "Precio acordado" : "Precio"}<input type="number" min={hasVariableServicePrice(line.product) ? "0.01" : "0"} max="10000000" step="0.01" required={hasVariableServicePrice(line.product)} placeholder={hasVariableServicePrice(line.product) ? "Ingresar precio" : undefined} value={hasVariableServicePrice(line.product) && !line.priceEntered ? "" : line.unitPriceMinor / 100} onChange={(event) => setLines((current) => current.map((item) => item.id === line.id ? { ...item, unitPriceMinor: cents(event.target.value), priceEntered: event.target.value !== "", priceOverridden: true } : item))} /></label>}
    <label>Cantidad<input type="number" min="1" max="1000" step="1" value={line.quantity} onChange={(event) => setLines((current) => current.map((item) => item.id === line.id ? { ...item, quantity: Number(event.target.value) } : item))} /></label>
    <strong>{linePriceReady(line) ? (line.personalization && discountPercent > 0 ? <><s className="local-sale-struck">{money(line.quantity * unitPriceMinor(line) / 100)}</s> {money(line.quantity * soldUnitMinor(line) / 100)}</> : money(line.quantity * unitPriceMinor(line) / 100)) : "—"}</strong>
    <button type="button" className="local-sale-remove" aria-label={`Quitar ${line.product.name}`} onClick={() => setLines((current) => current.filter((item) => item.id !== line.id))}><Trash size={18} /></button>
    {isService(line.product) && <label className="local-sale-line-notes">Notas para producción<textarea aria-label={`Notas para producción de ${line.product.name}`} maxLength={1000} rows={2} placeholder="Indicaciones para el taller" value={line.notes || ""} onChange={(event) => setLines((current) => current.map((item) => item.id === line.id ? { ...item, notes: event.target.value } : item))} /></label>}
  </div>;
  return <form className="local-sale-register" onSubmit={(event) => void save(event)}>
    <div className="local-sale-main">
    <section className="local-sale-section local-sale-product-section">
      <div className="local-sale-tabs" role="tablist" aria-label="Secciones de artículos">
        <button type="button" role="tab" id="local-tab-articles" aria-controls="local-panel-articles" aria-selected={articleTab === "articles"} className={articleTab === "articles" ? "active" : ""} onClick={() => setArticleTab("articles")}>Artículos{articleLines.length ? <span>{articleLines.length}</span> : null}</button>
        <button type="button" role="tab" id="local-tab-custom" aria-controls="local-panel-custom" aria-selected={articleTab === "custom"} className={articleTab === "custom" ? "active" : ""} onClick={() => setArticleTab("custom")}>Personalizados{personalizedLines.length ? <span>{personalizedLines.length}</span> : null}</button>
      </div>
      {articleTab === "articles" ? <div id="local-panel-articles" role="tabpanel" aria-labelledby="local-tab-articles" className="local-sale-tab-panel">
      <div className="local-sale-search"><label>Categoría<select value={category} onChange={(event) => { setCategory(event.target.value); resetPicker(); }}><option value="">Todas</option>{categories.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}</select></label>
        <label>Buscar producto<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nombre, código, precio o material" /></label></div>
      {category && <div className="local-sale-picker">{typedCategory && <label>Tipo<select aria-label="Tipo" value={activeType} onChange={(event) => { setPickType(event.target.value); setPickName(""); setSelectedProductId(""); }}><option value="">Elegir</option>{pickTypes.map((type) => <option key={type} value={type}>{type}</option>)}</select></label>}
        <label>Nombre<select aria-label="Nombre" value={activeName} disabled={!activeType} onChange={(event) => { setPickName(event.target.value); setSelectedProductId(""); }}><option value="">Elegir</option>{pickNames.map((name) => <option key={name} value={name}>{name}</option>)}</select></label>
        {category !== "servicios" && <label>Variante<select aria-label="Variante" value={selectedProductId} disabled={!activeName || pickVariants.length <= 1} onChange={(event) => setSelectedProductId(event.target.value)}><option value="">{pickVariants.length === 1 ? (visibleVariant(pickVariants[0].variant) || "Sin variante") : "Primera variante"}</option>{pickVariants.length > 1 && pickVariants.map((product) => <option key={product.id} value={product.id}>{visibleVariant(product.variant) || "Única"}</option>)}</select></label>}
        <button type="button" className="secondary" disabled={!pickedProduct} onClick={() => { if (pickedProduct) add(pickedProduct); setSelectedProductId(""); }}>Agregar producto</button></div>}
      {search.trim() && <div className="local-sale-results">{matches.map((product) => <button type="button" key={product.id} onClick={() => add(product)}>
        <strong>{product.sku} · {product.name}</strong><small>{hasVariableServicePrice(product) ? "Precio a definir en la venta" : [visibleVariant(product.variant), money(salePriceMinor(product, payment) / 100)].filter(Boolean).join(" · ")}</small>
      </button>)}{!matches.length && <div className="empty">No hay variantes activas con esa búsqueda.</div>}</div>}
      {!!articleLines.length && <div className="local-sale-lines">{articleLines.map(renderLine)}</div>}
      </div> : <div id="local-panel-custom" role="tabpanel" aria-labelledby="local-tab-custom" className="local-sale-tab-panel">
        <p className="local-sale-custom-intro">Armá el artículo por sus características y diseñá el grabado de la virola y el fleje.</p>
        <label>Categoría de artículo<select value={customKind} onChange={event => setCustomKind(event.target.value as PersonalizationKind | "")}><option value="">Elegir categoría</option><option value="mate">Mate</option><option value="matera">Matera</option><option value="bombilla">Bombilla</option></select></label>
        {customKind === "mate" ? <MateAssemblyPicker pricing={pricing} onAdd={assembly => addCustom(mateAssemblyPresentation(assembly, pricing?.rules))} /> : customKind && <CustomArticlePicker key={customKind} products={customProducts} onAdd={addCustom} priceForProduct={product => salePriceMinor(product, payment) / 100} priceLabel={usesBasePrice(payment) ? "Precio base" : "Precio publicado"} />}
        {customKind && customKind !== "mate" && !customProducts.length && <p className="local-sale-custom-empty">No hay {customKind === "matera" ? "materas" : "bombillas"} activos para venta local en el catálogo.</p>}
        {pricingError && <p role="alert">{pricingError} <button type="button" onClick={() => setPricingRefresh(value => value + 1)}>Reintentar precios</button></p>}
        {!!personalizedLines.length && <>
          {pricingError && <p className="local-sale-custom-empty" role="alert">{pricingError} <button type="button" onClick={() => setPricingRefresh((value) => value + 1)}>Reintentar</button></p>}
          <div className="local-sale-lines">{personalizedLines.map(renderLine)}</div>
          <div className="local-personalization-list">{personalizedLines.map((line, index) => <PersonalizationFields key={line.id} line={{ ...line, unitPriceMinor: basePriceMinor(line) }} index={index} update={(changes) => updatePersonalization(line.id, changes)} updateAssembly={assembly => updateAssembly(line.id, assembly)} replaceProduct={(product) => replaceCustomProduct(line.id, product)} mateProducts={s.products.filter((product) => sellable(product) && customizableKind(product) === "mate")} reportError={setError} pricing={pricing} pricingLoading={pricingLoading} />)}</div>
        </>}
      </div>}
    </section>
    <section className="local-sale-section local-sale-client-section">
      <h2>Cliente</h2>
      <div className="local-sale-client-layout">
        <div className="local-sale-client-search-pane">
          <label className="local-sale-customer-search">Buscar cliente
            <span><MagnifyingGlass size={20} aria-hidden="true" /><input value={customerSearch} onChange={(event) => { setCustomerSearch(event.target.value); setCustomerId(""); setNewCustomer(false); }} placeholder="Nombre, mail o celular" /></span>
          </label>
          {customerSearch.trim() && !selectedCustomer && !newCustomer && <div className="local-sale-customer-results" aria-label="Coincidencias de clientes">
            {customerMatches.map((customer) => <button type="button" key={customer.id} onClick={() => { setCustomerId(customer.id); setCustomerSearch(customer.name); setNewCustomer(false); }}>
              <strong>{customer.name}</strong><small>{customer.email || customer.phone || "Sin datos de contacto"}</small>
            </button>)}
            {!customerMatches.length && <div className="local-sale-customer-empty">No encontramos coincidencias. Podés agregar un cliente nuevo.</div>}
          </div>}
          <button className="primary local-sale-new-customer" type="button" onClick={() => { setCustomerId(""); setNewCustomer(true); if (!name) setName(customerSearch.trim()); }}><UserPlus size={19} />Agregar nuevo cliente</button>
        </div>

        <div className="local-sale-customer-panel" aria-live="polite">
          {newCustomer ? <>
            <div className="local-sale-customer-panel-heading"><div><small>Nuevo cliente</small><h3>Datos para registrarlo</h3></div></div>
            <div className="local-sale-customer-form">
              <label>Nombre<input value={name} onChange={(event) => setName(event.target.value)} maxLength={120} required /></label>
              <label>Mail<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={320} /></label>
              <label>Celular<input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} maxLength={40} /></label>
              <label>Fecha de nacimiento<input type="date" value={birthDate} onChange={(event) => setBirthDate(event.target.value)} max={today} /></label>
              <label>Ciudad<input value={city} onChange={(event) => setCity(event.target.value)} maxLength={120} /></label>
              <label>País<select aria-label="País" value={country} onChange={(event) => { const next = event.target.value; setCountry(next); setDepartment(next === "Uruguay" ? "Paysandú" : ""); setCity((current) => current === "Paysandú" && next !== "Uruguay" ? "" : !current && next === "Uruguay" ? "Paysandú" : current); }}>{countryOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
              <label>Departamento o provincia<select aria-label="Departamento o provincia" value={department} onChange={(event) => setDepartment(event.target.value)}><option value="">Sin especificar</option>{customerDepartments(country).map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
            </div>
          </> : selectedCustomer ? <>
            <div className="local-sale-customer-panel-heading"><div><small>Cliente registrado</small><h3>{selectedCustomer.name}</h3></div><button type="button" className="secondary customer-edit-button" aria-label={`Editar ${selectedCustomer.name}`} title={`Editar ${selectedCustomer.name}`} onClick={() => go(`/clientes/base?editar=${encodeURIComponent(selectedCustomer.id)}`)}><PencilSimple size={20} aria-hidden="true" /></button></div>
            <dl className="local-sale-customer-details">
              <div><dt>Mail</dt><dd>{selectedCustomer.email || "-"}</dd></div>
              <div><dt>Celular</dt><dd>{selectedCustomer.phone || "-"}</dd></div>
              <div><dt>Fecha de nacimiento</dt><dd>{selectedCustomer.birthDate ? formatDate(selectedCustomer.birthDate) : "-"}</dd></div>
              <div><dt>Ciudad</dt><dd>{selectedCustomer.city || "-"}</dd></div>
              <div><dt>País</dt><dd>{selectedCustomer.country || "-"}</dd></div>
              <div><dt>Departamento o provincia</dt><dd>{selectedCustomer.department || "-"}</dd></div>
            </dl>
          </> : <div className="local-sale-customer-placeholder"><UserPlus size={28} /><strong>Seleccioná un cliente</strong><span>Buscalo por nombre, mail o celular; sus datos aparecerán en este panel.</span></div>}
        </div>
      </div>
    </section>

    <section className="local-sale-section local-sale-payment-section">
      <h2>Datos de la venta</h2>
      <div className="local-sale-payment-fields">
        <label>Fecha de venta<input type="date" max={today} value={date} onChange={(event) => setDate(event.target.value)} required /></label>
        <label>Canal de venta<select value={channel} onChange={(event) => { const next = event.target.value as typeof channel; if(next !== "Local" && lines.some((line) => isService(line.product))) { setError("Quitá los servicios antes de cambiar el canal de venta."); return; } setChannel(next); setCategory(""); setSelectedProductId(""); setError(""); }}>{(["Local", "Feria", "Instagram", "Facebook", "WhatsApp"] as const).filter((option) => option === "Local" || allowedSalesChannels(s).includes(option)).map((option) => <option key={option}>{option}</option>)}</select></label>
        <label>Medio de pago<select value={payment} onChange={(event) => { const next = event.target.value; setPayment(next); setLines((current) => current.map((line) => line.product.assembly || hasVariableServicePrice(line.product) || line.priceOverridden ? line : { ...line, unitPriceMinor: salePriceMinor(line.product, next) })); }}>{["Efectivo", "Débito", "Crédito", "Transferencia"].map((method) => <option key={method}>{method}</option>)}</select></label>
        <label className="local-sale-deposit-toggle"><input type="checkbox" checked={hasDeposit} onChange={(event) => setHasDeposit(event.target.checked)} />Con seña</label>
        {hasDeposit && <label>Seña cobrada<input type="number" min="0.01" max="10000000" step="0.01" value={deposit} onChange={(event) => setDeposit(event.target.value)} required /></label>}
      </div>
    </section>
    {personalizedLines.length > 0 && <section className="local-sale-section local-sale-discount-section">
      <h2>Descuentos</h2>
      <div className="wholesale-sale-discount-row">
        <label className="wholesale-sale-discount-toggle">Descuento en personalizados<select aria-label="Aplicar descuento a personalizados" value={discountOn ? "si" : "no"} onChange={(event) => setDiscountOn(event.target.value === "si")}><option value="no">No</option><option value="si">Sí</option></select></label>
        {discountOn && <label className="wholesale-sale-discount-percent">Porcentaje<span><input type="number" min="0" max="100" step="0.5" inputMode="decimal" aria-label="Porcentaje de descuento" value={discountText} onChange={(event) => setDiscountText(event.target.value)} /><b aria-hidden="true">%</b></span></label>}
      </div>
    </section>}
    <footer className="local-sale-footer">
      <div><small>Artículos</small>{customPricesReady && discountPercent > 0 && listItemsMinor > itemsMinor ? <strong className="local-sale-total-discounted"><s>{money(listItemsMinor / 100)}</s><span>{money(itemsMinor / 100)}</span><em>-{formatPercent(discountPercent)} en personalizados</em></strong> : <strong>{customPricesReady ? money(itemsMinor / 100) : "Pendiente de precios"}</strong>}</div>
      {hasDeposit && <div><small>Seña cobrada</small><strong>{money(Number.isFinite(depositMinor) ? depositMinor / 100 : 0)}</strong></div>}
      {error && <div className="error" role="alert">{error}{error.includes("tarifas") && <button type="button" onClick={() => setPricingRefresh(value => value + 1)}>Actualizar precios</button>}</div>}
      <button className="primary" disabled={busy || !lines.length || !customPricesReady}><Plus size={18} />{busy ? "Guardando…" : "Guardar venta"}</button>
    </footer>
    </div>
    <aside className="local-sale-photo-panel" aria-label="Fotos de los artículos de la venta">
      <h2>Vista de la venta</h2>
      {!lines.length ? <p className="local-sale-photo-empty">Las fotos de los artículos que agregues aparecerán acá.</p> : <div className="local-sale-photo-list">{lines.map((line) => <article key={line.id} className="local-sale-photo-item">
        <div className="local-sale-photo-frame">{line.product.imageUrl ? <img src={line.product.imageUrl} alt={`Foto de ${line.product.name}`} style={line.product.imageCrop ? { transform: `translate(${line.product.imageCrop.x}%, ${line.product.imageCrop.y}%) scale(${line.product.imageCrop.zoom})` } : undefined} /> : <span>Sin foto</span>}</div>
        <div><strong>{line.product.name}</strong>{visibleVariant(line.product.variant) && <small>{visibleVariant(line.product.variant)}</small>}<small>{line.quantity} {line.quantity === 1 ? "unidad" : "unidades"}{line.personalization ? " · Personalizado" : ""}</small></div>
        <div className="local-sale-cost-detail" aria-label={`Desglose de ${line.product.name}`}>
          {line.product.assembly ? priceMateAssembly(line.product.assembly, pricing?.rules).items.map(item => <div key={item.ruleKey}><span>{item.label}</span><b>{money(item.totalMinor / 100)}</b></div>) : <div><span>Precio del artículo</span><b>{money(basePriceMinor(line) / 100)}</b></div>}
          {line.personalization && calculateLocalPersonalizationPrice(line.personalization, pricing).items.map(item => <div key={item.ruleKey}><span>{item.label.replace("Logo", "Íconos / imágenes")}<small>{item.quantity} × {money(item.unitPriceMinor / 100)}</small></span><b>{money(item.totalMinor / 100)}</b></div>)}
          <div className="local-sale-cost-total"><span>Total unitario</span><b>{linePriceReady(line) ? money(unitPriceMinor(line) / 100) : "Precio pendiente"}</b></div>
          {line.personalization && discountPercent > 0 && linePriceReady(line) && <div><span>Descuento {formatPercent(discountPercent)}</span><b>-{money((unitPriceMinor(line) - soldUnitMinor(line)) / 100)}</b></div>}
          {line.quantity > 1 && <div><span>{line.quantity} unidades</span><b>{linePriceReady(line) ? money(line.quantity * soldUnitMinor(line) / 100) : "Precio pendiente"}</b></div>}
        </div>
      </article>)}</div>}
      {lines.length > 0 && <div className="local-sale-cost-detail local-sale-cost-grand" aria-live="polite"><div><strong>Total de la venta</strong><strong>{customPricesReady ? (discountPercent > 0 && listItemsMinor > itemsMinor ? <><s className="local-sale-struck">{money(listItemsMinor / 100)}</s> {money(itemsMinor / 100)}</> : money(itemsMinor / 100)) : "Precio pendiente"}</strong></div></div>}
    </aside>
  </form>;
}
