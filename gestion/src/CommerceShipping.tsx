import { useState } from "react";
import type { CommerceSnapshot } from "./commerceAdapter";
import type { CommerceShippingRate } from "./commerceSource";
import { Card, Table } from "./ui";
import { LocationLabel } from "./location";
import { money } from "./data";

const zones: [keyof Pick<CommerceShippingRate, "argentina" | "suramerica" | "estados_unidos" | "resto_america" | "espana" | "resto_europa" | "resto_mundo">, string][] = [
  ["argentina", "Argentina"], ["suramerica", "Sudamérica"], ["estados_unidos", "Estados Unidos"],
  ["resto_america", "Resto de América"], ["espana", "España"], ["resto_europa", "Resto de Europa"], ["resto_mundo", "Resto del mundo"],
];
export function CommerceShipping({ snapshot }: { snapshot?: CommerceSnapshot | null }) {
  const [zone, setZone] = useState(zones[0][0]);
  const [grams, setGrams] = useState(500);
  if (!snapshot) return <div className="empty">Sin tarifas cargadas.</div>;
  const rates = snapshot.reference.shippingRates;
  const row = [...rates].sort((a, b) => a.weight_max_g - b.weight_max_g).find((rate) => grams > 0 && grams <= rate.weight_max_g);
  return <>
    <div className="two-grid">
      <Card title="Simular envío internacional">
        <div className="form-grid">
          <label>Destino<select value={zone} onChange={(event) => setZone(event.target.value as typeof zone)}>{zones.map(([code, label]) => <option key={code} value={code}>{label}</option>)}</select></label>
          <label>Peso en gramos<input type="number" min="1" step="1" value={grams} onChange={(event) => setGrams(Number(event.target.value))} /></label>
        </div>
        <div className="quote-total"><LocationLabel place={zones.find(([key]) => key === zone)![1]} /><strong>{row ? money(Number(row[zone])) : "Fuera del tarifario"}</strong></div>
      </Card>
      <Card title="Envíos nacionales y retiros">
        {snapshot.nationalRates.filter((rate) => rate.active).map((rate) => <div className="line-item" key={rate.id}><div>{rate.name}</div><strong>{money(rate.rate_minor / 100)}</strong></div>)}
        {!snapshot.nationalRates.some((rate) => rate.active) && <div className="empty">No hay tarifas activas.</div>}
      </Card>
    </div>
    <Table rows={rates.map((rate) => ({ ...rate, id: String(rate.row_order) }))} searchText={(rate) => rate.weight_label} columns={[
      { label: "Peso (gramos)", render: (rate) => `${rate.weight_min_g}–${rate.weight_max_g}` },
      ...zones.map(([key, label]) => ({ label, render: (rate: CommerceShippingRate) => money(Number(rate[key])) })),
    ]} />
  </>;
}
