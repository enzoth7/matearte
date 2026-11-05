import { useEffect, useState } from "react";
import { ArrowCounterClockwise, Plus } from "@phosphor-icons/react";
import type { Product } from "./data";
import { money } from "./data";
import { changeCustomFacet, customFacetCodes, customFacetLabel, customFacetLabels, customFacetValues, customModelLabel, matchingCustomProducts, UNSPECIFIED } from "./customArticleFacets";

export { customModelLabel } from "./customArticleFacets";

export function CustomArticlePicker({ products, onAdd, priceForProduct, priceLabel, showProductNames = false }: { products: Product[]; onAdd: (product: Product, selectedOptions?: Record<string, string>) => void; priceForProduct: (product: Product) => number; priceLabel: string; showProductNames?: boolean }) {
  const [model, setModel] = useState("");
  const [chosen, setChosen] = useState<Record<string, string>>({});
  const [priceChoice, setPriceChoice] = useState("");
  const [productChoice, setProductChoice] = useState("");
  useEffect(() => setPriceChoice(""), [priceLabel]);
  const models = [...new Set(products.map(customModelLabel))].sort();
  const modelProducts = products.filter(p => customModelLabel(p) === model);
  const facets = customFacetCodes.filter(code => (!showProductNames || code !== "color") && modelProducts.some(p => customFacetValues(p, code).some(value => value !== UNSPECIFIED)));
  const candidates = matchingCustomProducts(modelProducts, chosen);
  const namedCandidates = [...candidates].sort((a, b) => a.name.localeCompare(b.name, "es") || a.sku.localeCompare(b.sku, "es", { numeric: true }));
  const resolved: Record<string, string> = {};
  const fields = facets.map(code => {
    const options = [...new Set(modelProducts.flatMap(p => customFacetValues(p, code)))].sort((a, b) => customFacetLabel(code, a).localeCompare(customFacetLabel(code, b), "es"));
    const compatible = new Set(candidates.flatMap(p => customFacetValues(p, code)));
    const value = chosen[code] || (compatible.size === 1 ? [...compatible][0] : "");
    if (value) resolved[code] = value;
    return <label key={code}>{customFacetLabels[code]}<select aria-label={customFacetLabels[code]} value={value} onChange={event => {
      setPriceChoice("");
      setProductChoice("");
      setChosen(current => changeCustomFacet(modelProducts, current, code, event.target.value));
    }}><option value="">Elegir</option>{options.map(option => <option key={option} value={option}>{customFacetLabel(code, option)}{compatible.has(option) ? "" : " (cambia la combinación)"}</option>)}</select></label>;
  });
  const complete = facets.every(code => Boolean(resolved[code]));
  const prices = [...new Set(candidates.map(priceForProduct))];
  const product = !complete ? undefined : showProductNames
    ? candidates.find(p => p.id === productChoice)
    : [...candidates].sort((a, b) => a.sku.localeCompare(b.sku, "es", { numeric: true })).find(p => prices.length <= 1 || String(priceForProduct(p)) === priceChoice);
  const purchaseSelection = Object.fromEntries(["interior", "tamano"].filter(code => resolved[code] && resolved[code] !== UNSPECIFIED).map(code => [code, resolved[code]]));
  return <div className="local-custom-builder">
    <div className="local-sale-custom-picker">
      <label>Modelo<select aria-label="Modelo" value={model} onChange={event => { setModel(event.target.value); setChosen({}); setPriceChoice(""); setProductChoice(""); }}><option value="">Elegir modelo</option>{models.map(value => <option key={value}>{value}</option>)}</select></label>
      {fields}
      {showProductNames && model && <label>Nombre<select aria-label="Nombre" value={productChoice} onChange={event => setProductChoice(event.target.value)}><option value="">Elegir nombre</option>{namedCandidates.map(candidate => <option key={candidate.id} value={candidate.id}>{candidate.name}{namedCandidates.some(other => other.id !== candidate.id && other.name === candidate.name) ? ` (SKU ${candidate.sku})` : ""}</option>)}</select></label>}
      {!showProductNames && complete && prices.length > 1 && <label>{priceLabel}<select value={priceChoice} onChange={event => setPriceChoice(event.target.value)}><option value="">Elegir precio</option>{prices.map(price => <option key={price} value={price}>{money(price)}</option>)}</select></label>}
    </div>
    {model && <div className="local-custom-builder-summary"><span>{showProductNames ? `${candidates.length} ${candidates.length === 1 ? "artículo disponible" : "artículos disponibles"}. Elegí el nombre del artículo.` : `${candidates.length} ${candidates.length === 1 ? "variante compatible" : "variantes compatibles"}. Elegí las características del artículo; podés cambiarlas en cualquier orden.`}</span><button type="button" className="secondary" onClick={() => { setChosen({}); setPriceChoice(""); setProductChoice(""); }}><ArrowCounterClockwise size={16} />Reiniciar combinación</button></div>}
    <button type="button" className="secondary" disabled={!product} onClick={() => { if (product) onAdd(product, purchaseSelection); }}><Plus size={17} />Agregar personalizado{product ? `: ${money(priceForProduct(product))}` : ""}</button>
  </div>;
}
