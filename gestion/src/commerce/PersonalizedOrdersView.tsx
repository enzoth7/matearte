import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Plus } from '@phosphor-icons/react';
import { supabase } from './supabase';
import { balance, orderName, paid, type State } from '../data';
import { Badge } from '../ui';
import { compactOrderItemName } from '../orderItemPresentation';
import { isPersonalizedMateItem, naturalCaseName } from '../productionPresentation';
import {
  asRecord,
  customerName,
  customerPhone,
  formatFileSize,
  getPaymentStatusValue,
  getPersonalizedItems,
  paymentStatusLabel,
  personalizedProductionStatus,
  summarizePersonalization,
  whatsappContactUrl,
  type PersonalizedOrder,
  type PrivateAsset,
  type SurfaceSideSummary,
} from './personalizedOrders';

type AssetLink = { viewUrl: string; downloadUrl: string };

const money = (minor: number) => new Intl.NumberFormat('es-UY', {
  style: 'currency',
  currency: 'UYU',
  maximumFractionDigits: 0,
}).format(minor / 100);

const readableDate = (value: string) => new Intl.DateTimeFormat('es-UY', {
  dateStyle: 'short',
  timeStyle: 'short',
}).format(new Date(value));
const shortDate = (value: string) => new Intl.DateTimeFormat('es-UY', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
}).format(new Date(value));
const reference = (order: PersonalizedOrder) => order.reference_code || `#${order.order_number}`;
const productTypes = (order: PersonalizedOrder) => [...new Set(getPersonalizedItems(order).map((item) => ({
  mate: 'Mates',
  matera: 'Materas',
  bombilla: 'Bombillas',
})[summarizePersonalization(item).kind]))].join(', ');

function localPersonalizedOrders(state: State | undefined): PersonalizedOrder[] {
  if (!state) return [];
  return state.orders.filter((order) => order.source === 'local').flatMap((order) => {
    const items = (order.items || []).filter((item) => isPersonalizedMateItem(order, item, state.products));
    if (!items.length) return [];
    const contact = state.customers.find((entry) => entry.id === order.customerId);
    const createdAt = order.date.includes('T') ? order.date : `${order.date}T12:00:00-03:00`;
    return [{
      id: `local:${order.id}`,
      source: 'local' as const,
      order_number: order.number || 0,
      reference_code: orderName(order),
      status: 'ready_for_production',
      total_minor: Math.round(items.reduce((sum, item) => sum + item.amount, 0) * 100),
      created_at: createdAt,
      paid_at: balance(state, order) === 0 ? createdAt : null,
      payment_label: balance(state, order) > 0 && paid(state, order) > 0 ? 'Pago parcial' : undefined,
      customer_snapshot: {
        fullName: contact?.name || order.customerName || 'Cliente sin nombre',
        email: contact?.email || '',
        phone: contact?.phone || '',
      },
      order_items: items.map((item) => {
        const product = state.products.find((entry) => entry.id === item.productId);
        return {
          id: `local:${item.id}`,
          item_type: 'local_design',
          source_variant_id: item.productId,
          title: product?.name || naturalCaseName(compactOrderItemName(item)),
          quantity: item.quantity,
          total_minor: Math.round(item.amount * 100),
          requires_review: false,
          review_status: null,
          review_reason: null,
          production_status: item.productionStatus || null,
          immutable_snapshot: item.personalization || {
            configuration: {
              selectionLabels: {
                family: product?.name || naturalCaseName(compactOrderItemName(item)),
                color: product?.variant || item.variant,
                metal: product?.rim || item.rim,
              },
              capabilities: { hasFleje: false },
              rim: {},
            },
          },
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
      {!personalized && <div className="plain-note">El cliente no activó esta parte: queda lisa y no se cobra.</div>}
    </section>
  );
}

function AssetCard({ asset, link }: { asset: PrivateAsset; link?: AssetLink }) {
  const isImage = asset.mimeType.startsWith('image/');
  return (
    <article className="customer-asset">
      <div className="asset-preview">
        {isImage && link?.viewUrl
          ? <img src={link.viewUrl} alt={`Referencia de personalización: ${asset.name}`} loading="lazy" />
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
          .select('id,order_number,reference_code,status,total_minor,created_at,paid_at,customer_snapshot,order_items(id,item_type,source_variant_id,title,quantity,total_minor,requires_review,review_status,review_reason,production_status,immutable_snapshot)', {count:'exact'})
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
  const selectedItems = useMemo(() => selected ? getPersonalizedItems(selected) : [], [selected]);
  const itemSummaries = useMemo(() => selectedItems.map((item) => ({ item, summary: summarizePersonalization(item) })), [selectedItems]);
  const files = useMemo(() => [...new Map(itemSummaries.flatMap(({ summary }) => summary.files).map((asset) => [asset.key, asset])).values()], [itemSummaries]);
  const previewCount = itemSummaries.reduce((total, { summary }) => total + summary.previews.length, 0);

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

  const customer = selected ? asRecord(selected.customer_snapshot) : {};
  const email = typeof customer.email === 'string' ? customer.email : '';
  const phone = selected ? customerPhone(selected.customer_snapshot) : '';
  const whatsappUrl = selected ? whatsappContactUrl(selected.customer_snapshot, reference(selected)) : '';
  const itemTitle = (item: PersonalizedOrder['order_items'][number]) => {
    const catalog = state?.products.find((product) => product.id === item.source_variant_id);
    return catalog?.name || naturalCaseName(compactOrderItemName({ title: item.title }));
  };

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
                  <td><strong>{money(order.total_minor)}</strong></td>
                  <td className="payment-status-cell">
                    <Badge tone={getPaymentStatusValue(order) === 'cancelled' ? 'red' : undefined}>{paymentStatusLabel(order)}</Badge>
                  </td>
                  <td><Badge>{personalizedProductionStatus(order)}</Badge></td>
                  <td className="action-column"><button className="secondary order-details-button personalized-details-button" type="button" onClick={() => setSelectedId(order.id)} aria-label={`Ver detalle del pedido ${reference(order)}`} title="Ver detalle"><Plus size={18} weight="bold" aria-hidden="true" /></button></td>
                </tr>;
              })}
              {!orders.length && <tr><td className="empty-table" colSpan={9}>Todavía no hay pedidos personalizados.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <dialog ref={dialogRef} className="personalized-dialog" onClose={() => setSelectedId('')} onCancel={(event) => { event.preventDefault(); closeDetail(); }} onMouseDown={(event) => { if (event.target === event.currentTarget) closeDetail(); }}>
        {selected && <div className="dialog-surface">
          <header className="dialog-header">
            <div><h2>Pedido {reference(selected)}</h2><div>{customerName(selected.customer_snapshot)} · {readableDate(selected.created_at)}</div></div>
            <button className="icon-button dialog-close" type="button" onClick={closeDetail} aria-label="Cerrar detalle"><CloseIcon/></button>
          </header>

          <div className="dialog-body">
            <section className="personalization-images" aria-labelledby="personalization-images-title">
              <div className="section-heading"><h3 id="personalization-images-title">Diseños para producción</h3><strong>{previewCount} {previewCount === 1 ? 'vista' : 'vistas'}</strong></div>
              {assetWarning && <div className="asset-warning" role="alert">{assetWarning}</div>}
            </section>

            <div className="order-status-grid">
              <div>
                <small>Pago</small>
                <div style={{ marginTop: '0.25rem' }}>
                  <Badge tone={getPaymentStatusValue(selected) === 'cancelled' ? 'red' : undefined}>{paymentStatusLabel(selected)}</Badge>
                </div>
              </div>
              <div><small>Producción</small><strong>{personalizedProductionStatus(selected)}</strong></div>
              <div><small>Total del pedido</small><strong>{money(selected.total_minor)}</strong></div>
              <div><small>Contacto</small><strong>{phone || email || 'Sin contacto guardado'}</strong></div>
            </div>

            {itemSummaries.map(({ item, summary }) => (
              <section className="personalized-item" key={item.id}>
                <div className="personalized-item-head"><h3>{itemTitle(item)}</h3><strong>{money(item.total_minor)}</strong></div>

                <section className="design-artifact-group" aria-label={`Archivos de ${itemTitle(item)}`}>
                  <div className="artifact-subheading"><strong>Vistas del diseño</strong></div>
                  {summary.previews.length
                    ? <div className="customer-assets">{summary.previews.map((asset) => <AssetCard key={asset.key} asset={asset} link={assetLinks[asset.key]} />)}</div>
                    : <div className="empty-files">Vista final no disponible. Revisá las indicaciones escritas de la personalización.</div>}
                  <div className="artifact-subheading originals"><strong>Originales subidos por el cliente</strong><small>{summary.uploads.length ? `${summary.uploads.length} ${summary.uploads.length === 1 ? 'archivo' : 'archivos'}` : 'Sin archivos externos'}</small></div>
                  {summary.uploads.length
                    ? <div className="customer-assets customer-assets--uploads">{summary.uploads.map((asset) => <AssetCard key={asset.key} asset={asset} link={assetLinks[asset.key]} />)}</div>
                    : <div className="empty-files">El diseño usa texto o íconos del catálogo; el cliente no subió archivos originales.</div>}
                </section>

                <dl className="mate-specs">
                  <div><dt>Modelo</dt><dd>{summary.mate.model}</dd></div>
                  {summary.kind === 'mate' && <div><dt>Tamaño</dt><dd>{summary.mate.size}</dd></div>}
                  <div><dt>Color</dt><dd>{summary.mate.color}</dd></div>
                  <div><dt>{summary.kind === 'bombilla' ? 'Material' : 'Terminación'}</dt><dd>{summary.mate.texture}</dd></div>
                  {summary.kind === 'mate' && <div><dt>Virola</dt><dd>{summary.mate.metal}</dd></div>}
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
                </div> : <div className="surface-grid">
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
                </div>}
                {summary.instructions && <section className="personalization-card"><h4>Indicaciones para el taller</h4><p>{summary.instructions}</p></section>}
              </section>
            ))}
          </div>

          <footer className="dialog-footer">
            <div><strong>¿Hay algo que confirmar?</strong><small>El mensaje de WhatsApp incluye el número del pedido.</small></div>
            {whatsappUrl
              ? <a className="contact-button" href={whatsappUrl} target="_blank" rel="noreferrer">Contactar por WhatsApp</a>
              : <button type="button" disabled title="El pedido no tiene un teléfono guardado">Sin teléfono guardado</button>}
          </footer>
        </div>}
      </dialog>
    </>
  );
}
