import { useState } from "react";
import { ArrowCounterClockwise, Plus } from "@phosphor-icons/react";
import type { Product } from "./data";
import { money } from "./data";
import { changeCustomFacet, customFacetCodes, customFacetLabel, customFacetLabels, customFacetValues, customModelLabel, matchingCustomProducts, UNSPECIFIED } from "./customArticleFacets";

export { customModelLabel } from "./customArticleFacets";

export function CustomArticlePicker({ products, onAdd }: { products: Product[]; onAdd: (product: Product, selectedOptions?: Record<string, string>) => void }) {
  const [model, setModel] = useState("");
  const [chosen, setChosen] = useState<Record<string, string>>({});
  const [priceChoice, setPriceChoice] = useState("");
  const models = [...new Set(products.map(customModelLabel))].sort();
  const modelProducts = products.filter(p => customModelLabel(p) === model);
  const facets = customFacetCodes.filter(code => modelProducts.some(p => customFacetValues(p, code).some(value => value !== UNSPECIFIED)));
  const candidates = matchingCustomProducts(modelProducts, chosen);
  const resolved: Record<string, string> = {};
  const fields = facets.map(code => {
    const options = [...new Set(modelProducts.flatMap(p => customFacetValues(p, code)))].sort((a, b) => customFacetLabel(code, a).localeCompare(customFacetLabel(code, b), "es"));
    const compatible = new Set(candidates.flatMap(p => customFacetValues(p, code)));
    const value = chosen[code] || (compatible.size === 1 ? [...compatible][0] : "");
    if (value) resolved[code] = value;
    return <label key={code}>{customFacetLabels[code]}<select aria-label={customFacetLabels[code]} value={value} onChange={event => {
      setPriceChoice("");
      setChosen(current => changeCustomFacet(modelProducts, current, code, event.target.value));
    }}><option value="">Elegir</option>{options.map(option => <option key={option} value={option}>{customFacetLabel(code, option)}{compatible.has(option) ? "" : " · cambia la combinación"}</option>)}</select></label>;
  });
  const complete = facets.every(code => Boolean(resolved[code]));
  const prices = [...new Set(candidates.map(p => p.prices.Local))];
  const product = complete ? [...candidates].sort((a, b) => a.sku.localeCompare(b.sku, "es", { numeric: true })).find(p => prices.length <= 1 || String(p.prices.Local) === priceChoice) : undefined;
  const purchaseSelection = Object.fromEntries(["interior", "tamano"].filter(code => resolved[code] && resolved[code] !== UNSPECIFIED).map(code => [code, resolved[code]]));
  return <div className="local-custom-builder">
    <div className="local-sale-custom-picker">
      <label>Modelo<select aria-label="Modelo" value={model} onChange={event => { setModel(event.target.value); setChosen({}); setPriceChoice(""); }}><option value="">Elegir modelo</option>{models.map(value => <option key={value}>{value}</option>)}</select></label>
      {fields}
      {complete && prices.length > 1 && <label>Precio base<select value={priceChoice} onChange={event => setPriceChoice(event.target.value)}><option value="">Elegir precio</option>{prices.map(price => <option key={price} value={price}>{money(price)}</option>)}</select></label>}
    </div>
    {model && <div className="local-custom-builder-summary"><span>{candidates.length} {candidates.length === 1 ? "variante compatible" : "variantes compatibles"}. Elegí las características del artículo; podés cambiarlas en cualquier orden.</span><button type="button" className="secondary" onClick={() => { setChosen({}); setPriceChoice(""); }}><ArrowCounterClockwise size={16} />Reiniciar combinación</button></div>}
    <button type="button" className="secondary" disabled={!product} onClick={() => { if (product) onAdd(product, purchaseSelection); }}><Plus size={17} />Agregar personalizado{product ? ` · ${money(product.prices.Local)}` : ""}</button>
  </div>;
}
