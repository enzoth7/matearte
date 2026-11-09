import { useEffect, useState, type FormEvent } from "react";
import { MagnifyingGlass, PencilSimple, Plus } from "@phosphor-icons/react";
import { accessUserId } from "./access";
import { money, type State } from "./data";
import { financeAmountLabel, readCurrentFinanceRate } from "./financeCurrency";
import { lineCostUyuMinor, type CostCurrency, type CostLine, type CostProfile } from "./inventoryCostModel";
import { ensureInventoryCostProfile, readInventoryCosts, saveInventoryCostLine, type CostArticle, type CostCategory } from "./inventoryCostSource";
import { Modal } from "./ui";
import "./inventoryCosts.css";

type Section = "insumos" | "reventa";
const groups = ["Cuerpo", "Cuero", "Fleje", "Virola", "Pie y posamate", "Consumibles", "Otros"];
const uyu = (minor: number | null) => minor === null ? "Sin costo cargado" : `UYU ${money(minor / 100)}`;
const numberText = (value: number | null) => value === null ? "" : String(value).replace(".", ",");

export function InventoryCosts({ s, notify, section }: { s: State; notify: (message: string) => void; section: Section }) {
  const [profiles, setProfiles] = useState<CostProfile[]>([]);
  const [lines, setLines] = useState<CostLine[]>([]);
  const [categories, setCategories] = useState<CostCategory[]>([]);
  const [articles, setArticles] = useState<CostArticle[]>([]);
  const [editing, setEditing] = useState<CostLine | null>(null);
  const [editingCategoryCode, setEditingCategoryCode] = useState("");
  const [editingArticleId, setEditingArticleId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [search, setSearch] = useState("");
  const allowed = accessUserId(s) === "t1";

  const load = async () => {
    const result = await readInventoryCosts();
    setProfiles(result.profiles);
    setLines(result.lines);
    setCategories(result.categories);
    setArticles(result.articles);
    setError("");
  };
  useEffect(() => {
    if (!allowed) return;
    let active = true;
    void readInventoryCosts().then((result) => {
      if (active) { setProfiles(result.profiles); setLines(result.lines); setCategories(result.categories); setArticles(result.articles); setError(""); }
    }).catch(() => { if (active) setError("No se pudieron cargar los insumos."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [allowed]);

  if (!allowed) return <section className="inventory-costs"><div role="alert">Esta sección está disponible solo para Richard.</div></section>;
  const profileFor = (line: CostLine) => profiles.find((item) => item.id === line.profile_id);
  const articleFor = (line: CostLine) => articles.find((article) => article.variant_id === line.catalog_variant_id);
  const categoryName = (code: string) => categories.find((item) => item.code === code)?.label_es || profiles.find((item) => item.category_code === code)?.name || code;
  const availableCategories = categories.filter((item) => item.active || profiles.some((profile) => profile.category_code === item.code));
  const visible = lines.filter((line) => section === "insumos"
    ? line.kind === "material" || line.kind === "supply"
    : line.kind === "purchase" && Boolean(line.catalog_variant_id));
  const selectableArticles = articles.filter((article) =>
    (article.active || article.variant_id === editingArticleId)
    && availableCategories.some((category) => category.code === article.category_code)
    && !visible.some((line) => line.catalog_variant_id === article.variant_id && line.id !== editing?.id));
  const availableArticles = selectableArticles.filter((article) => section !== "reventa" || article.category_code === editingCategoryCode);
  const resaleCategories = availableCategories.filter((category) => selectableArticles.some((article) => article.category_code === category.code));
  const ordered = [...visible].sort((a, b) => {
    const groupOrder = (name: string) => groups.indexOf(name) < 0 ? groups.length : groups.indexOf(name);
    const aCategory = profileFor(a)?.category_code || "";
    const bCategory = profileFor(b)?.category_code || "";
    return (aCategory === bCategory ? 0 : aCategory === "mates" ? -1 : bCategory === "mates" ? 1 : categoryName(aCategory).localeCompare(categoryName(bCategory), "es"))
      || groupOrder(a.group_name || "Otros") - groupOrder(b.group_name || "Otros") || a.sort_order - b.sort_order;
  });
  const filtered = ordered.filter((line) => {
    const article = articleFor(line);
    return [line.name, line.group_name, categoryName(profileFor(line)?.category_code || ""), article?.product_name, article?.variant_name, article?.sku]
      .filter(Boolean).join(" ").toLocaleLowerCase("es").includes(search.trim().toLocaleLowerCase("es"));
  });
  const setField = <K extends keyof CostLine>(key: K, value: CostLine[K]) => setEditing((current) => current ? { ...current, [key]: value } : current);
  const openNew = () => {
    const category = availableCategories.find((item) => item.code === "mates") || availableCategories[0];
    if (section === "insumos" && !category) { setError("No hay categorías disponibles para cargar insumos."); return; }
    if (section === "reventa" && !selectableArticles.length) { setError("No hay artículos disponibles para cargar."); return; }
    setFormError("");
    setEditingCategoryCode(section === "reventa" ? "" : category?.code || "");
    setEditingArticleId("");
    setEditing({ id: crypto.randomUUID(), profile_id: section === "insumos" ? profiles.find((item) => item.category_code === category?.code)?.id || "" : "", name: "", group_name: "Otros",
      kind: section === "insumos" ? "supply" : "purchase", catalog_variant_id: null, mode: "per_product", amount_minor: null,
      currency: "UYU", exchange_rate_to_uyu: null, purchase_quantity: null,
      consumption_quantity: null, unit: null, sort_order: Math.max(0, ...visible.map((line) => line.sort_order)) + 10 });
  };
  const changeCurrency = (currency: CostCurrency) => {
    setEditing((current) => current ? { ...current, currency, exchange_rate_to_uyu: null } : current);
    if (currency !== "UYU") void readCurrentFinanceRate(currency).then((rate) => {
      setEditing((current) => current?.currency === currency && current.exchange_rate_to_uyu === null
        ? { ...current, exchange_rate_to_uyu: rate } : current);
    }).catch(() => notify(`No se pudo cargar la cotización de ${currency}. Ingresala manualmente.`));
  };
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!editing || saving) return;
    if (section === "insumos" && !editing.name.trim()) { setFormError("Escribí el nombre."); return; }
    if (editing.amount_minor !== null && (!Number.isSafeInteger(editing.amount_minor) || editing.amount_minor < 0)) { setFormError("Ingresá un importe válido."); return; }
    if (editing.amount_minor !== null && editing.currency !== "UYU" && (!editing.exchange_rate_to_uyu || editing.exchange_rate_to_uyu <= 0)) { setFormError("Ingresá la cotización a UYU."); return; }
    if (section === "insumos" && editing.mode === "purchase_quantity" && (!editing.purchase_quantity || !editing.consumption_quantity || !editing.unit?.trim())) { setFormError("Completá las cantidades y su unidad."); return; }
    if (section === "insumos" && (!editing.group_name?.trim() || editing.group_name.trim().length > 60)) { setFormError("Ingresá un grupo de hasta 60 caracteres."); return; }
    setSaving(true);
    try {
      const article = articles.find((item) => item.variant_id === editingArticleId);
      if (section === "reventa" && (!article || !availableArticles.some((item) => item.variant_id === editingArticleId))) {
        setFormError("Elegí un artículo disponible del catálogo."); return;
      }
      const categoryCode = section === "insumos" ? editingCategoryCode : article!.category_code;
      const category = availableCategories.find((item) => item.code === categoryCode);
      if (!category) { setFormError("Elegí una categoría del catálogo."); return; }
      const profileId = await ensureInventoryCostProfile(category, profiles, section === "reventa" ? "reventa" : "fabricacion");
      await saveInventoryCostLine({ ...editing, profile_id: profileId,
        name: section === "reventa" ? `${article!.product_name} - ${article!.variant_name}` : editing.name,
        catalog_variant_id: section === "reventa" ? article!.variant_id : null });
      await load();
      setEditing(null);
      notify(section === "insumos" ? "Insumo guardado." : "Costo de reventa guardado.");
    } catch { setFormError("No se pudo guardar el importe."); }
    finally { setSaving(false); }
  };

  return <section className={`inventory-costs inventory-costs--${section}`}>
    {error && <div className="inventory-costs-error" role="alert">{error}</div>}
    {loading ? <div role="status">Cargando {section}...</div> : <div className="inventory-costs-panel">
      <div className="table-tools no-title inventory-costs-toolbar">
        <div className="table-actions">
          <label className="search"><MagnifyingGlass size={18} aria-hidden="true" /><input aria-label={section === "insumos" ? "Buscar insumos" : "Buscar artículos de reventa"} placeholder="Buscar…" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
          <button type="button" className="primary" onClick={openNew}><Plus size={18} aria-hidden="true" />{section === "insumos" ? "Agregar insumo" : "Agregar artículo"}</button>
        </div>
      </div>
      <div className="inventory-costs-table-wrap">
        <table className="inventory-costs-table">
          <thead><tr>
            <th scope="col">{section === "insumos" ? "Insumo" : "Artículo"}</th>
            {section === "insumos" && <th scope="col">Grupo</th>}
            <th scope="col">Categoría</th><th scope="col">{section === "reventa" ? "Costo de compra" : "Importe"}</th>
            {section === "reventa" && <th scope="col">Precio de venta base</th>}
            <th scope="col">Acciones</th>
          </tr></thead>
          <tbody>{filtered.map((line) => <tr key={line.id}>
            <th scope="row">{section === "reventa" ? articleFor(line)?.product_name || line.name : line.name}
              {section === "reventa" && articleFor(line) && <small>{articleFor(line)!.variant_name} (SKU {articleFor(line)!.sku})</small>}
              {section === "insumos" && line.mode === "purchase_quantity" && <small>Compra: {numberText(line.purchase_quantity)} {line.unit}; uso: {numberText(line.consumption_quantity)}</small>}
            </th>
            {section === "insumos" && <td data-label="Grupo">{line.group_name || "Otros"}</td>}
            <td data-label="Categoría">{categoryName(section === "reventa" ? articleFor(line)?.category_code || "" : profileFor(line)?.category_code || "")}</td>
            <td data-label={section === "reventa" ? "Costo de compra" : "Importe"} className={line.amount_minor === null ? "inventory-costs-missing" : "inventory-costs-value"}>{line.amount_minor === null ? "Sin costo cargado" : financeAmountLabel(line.amount_minor, line.currency)}{line.amount_minor !== null && line.currency !== "UYU" && <small>{uyu(lineCostUyuMinor(line))}</small>}</td>
            {section === "reventa" && <td data-label="Precio de venta base" className="inventory-costs-value">{uyu(articleFor(line)?.base_price_minor ?? null)}</td>}
            <td data-label="Acciones" className="inventory-costs-actions-cell"><button type="button" className="secondary inventory-costs-edit" aria-label="Editar" title={`Editar ${section === "reventa" ? articleFor(line)?.product_name || line.name : line.name}`} onClick={() => { setFormError(""); setEditingCategoryCode(section === "reventa" ? articleFor(line)?.category_code || "" : profileFor(line)?.category_code || ""); setEditingArticleId(line.catalog_variant_id || ""); setEditing(line); }}><PencilSimple size={18} aria-hidden="true" /></button></td>
          </tr>)}</tbody>
        </table>
      </div>
      {filtered.length === 0 && <div className="inventory-costs-empty">{search ? "No hay coincidencias con esta búsqueda." : section === "reventa" ? "Todavía no hay artículos de reventa cargados." : "Todavía no hay insumos cargados."}</div>}
    </div>}
    {editing && <Modal title={section === "reventa" ? "Artículo de reventa" : editing.name || "Agregar insumo"} onClose={() => setEditing(null)} className="inventory-costs-modal"><form className="inventory-costs-form" onSubmit={save}>
      {section === "insumos" ? <label>Nombre<input required maxLength={120} value={editing.name} onChange={(event) => setField("name", event.target.value)} /></label>
        : <div className="inventory-costs-article-pickers"><label>Categoría<select required value={editingCategoryCode} onChange={(event) => { setEditingCategoryCode(event.target.value); setEditingArticleId(""); }}>
          <option value="">Elegí una categoría</option>
          {resaleCategories.map((category) => <option key={category.code} value={category.code}>{category.label_es}</option>)}
        </select></label><label>Artículo<select required disabled={!editingCategoryCode} value={editingArticleId} onChange={(event) => setEditingArticleId(event.target.value)}>
          <option value="">Elegí un artículo</option>
          {availableArticles.map((article) => <option key={article.variant_id} value={article.variant_id}>
            {article.product_name} - {article.variant_name} (SKU {article.sku})
          </option>)}
        </select></label></div>}
      {section === "insumos" && <>
        <label>Grupo<input required maxLength={60} list="inventory-cost-groups" value={editing.group_name || ""} onChange={(event) => setField("group_name", event.target.value)} /></label>
        <datalist id="inventory-cost-groups">{groups.map((group) => <option key={group} value={group} />)}</datalist>
        <label>Categoría<select required value={editingCategoryCode} onChange={(event) => setEditingCategoryCode(event.target.value)}>{availableCategories.map((category) => <option key={category.code} value={category.code}>{category.label_es}</option>)}</select></label>
      </>}
      {section === "insumos" && <label>Cómo se calcula<select value={editing.mode} onChange={(event) => setEditing({ ...editing, mode: event.target.value as CostLine["mode"], purchase_quantity: null, consumption_quantity: null, unit: null })}><option value="per_product">Importe cargado</option><option value="purchase_quantity">Compra y cantidad utilizada</option></select></label>}
      <div className="inventory-costs-form-grid"><label>{section === "reventa" ? "Costo de compra" : "Importe"} en {editing.currency}<input type="number" min="0" step="0.01" value={editing.amount_minor === null ? "" : editing.amount_minor / 100} onChange={(event) => setField("amount_minor", event.target.value === "" ? null : Math.round(Number(event.target.value) * 100))} placeholder="Sin cargar" /></label><label>Moneda<select value={editing.currency} onChange={(event) => changeCurrency(event.target.value as CostCurrency)}><option>UYU</option><option>ARS</option><option>USD</option></select></label></div>
      {editing.currency !== "UYU" && <label>Cotización UYU por {editing.currency}<input type="number" min="0.00000001" step="0.00000001" value={editing.exchange_rate_to_uyu ?? ""} onChange={(event) => setField("exchange_rate_to_uyu", event.target.value === "" ? null : Number(event.target.value))} /></label>}
      {editing.mode === "purchase_quantity" && <div className="inventory-costs-form-grid"><label>Cantidad comprada<input type="number" min="0.0001" step="0.0001" value={editing.purchase_quantity ?? ""} onChange={(event) => setField("purchase_quantity", event.target.value === "" ? null : Number(event.target.value))} /></label><label>Cantidad utilizada<input type="number" min="0.0001" step="0.0001" value={editing.consumption_quantity ?? ""} onChange={(event) => setField("consumption_quantity", event.target.value === "" ? null : Number(event.target.value))} /></label><label>Unidad<input maxLength={30} placeholder="Ej.: metros, gramos, unidades" value={editing.unit ?? ""} onChange={(event) => setField("unit", event.target.value)} /></label></div>}
      {formError && <div role="alert" className="inventory-costs-error">{formError}</div>}
      <div className="inventory-costs-actions"><button type="button" className="secondary" onClick={() => setEditing(null)}>Cancelar</button><button type="submit" className="primary" disabled={saving}>{saving ? "Guardando..." : "Guardar"}</button></div>
    </form></Modal>}
  </section>;
}
