import { useEffect, useState, type FormEvent } from "react";
import { MagnifyingGlass, PencilSimple, Plus } from "@phosphor-icons/react";
import { canAccess } from "./access";
import { money, type State } from "./data";
import { lineCostUyuMinor } from "./inventoryCostModel";
import { readManufacturedProducts, saveManufacturedProduct, type ManufacturedData, type ManufacturedProduct, type ManufacturedSupply } from "./inventoryManufacturedSource";
import { Modal } from "./ui";
import "./manufacturedProducts.css";

const uyu = (minor: number | null) => minor === null ? "Sin cargar" : `UYU ${money(minor / 100)}`;

export function ManufacturedProducts({ s, notify }: { s: State; notify: (message: string) => void }) {
  const allowed = canAccess(s, "/inventario/fabricados");
  const [data, setData] = useState<ManufacturedData | null>(null);
  const [editing, setEditing] = useState<ManufacturedProduct | null>(null);
  const [selected, setSelected] = useState<Record<string, number>>({});
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  const load = async () => { setData(await readManufacturedProducts()); setError(""); };
  useEffect(() => {
    if (!allowed) return;
    let active = true;
    void readManufacturedProducts().then((result) => { if (active) setData(result); })
      .catch(() => { if (active) setError("No se pudieron cargar los productos fabricados."); });
    return () => { active = false; };
  }, [allowed]);

  if (!allowed) return <section className="manufactured-products"><div role="alert">No tenés acceso a esta sección.</div></section>;
  const articles = data?.articles || [];
  const productArticles = (productId: string | null) => articles.filter((article) => article.product_id === productId);
  const catalogProducts = [...new Map(articles.map((article) => [article.product_id, article])).values()];
  const availableCatalog = catalogProducts.filter((article) => !data?.products.some((product) => product.catalog_product_id === article.product_id && product.id !== editing?.id));
  const categoryName = (code: string) => data?.categories.find((category) => category.code === code)?.label_es || code;
  const availableCategories = (data?.categories || []).filter((category) => availableCatalog.some((article) => article.category_code === category.code));
  const editingIsNew = Boolean(editing && !data?.products.some((product) => product.id === editing.id));
  const profileCategory = (profileId: string) => data?.profiles.find((profile) => profile.id === profileId)?.category_code;
  const usableLines = (categoryCode: string) => (data?.lines || []).filter((line) =>
    (line.kind === "material" || line.kind === "supply") && profileCategory(line.profile_id) === categoryCode);
  const supplySummary = (product: ManufacturedProduct) => {
    const entries = (data?.supplies || []).filter((link) => link.product_id === product.id);
    if (!entries.length) return "Sin insumos vinculados";
    const amounts = entries.map((entry) => {
      const line = data?.lines.find((item) => item.id === entry.cost_line_id);
      const amount = line ? lineCostUyuMinor(line) : null;
      return amount === null ? null : Math.round(amount * entry.quantity);
    });
    return amounts.some((amount) => amount === null)
      ? `${entries.length} insumos, costo pendiente`
      : `${entries.length} insumos, ${uyu(amounts.reduce<number>((sum, amount) => sum + (amount || 0), 0))}`;
  };
  const basePriceValues = (productId: string | null) => productId
    ? [...new Set(productArticles(productId).map((article) => article.base_price_minor).filter((value): value is number => value !== null))].sort((a, b) => a - b)
    : [];
  const basePrice = (productId: string | null) => {
    if (!productId) return "Sin vincular";
    const values = basePriceValues(productId);
    if (!values.length) return "Sin precio base";
    return values.length === 1 ? uyu(values[0]) : `${uyu(values[0])} a ${uyu(values[values.length - 1])}`;
  };
  const gain = (product: ManufacturedProduct) => {
    const values = basePriceValues(product.catalog_product_id);
    const cost = product.reference_variable_cost_minor;
    if (!values.length || cost === null) return null;
    return values.length === 1 ? uyu(values[0] - cost) : `${uyu(values[0] - cost)} a ${uyu(values[values.length - 1] - cost)}`;
  };
  const visibleProducts = (data?.products || []).filter((product) => {
    const variants = productArticles(product.catalog_product_id);
    return [product.name, variants[0]?.product_name, categoryName(product.category_code), ...variants.map((variant) => variant.sku)]
      .filter(Boolean).join(" ").toLocaleLowerCase("es").includes(search.trim().toLocaleLowerCase("es"));
  });
  const openEdit = (product: ManufacturedProduct) => {
    setEditing(product);
    setSelected(Object.fromEntries((data?.supplies || []).filter((item) => item.product_id === product.id)
      .map((item) => [item.cost_line_id, item.quantity])));
    setFormError("");
  };
  const openNew = () => {
    if (!availableCatalog.length) { setError("No hay productos del catálogo disponibles."); return; }
    setEditing({ id: crypto.randomUUID(), source_key: null, name: "",
      category_code: "", catalog_product_id: null,
      reference_sale_price_minor: null, reference_variable_cost_minor: null, source_row: null });
    setSelected({});
    setFormError("");
  };
  const chooseCategory = (categoryCode: string) => {
    setEditing((current) => current ? { ...current, category_code: categoryCode, catalog_product_id: null, name: "" } : current);
    setSelected({});
  };
  const chooseCatalog = (productId: string) => {
    if (editing?.catalog_product_id === productId) return;
    const article = catalogProducts.find((item) => item.product_id === productId);
    const categoryChanged = Boolean(article && editing && article.category_code !== editing.category_code);
    setEditing((current) => {
      if (!current) return current;
      return article ? { ...current, catalog_product_id: article.product_id, category_code: article.category_code,
        name: current.source_key ? current.name : article.product_name } : { ...current, catalog_product_id: null };
    });
    if (categoryChanged) setSelected({});
  };
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!editing || saving) return;
    if (!editing.catalog_product_id && !editing.source_key) { setFormError("Elegí una categoría y un producto del catálogo."); return; }
    const selections: ManufacturedSupply[] = Object.entries(selected).map(([cost_line_id, quantity]) => ({ product_id: editing.id, cost_line_id, quantity }));
    if (selections.some((item) => !Number.isFinite(item.quantity) || item.quantity <= 0)) { setFormError("Las cantidades de insumos deben ser mayores que cero."); return; }
    setSaving(true);
    try {
      await saveManufacturedProduct(editing, selections);
      await load();
      setEditing(null);
      notify("Producto fabricado guardado.");
    } catch { setFormError("No se pudo guardar el producto o sus insumos."); }
    finally { setSaving(false); }
  };

  return <section className="manufactured-products">
    {error && <div role="alert" className="manufactured-products-error">{error}</div>}
    {!data ? !error && <div role="status">Cargando productos fabricados...</div> : <>
      <div className="table-tools no-title manufactured-products-toolbar"><div className="table-actions">
        <label className="search"><MagnifyingGlass size={18} aria-hidden="true" /><input aria-label="Buscar productos fabricados" placeholder="Buscar…" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
        <button type="button" className="primary" onClick={openNew}><Plus size={18} aria-hidden="true" />Agregar producto</button>
      </div></div>
      <div className="manufactured-products-table-wrap"><table className="manufactured-products-table">
        <thead><tr><th scope="col">Nombre del producto</th><th scope="col">SKU</th><th scope="col">Categoría</th>
          <th scope="col">Costo</th><th scope="col">Precio de venta base</th><th scope="col">Ganancia</th>
          <th scope="col">Insumos vinculados</th><th scope="col">Acciones</th></tr></thead>
        <tbody>{visibleProducts.map((product) => {
          const variants = productArticles(product.catalog_product_id);
          const skus = [...new Set(variants.map((variant) => variant.sku).filter(Boolean))];
          return <tr key={product.id}>
            <th scope="row">{variants[0]?.product_name || product.name}</th>
            <td data-label="SKU" className={skus.length ? "manufactured-products-skus" : "manufactured-products-muted"}>{skus.length ? skus.join(", ") : "Sin vincular"}</td>
            <td data-label="Categoría">{categoryName(product.category_code)}</td>
            <td data-label="Costo" className="manufactured-products-value">{product.reference_variable_cost_minor === null ? "Sin costo cargado" : uyu(product.reference_variable_cost_minor)}</td>
            <td data-label="Precio de venta base" className="manufactured-products-value">{basePrice(product.catalog_product_id)}</td>
            <td data-label="Ganancia" className={gain(product) === null ? "manufactured-products-muted" : "manufactured-products-gain"}>{gain(product) ?? "Sin calcular"}</td>
            <td data-label="Insumos vinculados" className="manufactured-products-supply-total">{supplySummary(product)}</td>
            <td data-label="Acciones" className="manufactured-products-actions-cell"><button type="button" className="secondary manufactured-products-edit" aria-label="Editar" title={`Editar ${variants[0]?.product_name || product.name}`} onClick={() => openEdit(product)}><PencilSimple size={18} aria-hidden="true" /></button></td>
          </tr>;
        })}</tbody>
      </table></div>
      {!visibleProducts.length && <div className="manufactured-products-empty">{search ? "No hay coincidencias con esta búsqueda." : "Todavía no hay productos fabricados cargados."}</div>}
    </>}
    {editing && data && <Modal title={editingIsNew ? "Agregar producto fabricado" : "Editar producto fabricado"} onClose={() => setEditing(null)} className={`manufactured-products-modal ${editingIsNew ? "manufactured-products-modal--new" : "manufactured-products-modal--edit"}`}>
      <form className="manufactured-products-form" onSubmit={save}>
        {editing.source_key && <div className="manufactured-products-reference">Referencia de planilla: {editing.name}. Costo {uyu(editing.reference_variable_cost_minor)}.</div>}
        <div className="manufactured-products-selection">
          {editingIsNew ? <label>Categoría<select required value={editing.category_code} onChange={(event) => chooseCategory(event.target.value)}>
            <option value="">Elegí una categoría</option>
            {availableCategories.map((category) => <option key={category.code} value={category.code}>{category.label_es}</option>)}
          </select></label> : <div className="manufactured-products-category"><small>Categoría</small><strong>{categoryName(editing.category_code)}</strong></div>}
          <label>Producto del catálogo<select value={editing.catalog_product_id || ""} onChange={(event) => chooseCatalog(event.target.value)} required={editingIsNew} disabled={editingIsNew && !editing.category_code}>
            <option value="">{editingIsNew ? "Elegí un producto" : "Sin vincular"}</option>
            {availableCatalog.filter((article) => article.category_code === editing.category_code)
              .map((article) => <option key={article.product_id} value={article.product_id}>{article.product_name}</option>)}
          </select></label>
        </div>
        {(editing.catalog_product_id || !editingIsNew) && <fieldset className="manufactured-products-supplies"><legend>Insumos de {categoryName(editing.category_code)}</legend>
          {usableLines(editing.category_code).length ? <>
            <div className="manufactured-products-supply-head" aria-hidden="true"><strong>Insumo</strong><strong>Costo unitario</strong><strong>Cantidad</strong></div>
            {usableLines(editing.category_code).map((line) => <div className="manufactured-products-supply" key={line.id}>
            <label className="manufactured-products-supply-name"><input type="checkbox" checked={selected[line.id] !== undefined} onChange={(event) => setSelected((current) => {
              const next = { ...current };
              if (event.target.checked) next[line.id] = 1; else delete next[line.id];
              return next;
            })} />{line.name}</label>
            <output data-label="Costo unitario" className="manufactured-products-supply-cost">{lineCostUyuMinor(line) === null ? "Sin costo cargado" : uyu(lineCostUyuMinor(line))}</output>
            <div data-label="Cantidad" className="manufactured-products-supply-quantity">{selected[line.id] !== undefined ? <input aria-label={`Cantidad de ${line.name}`} type="number" min="0.0001" step="0.0001" value={selected[line.id]}
              onChange={(event) => setSelected((current) => ({ ...current, [line.id]: Number(event.target.value) }))} /> : "—"}</div>
          </div>)}</> : <div className="manufactured-products-empty">Todavía no hay insumos en esta categoría. Podés cargarlos en Insumos.</div>}
        </fieldset>}
        {formError && <div role="alert" className="manufactured-products-error">{formError}</div>}
        <div className="manufactured-products-actions"><button type="button" className="secondary" onClick={() => setEditing(null)}>Cancelar</button><button type="submit" className="primary" disabled={saving}>{saving ? "Guardando..." : "Guardar"}</button></div>
      </form>
    </Modal>}
  </section>;
}
