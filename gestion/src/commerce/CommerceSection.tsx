import { useState } from 'react';
import type { PageProps } from '../pages';
import { CommerceShipping } from '../CommerceShipping';
import { Rates, Settings } from './Operations';
import { Discounts } from './DiscountsView';
import { TaxonomyManager } from './TaxonomyManager';
import { InternationalShipping } from './InternationalShippingView';
import { Announcements } from './Announcements';

export function CommerceSection({ path, notify, commerce }: PageProps & { path: string }) {
  const [shipping, setShipping] = useState('Tarifas y simulador');
  return <div className="commerce-tools">
    {path === 'marketing/descuentos' && <Discounts onNotice={notify} />}
    {path === 'marketing/avisos' && <Announcements onNotice={notify} />}
    {path === 'productos/categorias' && <TaxonomyManager onNotice={notify} />}
    {path === 'productos/ajustes' && <Settings onNotice={notify} section="pricing" />}
    {path === 'finanzas/monedas' && <Rates onNotice={notify} wholesaleRate={commerce?.wholesale?.exchangeRate} />}
    {path === 'administracion/canales' && <Settings section="payments" onNotice={notify} />}
    {path === 'entregas/tarifas' && <>
      <div className="tabs">{['Tarifas y simulador', 'Editar tarifas internacionales'].map(value => <button key={value} className={value === shipping ? 'active' : ''} onClick={() => setShipping(value)}>{value}</button>)}</div>
      {shipping === 'Tarifas y simulador' ? <CommerceShipping snapshot={commerce} /> : <InternationalShipping onNotice={notify} />}
    </>}
  </div>;
}
