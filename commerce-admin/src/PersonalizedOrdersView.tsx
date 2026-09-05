import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { supabase } from './supabase';
import {
  asRecord,
  customerName,
  customerPhone,
  formatFileSize,
  getPersonalizedItems,
  orderStatusLabel,
  paymentStatusLabel,
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

function SearchIcon() {
  return <svg className="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 4 4"/></svg>;
}

function CloseIcon() {
  return <svg className="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>;
}

function TextList({ values, empty = 'Ninguno' }: { values: string[]; empty?: string }) {
  if (!values.length) return <span className="muted-value">{empty}</span>;
  return <span className="value-chips">{values.map((value, index) => <span key={`${value}-${index}`}>{value}</span>)}</span>;
}

function SurfaceSide({ title, side }: { title: string; side: SurfaceSideSummary }) {
  return (
    <section className="surface-side">
      <h5>{title}</h5>
      <dl className="compact-specs">
        <div><dt>Texto</dt><dd>{side.text || <span className="muted-value">Ninguno</span>}</dd></div>
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

export function PersonalizedOrders({ onNotice }: { onNotice: (value: string) => void }) {
  const [orders, setOrders] = useState<PersonalizedOrder[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(true);
  const [assetLinks, setAssetLinks] = useState<Record<string, AssetLink>>({});
  const [assetWarning, setAssetWarning] = useState('');
  const dialogRef = useRef<HTMLDialogElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('orders')
      .select('id,order_number,status,total_minor,created_at,paid_at,customer_snapshot,order_items(id,item_type,title,quantity,total_minor,requires_review,review_status,review_reason,immutable_snapshot)')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      onNotice(`No se pudieron cargar los personalizados: ${error.message}`);
      setLoading(false);
      return;
    }

    setOrders(((data || []) as PersonalizedOrder[]).filter((order) => getPersonalizedItems(order).length > 0));
    setLoading(false);
  }, [onNotice]);

  useEffect(() => { void load(); }, [load]);

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
  const whatsappUrl = selected ? whatsappContactUrl(selected.customer_snapshot, selected.order_number) : '';

  if (loading) return <div className="loading-inline">Cargando pedidos personalizados…</div>;

  return (
    <>
      <section className="data-panel" aria-label="Pedidos personalizados">
        <div className="table-summary"><strong>{orders.length} pedidos personalizados</strong><small>Abrí la lupa para ver las imágenes y el detalle completo</small></div>
        <div className="table-scroll">
          <table className="data-table personalized-table">
            <thead><tr><th>Pedido</th><th>Fecha</th><th>Cliente</th><th>Mates</th><th>Pago</th><th>Producción</th><th className="numeric">Total</th><th className="action-column">Ver</th></tr></thead>
            <tbody>
              {orders.map((order) => {
                const itemCount = getPersonalizedItems(order).length;
                return <tr key={order.id}>
                  <td><strong>#{order.order_number}</strong></td>
                  <td>{readableDate(order.created_at)}</td>
                  <td>{customerName(order.customer_snapshot)}</td>
                  <td>{itemCount} {itemCount === 1 ? 'personalizado' : 'personalizados'}</td>
                  <td><span className="status-badge">{paymentStatusLabel(order)}</span></td>
                  <td><span className={`status-badge status-${order.status}`}>{orderStatusLabel(order.status)}</span></td>
                  <td className="numeric"><strong>{money(order.total_minor)}</strong></td>
                  <td className="action-column"><button className="icon-button" type="button" onClick={() => setSelectedId(order.id)} aria-label={`Ver detalle del pedido ${order.order_number}`} title="Ver detalle"><SearchIcon/></button></td>
                </tr>;
              })}
              {!orders.length && <tr><td className="empty-table" colSpan={8}>Todavía no hay pedidos personalizados.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <dialog ref={dialogRef} className="personalized-dialog" onClose={() => setSelectedId('')} onCancel={(event) => { event.preventDefault(); closeDetail(); }} onMouseDown={(event) => { if (event.target === event.currentTarget) closeDetail(); }}>
        {selected && <div className="dialog-surface">
          <header className="dialog-header">
            <div><small>Pedido personalizado</small><h2>Pedido #{selected.order_number}</h2><div>{customerName(selected.customer_snapshot)} · {readableDate(selected.created_at)}</div></div>
            <button className="icon-button dialog-close" type="button" onClick={closeDetail} aria-label="Cerrar detalle"><CloseIcon/></button>
          </header>

          <div className="dialog-body">
            <section className="personalization-images" aria-labelledby="personalization-images-title">
              <div className="section-heading"><div><small>Lo más importante</small><h3 id="personalization-images-title">Diseños para producción</h3></div><strong>{previewCount} {previewCount === 1 ? 'vista' : 'vistas'}</strong></div>
              {itemSummaries.map(({ item, summary }, index) => (
                <section className="design-artifact-group" key={`assets-${item.id}`}>
                  <h4>{itemSummaries.length > 1 ? `Mate ${index + 1} · ` : ''}{item.title}</h4>
                  <div className="artifact-subheading"><strong>Vistas del diseño</strong><small>Archivos PNG listos para consultar o descargar.</small></div>
                  {summary.previews.length
                    ? <div className="customer-assets">{summary.previews.map((asset) => <AssetCard key={asset.key} asset={asset} link={assetLinks[asset.key]} />)}</div>
                    : <div className="empty-files">Vista final no disponible para este pedido anterior. Revisá las indicaciones escritas de virola y fleje.</div>}
                  <div className="artifact-subheading originals"><strong>Originales subidos por el cliente</strong><small>{summary.uploads.length ? `${summary.uploads.length} ${summary.uploads.length === 1 ? 'archivo' : 'archivos'}` : 'Sin archivos externos'}</small></div>
                  {summary.uploads.length
                    ? <div className="customer-assets customer-assets--uploads">{summary.uploads.map((asset) => <AssetCard key={asset.key} asset={asset} link={assetLinks[asset.key]} />)}</div>
                    : <div className="empty-files">El diseño usa texto o íconos del catálogo; el cliente no subió archivos originales.</div>}
                </section>
              ))}
              {assetWarning && <div className="asset-warning" role="alert">{assetWarning}</div>}
            </section>

            <div className="order-status-grid">
              <div><small>Pago</small><strong>{paymentStatusLabel(selected)}</strong></div>
              <div><small>Producción</small><strong>{orderStatusLabel(selected.status)}</strong></div>
              <div><small>Total del pedido</small><strong>{money(selected.total_minor)}</strong></div>
              <div><small>Contacto</small><strong>{phone || email || 'Sin contacto guardado'}</strong></div>
            </div>

            {itemSummaries.map(({ item, summary }, index) => (
              <section className="personalized-item" key={item.id}>
                <div className="personalized-item-head"><div><small>Mate {itemSummaries.length > 1 ? index + 1 : ''}</small><h3>{item.title}</h3></div><strong>{money(item.total_minor)}</strong></div>
                <dl className="mate-specs">
                  <div><dt>Modelo</dt><dd>{summary.mate.model}</dd></div>
                  <div><dt>Tamaño</dt><dd>{summary.mate.size}</dd></div>
                  <div><dt>Color</dt><dd>{summary.mate.color}</dd></div>
                  <div><dt>Terminación</dt><dd>{summary.mate.texture}</dd></div>
                  <div><dt>Virola</dt><dd>{summary.mate.metal}</dd></div>
                </dl>

                <div className="surface-grid">
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
                </div>
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
