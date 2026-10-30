import { RecoveredDesignViews } from "../localDesignPreviews";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Plus } from '@phosphor-icons/react';
import { supabase } from './supabase';
import { INTERNAL_ORDER_CHANNELS } from '../commerceSource';
import { balance, orderName, paid, total, type OrderLine, type Product, type State } from '../data';
import { Badge } from '../ui';
import { compactOrderItemName } from '../orderItemPresentation';
import { naturalCaseName } from '../productionPresentation';
import {
  asRecord,
  customerName,
  customerPhone,
  formatFileSize,
  getPaymentStatusValue,
  getPersonalizedItems,
  paymentStatusLabel,
  personalizedProductionStatus,
  personalizedItemPriceDetail,
  personalizedOrderTotals,
  summarizePersonalization,
  whatsappContactUrl,
  type PersonalizedOrder,
  type PersonalizedOrderItem,
  type PrivateAsset,
  type SurfaceSideSummary,
} from './personalizedOrders';
import { formatDate, formatDateTime } from "../dateFormat";
import { catalogAttributeLabel, defaultCatalogTaxonomy } from "../../../shared/catalog-taxonomy";

type AssetLink = { viewUrl: string; downloadUrl: string };

const money = (minor: number, currency = "UYU") => new Intl.NumberFormat('es-UY', {
  style: 'currency',
  currency, currencyDisplay: 'code',
  minimumFractionDigits: minor % 100 === 0 ? 0 : 2,
  maximumFractionDigits: minor % 100 === 0 ? 0 : 2,
}).format(minor / 100);

const readableDate = (value: string) => formatDateTime(value);
const shortDate = (value: string) => formatDate(value);
const reference = (order: PersonalizedOrder) => order.reference_code || `#${order.order_number}`;
const productTypes = (order: PersonalizedOrder) => [...new Set(getPersonalizedItems(order).map((item) => ({
  mate: 'Mates',
  matera: 'Materas',
  bombilla: 'Bombillas',
  service: 'Servicios',
  aplique: 'Apliques',
})[summarizePersonalization(item).kind]))].join(', ');

function localWorkshopKind(item: OrderLine, product: Product | undefined): PersonalizedOrderItem['workshop_kind'] | null {
  const category = (product?.categoryCode || product?.family || item.family || '').toLocaleLowerCase('es');
  const name = (product?.name || item.productName || item.title).toLocaleLowerCase('es');
  const savedKind = item.personalization?.localPersonalization && typeof item.personalization.localPersonalization === 'object'
    ? (item.personalization.localPersonalization as Record<string, unknown>).kind : null;
  if (savedKind === 'mate' || savedKind === 'matera' || savedKind === 'bombilla') return savedKind;
  if (category.includes('servicio')) return /aplique/.test(name) ? 'aplique' : 'service';
  if (category.includes('aplique')) return 'aplique';
  if (category.includes('bombilla') || /bombill[aoó]n?\b/.test(name)) return 'bombilla';
  if (category.includes('materas-personalizadas') || (item.personalization && /matera/.test(name))) return 'matera';
  if (/aplique/.test(name)) return 'aplique';
  if (/grabado/.test(name)) return 'service';
  if (item.productionNotes && !item.personalization && !/mate\b/.test(name)) return 'service';
  if (item.personalization || category.includes('personaliz') || /(?:personalizad|a medida)/.test(name)) return 'mate';
  return null;
}

export function localPersonalizedOrders(state: State | undefined): PersonalizedOrder[] {
  if (!state) return [];
  const products = new Map(state.products.map((product) => [product.id, product]));
  return state.orders.filter((order) => order.source === 'local').flatMap((order) => {
    const allItems = order.items || [];
    const kinds = new Map(allItems.map((item) => [item.id, localWorkshopKind(item, products.get(item.productId))]));
    if (![...kinds.values()].some(Boolean)) return [];
    const contact = state.customers.find((entry) => entry.id === order.customerId);
    const createdAt = order.createdAt || (order.date.includes('T') ? order.date : `${order.date}T12:00:00-03:00`);
    return [{
      id: `local:${order.id}`,
      source: 'local' as const,
      order_number: order.number || 0,
      reference_code: orderName(order),
      status: order.delivery === 'Enviado' || order.delivery === 'Entregado' ? 'shipped' : 'ready_for_production',
      items_subtotal_minor: Math.round(allItems.reduce((sum, item) => sum + item.amount, 0) * 100),
      shipping_minor: Math.round((order.shippingAmount || 0) * 100),
      payment_fee_minor: Math.round((order.feeAmount || 0) * 100),
      discount_minor: Math.round((order.discountAmount || 0) * 100),
      total_minor: Math.round(total(order) * 100),
      created_at: createdAt,
      paid_at: balance(state, order) === 0 ? createdAt : null,
      payment_label: balance(state, order) > 0 && paid(state, order) > 0 ? 'Pago parcial' : undefined,
      customer_snapshot: {
        fullName: contact?.name || order.customerName || 'Cliente sin nombre',
        email: contact?.email || '',
        phone: contact?.phone || '',
      },
      order_items: allItems.map((item) => {
        const product = products.get(item.productId);
        return {
          id: `local:${item.id}`,
          item_type: kinds.get(item.id) ? 'local_design' : 'catalog',
          workshop_kind: kinds.get(item.id) || undefined,
          source_variant_id: item.productId,
          title: product?.name || naturalCaseName(compactOrderItemName(item)),
          quantity: item.quantity,
          unit_price_minor: Math.round(item.unitPrice * 100),
          total_minor: Math.round(item.amount * 100),
          requires_review: false,
          review_status: null,
          review_reason: null,
          production_status: item.productionStatus || null,
          immutable_snapshot: { ...(item.personalization || {}), ...(item.productionNotes ? { productionNotes: item.productionNotes } : {}) },
        };
      }),
    }];
  });
}

function CloseIcon() {
  return <svg className="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>;
}

function TextList({ values, empty = 'Ninguno' }: { values: string[]; empty?: string }) {
  if (!values.length) return <div className="muted-value">{empty}</div>;
  return <div className="value-chips">{values.map((value, index) => <div key={`${value}-${index}`}>{value}</div>)}</div>;
}

function SurfaceSide({ title, side }: { title: string; side: SurfaceSideSummary }) {
  return (
    <section className="surface-side">
      <h5>{title}</h5>
      <dl className="compact-specs">
        <div><dt>Texto</dt><dd>{side.text || <div className="muted-value">Ninguno</div>}</dd></div>
        <div><dt>Imagen o ícono</dt><dd><TextList values={side.images} /></dd></div>
      </dl>
    </section>
  );
}

function SpecCard({ title, children, personalized }: { title: string; children: ReactNode; personalized: boolean }) {
  return (
    <section className="personalization-card">
      <div className="personalization-card-head">
        <h4>{title}</h4>
        <strong className={personalized ? 'custom-state active' : 'custom-state'}>{personalized ? 'Personalizada' : 'Lisa'}</strong>
      </div>
      {children}
      {!personalized && <div className="plain-note">El cliente no activó esta parte: debe quedar lisa.</div>}
    </section>
  );
}

function useMatePreviewWithoutFrame(source: string | undefined, enabled: boolean) {
  const [preview, setPreview] = useState('');

  useEffect(() => {
    if (!source || !enabled) return;
    setPreview('');
    let cancelled = false;
    let objectUrl = '';
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (!context) throw new Error('Canvas no disponible');
        context.drawImage(image, 0, 0);
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
        const data = pixels.data;
        const isOldFrame = (index: number) => Math.abs(data[index] - 251) <= 3
          && Math.abs(data[index + 1] - 243) <= 3
          && Math.abs(data[index + 2] - 222) <= 3;
        if (!isOldFrame(0)) { if (!cancelled) setPreview(source); return; }

        // Las vistas anteriores llevan el amarillo dentro del PNG. Extendemos
        // el gris de la foto sin alterar el archivo original ni su descarga.
        let gray = [222, 222, 222];
        const sampleY = Math.floor(canvas.height * .15);
        for (let x = Math.floor(canvas.width * .1); x < canvas.width * .5; x++) {
          const index = (sampleY * canvas.width + x) * 4;
          if (!isOldFrame(index) && Math.abs(data[index] - data[index + 1]) < 12
            && Math.abs(data[index + 1] - data[index + 2]) < 12 && data[index] >= 150) {
            gray = [data[index], data[index + 1], data[index + 2]];
            break;
          }
        }
        for (let index = 0; index < data.length; index += 4) {
          if (!isOldFrame(index)) continue;
          data[index] = gray[0];
          data[index + 1] = gray[1];
          data[index + 2] = gray[2];
        }
        context.putImageData(pixels, 0, 0);
        canvas.toBlob((blob) => {
          if (!blob || cancelled) return;
          objectUrl = URL.createObjectURL(blob);
          setPreview(objectUrl);
        }, 'image/png');
      } catch {
        if (!cancelled) setPreview(source);
      }
    };
    image.onerror = () => { if (!cancelled) setPreview(source); };
    image.src = source;
    return () => {
      cancelled = true;
      image.onload = null;
      image.onerror = null;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [source, enabled]);

  return enabled ? preview : source;
}

function AssetCard({ asset, link }: { asset: PrivateAsset; link?: AssetLink }) {
  const isImage = asset.mimeType.startsWith('image/');
  const isMatePreview = asset.kind === 'preview' && asset.role === 'mate';
  const imageUrl = useMatePreviewWithoutFrame(link?.viewUrl, isMatePreview);
  return (
    <article className="customer-asset" data-preview-role={asset.role}>
      <div className={`asset-preview${isMatePreview ? ' asset-preview--mate' : ''}`}>
        {isImage && imageUrl
          ? <img src={imageUrl} alt={`Referencia de personalización: ${asset.name}`} loading="lazy" />
          : <div className="asset-placeholder">{isImage ? 'Cargando imagen…' : 'Archivo adjunto'}</div>}
      </div>
      <div className="asset-caption">
        <strong title={asset.name}>{asset.name}</strong>
        <small>{[asset.mimeType.replace('image/', '').toUpperCase(), formatFileSize(asset.byteSize)].filter(Boolean).join(' · ')}</small>
        {link?.downloadUrl && <a href={link.downloadUrl} target="_blank" rel="noreferrer">{asset.kind === 'preview' ? 'Descargar PNG' : 'Descargar original'}</a>}
      </div>
    </article>
  );
}

export function PersonalizedOrders({ onNotice, state }: { onNotice: (value: string) => void; state?: State }) {
  const [webOrders, setWebOrders] = useState<PersonalizedOrder[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [activeTab, setActiveTab] = useState<'detail' | 'production'>('detail');
  const [loading, setLoading] = useState(true);
  const [assetLinks, setAssetLinks] = useState<Record<string, AssetLink>>({});
  const [assetWarning, setAssetWarning] = useState('');
  const dialogRef = useRef<HTMLDialogElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result: PersonalizedOrder[] = [];
      for (let offset = 0; ; offset += 100) {
        const { data, error, count } = await supabase.from('orders')
          .select('id,order_number,reference_code,status,items_subtotal_minor,shipping_minor,payment_fee_minor,discount_minor,discount_code,total_minor,currency,created_at,paid_at,customer_snapshot,order_items(id,item_type,source_variant_id,title,quantity,unit_price_minor,total_minor,requires_review,review_status,review_reason,production_status,immutable_snapshot)', {count:'exact'})
          .not('channel', 'in', INTERNAL_ORDER_CHANNELS)
          .order('created_at', {ascending:false}).order('id').range(offset, offset + 99);
        if (error) throw error;
        result.push(...(data || []) as PersonalizedOrder[]);
        if (result.length >= (count ?? result.length) || !data?.length) break;
      }
      setWebOrders(result.map((order) => ({ ...order, source: 'web' as const })).filter(order => getPersonalizedItems(order).length > 0));
    } catch(error) {
      onNotice(`No se pudieron cargar los personalizados: ${error && typeof error === 'object' && 'message' in error ? error.message : 'Error de conexión'}`);
    }

    setLoading(false);
  }, [onNotice]);

  useEffect(() => { void load(); }, [load]);

  const orders = useMemo(() => [...webOrders, ...localPersonalizedOrders(state)]
    .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id)), [state, webOrders]);
  const selected = orders.find((order) => order.id === selectedId) || null;
  const selectedTotals = selected ? personalizedOrderTotals(selected) : null;
  const selectedItems = useMemo(() => selected ? getPersonalizedItems(selected) : [], [selected]);
  const itemSummaries = useMemo(() => selectedItems.map((item) => ({ item, summary: summarizePersonalization(item) })), [selectedItems]);
  const files = useMemo(() => [...new Map(itemSummaries.flatMap(({ summary }) => summary.files).map((asset) => [asset.key, asset])).values()], [itemSummaries]);
  const previewCount = itemSummaries.reduce((total, { item, summary }) => { if (summary.kind !== 'mate') return total + summary.previews.length; const c = asRecord(asRecord(item.immutable_snapshot).configuration); const caps = asRecord(c.capabilities); return total + (summary.previews.length || (c.rim ? (caps.hasRim === false ? 0 : 1) + (caps.hasFleje ? 2 : 0) : 0)); }, 0);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (selected && dialog && !dialog.open) dialog.showModal();
    if (!selected && dialog?.open) dialog.close();
  }, [selected]);

  useEffect(() => {
    let alive = true;
    setAssetLinks({});
    setAssetWarning('');
    if (!selected || !files.length) return () => { alive = false; };

    void Promise.all(files.map(async (asset) => {
      const bucket = supabase.storage.from(asset.bucket);
      const [view, download] = await Promise.all([
        bucket.createSignedUrl(asset.path, 15 * 60),
        bucket.createSignedUrl(asset.path, 15 * 60, { download: asset.name }),
      ]);
      if (view.error || download.error || !view.data?.signedUrl || !download.data?.signedUrl) return null;
      return [asset.key, { viewUrl: view.data.signedUrl, downloadUrl: download.data.signedUrl }] as const;
    })).then((entries) => {
      if (!alive) return;
      const validEntries = entries.filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
      setAssetLinks(Object.fromEntries(validEntries));
      if (validEntries.length !== files.length) setAssetWarning('Algún archivo no pudo abrirse. Probá recargar la pestaña.');
    });

    return () => { alive = false; };
  }, [files, selected]);

  const closeDetail = () => {
    dialogRef.current?.close();
    setSelectedId('');
  };

  const printForProduction = () => {
    setActiveTab('production');
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => window.print()));
  };

  const customer = selected ? asRecord(selected.customer_snapshot) : {};
  const email = typeof customer.email === 'string' ? customer.email : '';
  const phone = selected ? customerPhone(selected.customer_snapshot) : '';
  const whatsappUrl = selected ? whatsappContactUrl(selected.customer_snapshot, reference(selected)) : '';
  const itemTitle = (item: PersonalizedOrder['order_items'][number]) => {
    const catalog = state?.products.find((product) => product.id === item.source_variant_id);
    return naturalCaseName(compactOrderItemName({ title: item.title })) || catalog?.name || 'Artículo';
  };
  const itemPhoto = (item: PersonalizedOrderItem) => state?.products.find((product) => product.id === item.source_variant_id)?.imageUrl;

  if (loading) return <div className="loading-inline">Cargando pedidos personalizados…</div>;

  return (
    <>
      <section className="data-panel personalized-orders-panel" aria-label="Pedidos personalizados">
        <div className="table-scroll">
          <table className="data-table personalized-table">
            <thead><tr><th>Pedido</th><th>Fecha</th><th>Cliente</th><th>Productos</th><th>Canal</th><th>Total</th><th>Pago</th><th>Producción</th><th className="action-column">Detalles</th></tr></thead>
            <tbody>
              {orders.map((order) => {
                return <tr key={order.id}>
                  <td><strong>{reference(order)}</strong></td>
                  <td>{shortDate(order.created_at)}</td>
                  <td><strong>{customerName(order.customer_snapshot)}</strong></td>
                  <td>{productTypes(order)}</td>
                  <td><span className={`badge channel-${order.source === 'local' ? 'local' : 'web'}`}>{order.source === 'local' ? 'Local' : 'Web'}</span></td>
                  <td><strong>{money(order.total_minor,order.currency)}</strong></td>
                  <td className="payment-status-cell">
                    <Badge tone={getPaymentStatusValue(order) === 'cancelled' ? 'red' : undefined}>{paymentStatusLabel(order)}</Badge>
                  </td>
                  <td><Badge>{personalizedProductionStatus(order)}</Badge></td>
                  <td className="action-column"><button className="secondary order-details-button personalized-details-button" type="button" onClick={() => { setActiveTab('detail'); setSelectedId(order.id); }} aria-label={`Ver detalle del pedido ${reference(order)}`} title="Ver detalle"><Plus size={18} weight="bold" aria-hidden="true" /></button></td>
                </tr>;
              })}
              {!orders.length && <tr><td className="empty-table" colSpan={9}>Todavía no hay pedidos personalizados.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {createPortal(<div className="commerce-tools personalized-dialog-portal"><dialog ref={dialogRef} className="personalized-dialog" onClose={() => setSelectedId('')} onCancel={(event) => { event.preventDefault(); closeDetail(); }} onMouseDown={(event) => { if (event.target === event.currentTarget) closeDetail(); }}>
        {selected && <div className="dialog-surface">
          <header className="dialog-header">
            <div><h2>Pedido {reference(selected)}</h2><div>{customerName(selected.customer_snapshot)} · {readableDate(selected.created_at)}</div></div>
            <button className="icon-button dialog-close" type="button" onClick={closeDetail} aria-label="Cerrar detalle"><CloseIcon/></button>
          </header>

          <nav className="personalized-dialog-tabs" role="tablist" aria-label="Vistas del pedido">
            <button type="button" id="personalized-detail-tab" role="tab" aria-controls="personalized-detail-panel" aria-selected={activeTab === 'detail'} onClick={() => setActiveTab('detail')}>Detalle del pedido</button>
            <button type="button" id="personalized-production-tab" role="tab" aria-controls="personalized-production-panel" aria-selected={activeTab === 'production'} onClick={() => setActiveTab('production')}>Producción</button>
          </nav>

          <div className="dialog-body">
            <section className={`personalized-tab-panel personalized-tab-panel--detail${activeTab === 'detail' ? ' is-active' : ''}`} id="personalized-detail-panel" role="tabpanel" aria-labelledby="personalized-detail-tab">
              <div className="personalized-panel-intro"><h3>Detalle del pedido</h3><p>Importes cobrados por cada artículo y personalización.</p></div>
              <div className="order-status-grid">
              <div>
                <small>Pago</small>
                <div style={{ marginTop: '0.25rem' }}>
                  <Badge tone={getPaymentStatusValue(selected) === 'cancelled' ? 'red' : undefined}>{paymentStatusLabel(selected)}</Badge>
                </div>
              </div>
              <div><small>Producción</small><strong>{personalizedProductionStatus(selected)}</strong></div>
              <div><small>Origen</small><strong>{selected.source === 'local' ? 'Local' : 'Web'}</strong></div>
              <div><small>Contacto</small><strong>{phone || email || 'Sin contacto guardado'}</strong></div>
              </div>
              <div className="personalized-order-lines">
                <h4>Desglose del pedido</h4>
                {selected.order_items.map(item => {
                  const summary = itemSummaries.find(entry => entry.item.id === item.id)?.summary;
                  const details = summary ? [summary.mate.color, summary.kind === 'mate' ? summary.mate.size : '', summary.kind === 'mate' ? summary.mate.interior : ''].filter((value) => value && value !== 'No especificado' && value !== 'No especificada').join(' · ') : '';
                  const price = personalizedItemPriceDetail(item);
                  return <section className="personalized-price-item" key={item.id} aria-label={`Importes de ${itemTitle(item)}`}>
                    <div className="personalized-price-item-head">
                      <div><h5>{itemTitle(item)}</h5>{details && <small>{details}</small>}</div>
                    </div>
                    <table className="personalized-price-table">
                      <thead><tr><th>Concepto</th><th>Cantidad</th><th>Precio unitario</th><th>Total</th></tr></thead>
                      <tbody>{price.lines.map(line => <tr key={line.key}>
                        <td>{line.label}</td>
                        <td><span className="personalized-price-mobile-label">Cantidad</span>{line.quantity}</td>
                        <td><span className="personalized-price-mobile-label">Precio unitario</span>{money(line.unitPriceMinor,selected.currency)}</td>
                        <td><span className="personalized-price-mobile-label">Total</span>{money(line.totalMinor,selected.currency)}</td>
                      </tr>)}</tbody>
                    </table>
                    {price.notice && <p className="personalized-price-notice">{summary?.kind === 'service' || summary?.kind === 'aplique' ? 'Se muestra el importe cobrado por este trabajo.' : price.notice}</p>}
                  </section>;
                })}
                {selectedTotals && <div className="personalized-order-totals" aria-label="Totales del pedido">
                  {selectedTotals.discountMinor > 0 && <div><span>Descuento{selected.discount_code ? ` · ${selected.discount_code}` : ''}</span><strong>−{money(selectedTotals.discountMinor,selected.currency)}</strong></div>}
                  {selectedTotals.shippingMinor > 0 && <div><span>Envío</span><strong>{money(selectedTotals.shippingMinor,selected.currency)}</strong></div>}
                  {selectedTotals.paymentFeeMinor > 0 && <div><span>Cargos de pago</span><strong>{money(selectedTotals.paymentFeeMinor,selected.currency)}</strong></div>}
                  {selectedTotals.otherAdjustmentMinor !== 0 && <div><span>Ajuste no desglosado en el pedido</span><strong>{selectedTotals.otherAdjustmentMinor < 0 ? '−' : '+'}{money(Math.abs(selectedTotals.otherAdjustmentMinor),selected.currency)}</strong></div>}
                  <div className="personalized-order-grand-total"><span>Total del pedido</span><strong>{money(selectedTotals.totalMinor,selected.currency)}</strong></div>
                </div>}
              </div>
            </section>

            <section className={`personalized-tab-panel personalized-tab-panel--production${activeTab === 'production' ? ' is-active' : ''}`} id="personalized-production-panel" role="tabpanel" aria-labelledby="personalized-production-tab">
            <div className="personalization-images" aria-labelledby="personalization-images-title">
              <div className="section-heading"><h3 id="personalization-images-title">Ficha de producción</h3><strong>{previewCount} {previewCount === 1 ? 'vista' : 'vistas'}</strong></div>
              <p>Revisá las vistas y las indicaciones de cada pieza antes de fabricarla.</p>
              {assetWarning && <div className="asset-warning" role="alert">{assetWarning}</div>}
            </div>
            <div className="production-brief"><div><small>Cliente</small><strong>{customerName(selected.customer_snapshot)}</strong></div><div><small>Fecha del pedido</small><strong>{readableDate(selected.created_at)}</strong></div><div><small>Estado</small><strong>{personalizedProductionStatus(selected)}</strong></div><div><small>Contacto</small><strong>{phone || email || 'Sin contacto guardado'}</strong></div></div>

            {itemSummaries.map(({ item, summary }) => (
              <section className="personalized-item" key={item.id}>
                <div className="personalized-item-head"><h3>{itemTitle(item)}</h3><strong>{item.quantity} {item.quantity === 1 ? 'unidad' : 'unidades'}</strong></div>
                {summary.instructions && <section className="personalization-card workshop-instructions" aria-label={`Indicaciones de ${itemTitle(item)}`}>
                  <h4>Indicaciones para el taller</h4>
                  <p>{summary.instructions}</p>
                </section>}

                <section className="design-artifact-group" aria-label={`Archivos de ${itemTitle(item)}`}>
                  <div className="artifact-subheading"><strong>{summary.kind === 'mate' ? 'Vistas del diseño' : 'Referencias del trabajo'}</strong></div>
                  {summary.previews.length
                    ? <div className="customer-assets">{summary.previews.map((asset) => <AssetCard key={asset.key} asset={asset} link={assetLinks[asset.key]} />)}</div>
                    : summary.kind === 'mate' && asRecord(item.immutable_snapshot).configuration ? <RecoveredDesignViews snapshot={item.immutable_snapshot} uniformGrid />
                      : itemPhoto(item) ? <div className="workshop-product-reference"><img src={itemPhoto(item)} alt={`Referencia del producto: ${itemTitle(item)}`} /><small>Foto del producto de catálogo · el trabajo solicitado se detalla abajo</small></div>
                        : <div className="empty-files">Este pedido no tiene una vista final guardada. Los datos del trabajo están debajo.</div>}
                  <div className="artifact-subheading originals"><strong>Archivos originales</strong><small>{summary.uploads.length ? `${summary.uploads.length} ${summary.uploads.length === 1 ? 'archivo' : 'archivos'}` : 'Sin archivos externos'}</small></div>
                  {summary.uploads.length
                    ? <div className="customer-assets customer-assets--uploads">{summary.uploads.map((asset) => <AssetCard key={asset.key} asset={asset} link={assetLinks[asset.key]} />)}</div>
                    : <div className="empty-files">No hay archivos originales adjuntos a este trabajo.</div>}
                </section>

                <dl className="mate-specs">
                  <div><dt>{summary.kind === 'service' || summary.kind === 'aplique' ? 'Trabajo' : 'Modelo'}</dt><dd>{summary.kind === 'mate' ? summary.mate.model : itemTitle(item)}</dd></div>
                  {summary.kind === 'mate' && <div><dt>Tamaño</dt><dd>{summary.mate.size}</dd></div>}
                  {summary.kind === 'mate' && summary.mate.interior && <div><dt>Interior</dt><dd>{summary.mate.interior}</dd></div>}
                  {summary.mate.color !== 'No especificado' && <div><dt>Color</dt><dd>{summary.mate.color}</dd></div>}
                  {summary.mate.texture !== 'No especificada' && <div><dt>{summary.kind === 'bombilla' ? 'Material' : 'Terminación'}</dt><dd>{summary.mate.texture}</dd></div>}
                  {summary.kind === 'mate' && <div><dt>Virola</dt><dd>{summary.mate.metal}</dd></div>}
                  {summary.kind === 'mate' && Object.entries(summary.mate.characteristics).filter(([code]) => !['tamano','interior','tipo-cuero','material-mate','tipo-virola','color'].includes(code)).map(([code, value]) => <div key={code}><dt>{catalogAttributeLabel(defaultCatalogTaxonomy, code)}</dt><dd>{value}</dd></div>)}
                </dl>

                {summary.kind === 'matera' || summary.kind === 'bombilla' ? <div className="surface-grid surface-grid--single">
                  <SpecCard title={`Así quiere la ${summary.kind}`} personalized>
                    <dl className="compact-specs">
                      <div><dt>Técnica</dt><dd>{summary.matera.technique}</dd></div>
                      <div><dt>Contenido</dt><dd>{summary.matera.content}</dd></div>
                      <div><dt>Ubicación</dt><dd>{summary.matera.placement}</dd></div>
                      <div><dt>Texto</dt><dd>{summary.matera.text || <div className="muted-value">Ninguno</div>}</dd></div>
                      <div><dt>Logo</dt><dd>{summary.matera.logo || <div className="muted-value">Ninguno</div>}</dd></div>
                    </dl>
                  </SpecCard>
                </div> : summary.kind === 'mate' ? <div className="surface-grid">
                  <SpecCard title="Así quiere la virola" personalized={summary.rim.personalized}>
                    <dl className="compact-specs">
                      <div><dt>Técnica</dt><dd>{summary.rim.technique}</dd></div>
                      <div><dt>Terminación</dt><dd>{summary.rim.finish}</dd></div>
                      <div><dt>Texto</dt><dd><TextList values={summary.rim.texts} /></dd></div>
                      <div><dt>Imagen o ícono</dt><dd><TextList values={summary.rim.images} /></dd></div>
                    </dl>
                  </SpecCard>

                  {summary.fleje.available ? (
                    <SpecCard title="Así quiere el fleje" personalized={summary.fleje.personalized}>
                      <dl className="compact-specs fleje-overview">
                        <div><dt>Técnica</dt><dd>{summary.fleje.technique}</dd></div>
                        <div><dt>Terminación</dt><dd>{summary.fleje.finish}</dd></div>
                      </dl>
                      <div className="fleje-sides"><SurfaceSide title="Frente" side={summary.fleje.front} /><SurfaceSide title="Reverso" side={summary.fleje.back} /></div>
                    </SpecCard>
                  ) : <section className="personalization-card unavailable"><h4>Fleje</h4><div>Este modelo no lleva fleje.</div></section>}
                </div> : <div className="surface-grid surface-grid--single">
                  <section className="personalization-card">
                    <div className="personalization-card-head"><h4>{summary.kind === 'aplique' ? 'Detalle del aplique' : 'Detalle del servicio'}</h4></div>
                    <dl className="compact-specs"><div><dt>Trabajo solicitado</dt><dd>{itemTitle(item)}</dd></div></dl>
                  </section>
                </div>}
              </section>
            ))}
            </section>
          </div>

          <footer className="dialog-footer">
            <div><strong>¿Hay algo que confirmar?</strong><small>El mensaje de WhatsApp incluye el número del pedido.</small></div>
            <div className="personalized-dialog-actions"><button type="button" className="secondary production-print-button" onClick={printForProduction}>Imprimir para producción</button>{whatsappUrl
              ? <a className="contact-button" href={whatsappUrl} target="_blank" rel="noreferrer">Contactar por WhatsApp</a>
              : <button type="button" disabled title="El pedido no tiene un teléfono guardado">Sin teléfono guardado</button>}</div>
          </footer>
        </div>}
      </dialog></div>, document.body)}
    </>
  );
}
