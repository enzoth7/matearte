import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { PersonalizedOrders } from './PersonalizedOrdersView';
import { TaxonomyManager } from './TaxonomyManager';
import { loadCatalogTaxonomy } from './catalogTaxonomy';
import {
  catalogAttributeLabel,
  catalogCategoryIds,
  catalogColorIds,
  catalogMaterialIds,
  catalogProductTypeIds,
  catalogValueLabel,
  defaultCatalogTaxonomy,
  emptyCatalogAttributes,
  formatVariantLabel,
  normalizeCatalogAttributes,
  normalizeCatalogValueMap,
  optionSignature,
  taxonomyOptionsFor,
  taxonomyRulesForCategory,
  type CatalogAttributes,
  type CatalogAttributeDefinition,
  type CatalogTaxonomy,
  type CatalogValue,
  type CatalogValueMap,
} from '../../shared/catalog-taxonomy';

type Tab = 'catalog' | 'list' | 'orders' | 'personalized' | 'shipping' | 'settings' | 'rates';

const VALID_TABS: Record<string, Tab> = {
  catalog: 'catalog',
  catalogo: 'catalog',
  list: 'list',
  lista: 'list',
  orders: 'orders',
  pedidos: 'orders',
  personalized: 'personalized',
  personalizados: 'personalized',
  'pedidos-personalizados': 'personalized',
  shipping: 'shipping',
  envios: 'shipping',
  rates: 'rates',
  cotizaciones: 'rates',
  settings: 'settings',
  configuracion: 'settings',
};

export function getTabFromUrl(urlPath?: string, search?: string): Tab {
  const currentPath = (urlPath !== undefined ? urlPath : (typeof window !== 'undefined' ? window.location.pathname : '')).replace(/^\/+|\/+$/g, '').toLowerCase();
  const currentSearch = search !== undefined ? search : (typeof window !== 'undefined' ? window.location.search : '');
  const searchTab = new URLSearchParams(currentSearch).get('tab')?.toLowerCase();
  const key = searchTab || currentPath;
  return VALID_TABS[key] || 'catalog';
}
type ProductImage = { id:string;storage_path:string;original_name:string;alt_text:string;mime_type:string;byte_size:number;sort_order:number;variant_id:string|null;option_values?:unknown };
type SaleMode = 'standard'|'made_to_order';
type ProductVariant = {id:string;sku:string;name:string;price_minor:number;active:boolean;color?:string|null;weight_grams?:number|null;option_values?:unknown};
type Product = { id:string; editorial_slug:string; name:string; category:string; category_code?:string|null; description:string; sale_mode:SaleMode; published:boolean; catalog_filters?:unknown; attributes?:unknown; commerce_variants:ProductVariant[]; commerce_product_images:ProductImage[] };
type ProductForm = {name:string;category:string;description:string;saleMode:SaleMode;catalogFilters:CatalogAttributes;attributes:CatalogValueMap};
type OrderItem = {id:string;item_type:'catalog'|'design';title:string;quantity:number;requires_review:boolean;review_status:string|null;immutable_snapshot:Record<string,unknown>};
type Order = { id:string;order_number:number;status:string;shipping_method:string;shipping_snapshot:Record<string,unknown>;shipping_carrier:string|null;tracking_code:string|null;shipped_at:string|null;total_minor:number;created_at:string;customer_snapshot:Record<string,unknown>;order_items:OrderItem[] };
type Rate = {id:string;code:string;name:string;departments:string[];rate_minor:number;is_pickup:boolean;active:boolean};
const money=(minor:number)=>new Intl.NumberFormat('es-UY',{style:'currency',currency:'UYU',maximumFractionDigits:0}).format(minor/100);
const MAX_PRODUCT_IMAGE_BYTES = 10 * 1024 * 1024;
const PRODUCT_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const productImageUrl = (path:string) => supabase.storage.from('product-images').getPublicUrl(path).data.publicUrl;
const fileExtension = (file:File) => file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || (file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg');
const TEST_ADMIN_USERNAME = (import.meta.env.VITE_COMMERCE_ADMIN_USERNAME || 'user').trim().toLowerCase();
const TEST_ADMIN_EMAIL = (import.meta.env.VITE_COMMERCE_ADMIN_EMAIL || 'user@matearte.uy').trim().toLowerCase();
const EMPTY_PRODUCT_FORM = (): ProductForm => ({name:'',category:'mates',description:'',saleMode:'standard',catalogFilters:emptyCatalogAttributes(),attributes:{}});
const productSlug = (name:string) => name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,120) || `producto-${Date.now()}`;

type IconName = Tab | 'logout' | 'search' | 'print';

function Icon({ name }: { name: IconName }) {
  const paths: Record<IconName, ReactNode> = {
    catalog: <><path d="M4 5.5h16v13H4z"/><path d="M8 9h8M8 13h5"/></>,
    list: <><path d="M8 6h12M8 12h12M8 18h12"/><path d="M4 6h.01M4 12h.01M4 18h.01"/></>,
    orders: <><path d="M6 3.5h12v17H6z"/><path d="M9 8h6M9 12h6M9 16h4"/></>,
    personalized: <><path d="M12 3 14.2 8.8 20 11l-5.8 2.2L12 19l-2.2-5.8L4 11l5.8-2.2z"/></>,
    shipping: <><path d="M3 6h11v11H3zM14 10h4l3 3v4h-7z"/><path d="M7 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm10 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"/></>,
    rates: <><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></>,
    settings: <><path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/></>,
    logout: <><path d="M10 5H5v14h5M14 8l4 4-4 4M8 12h10"/></>,
    search: <><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 4 4"/></>,
    print: <><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></>,
  };
  return <svg className="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

const textValue = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const recordValue = (value: unknown): Record<string,unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string,unknown> : {};
const snapshotValue = (snapshot: Record<string, unknown>, ...keys:string[]) => keys.map(key=>textValue(snapshot[key])).find(Boolean) || '';
const orderCustomer = (snapshot: Record<string, unknown>) => snapshotValue(snapshot,'fullName','full_name','name','email') || 'Cliente sin nombre';
export function getCatalogOrderOptionDetails(item:Pick<OrderItem,'item_type'|'immutable_snapshot'>,taxonomy:CatalogTaxonomy=defaultCatalogTaxonomy) {
  if (item.item_type !== 'catalog') return [];
  const snapshot = recordValue(item.immutable_snapshot);
  const variant = recordValue(snapshot.variant);
  const product = recordValue(snapshot.product);
  const variantOptions = normalizeCatalogValueMap(variant.option_values);
  const selectedOptions = normalizeCatalogValueMap(snapshot.selectedOptions ?? snapshot.optionValues ?? snapshot.option_values_override);
  const options = {...variantOptions,...selectedOptions};
  const category = textValue(product.category_code) || textValue(product.category);
  const orderedAttributes = taxonomyRulesForCategory(taxonomy,category,'variant').map(rule=>rule.attribute_code);
  const keys = [...new Set([...orderedAttributes,...Object.keys(options).sort()])].filter(key=>options[key]!==undefined&&options[key]!=="");
  return keys.map(attribute=>({
    attribute,
    label: catalogAttributeLabel(taxonomy,attribute),
    value: catalogValueLabel(taxonomy,attribute,options[attribute]),
  }));
}
export function getOrderDeliveryDetails(order:Pick<Order,'shipping_method'|'shipping_snapshot'|'customer_snapshot'>) {
  const customer = order.customer_snapshot || {};
  const shipping = order.shipping_snapshot || {};
  const isPickup = order.shipping_method === 'pickup';
  const isInternational = order.shipping_method === 'international_coordination';
  const source = isInternational ? shipping : customer;
  const countryCode = snapshotValue(source,'country','countryCode','country_code');
  const country = countryCode.toUpperCase() === 'UY' ? 'Uruguay' : countryCode || (!isInternational ? 'Uruguay' : '');
  return {
    isPickup,
    contactName: orderCustomer(customer),
    phone: snapshotValue(customer,'phone','telephone'),
    email: snapshotValue(customer,'email'),
    address: snapshotValue(source,'address','addressLine1','address_line1'),
    city: snapshotValue(source,'city'),
    department: snapshotValue(source,'department','state','province'),
    country,
    zone: snapshotValue(shipping,'name'),
    methodLabel: isPickup ? 'Retiro' : isInternational ? 'Envío internacional a coordinar' : 'Envío nacional',
  };
}
const orderStatus = (status: string) => ({
  pending_payment: 'Pendiente de pago',
  paid_pending_review: 'Requiere revisión',
  ready_for_production: 'En producción',
  ready_for_fulfillment: 'Listo para entregar',
  shipped: 'Enviado',
  payment_failed: 'Pago fallido',
  cancelled: 'Cancelado',
  refunded: 'Reembolsado',
  manual_review: 'Revisión manual',
}[status] || status.replaceAll('_', ' '));
const normalizeSearch = (value:string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const catalogCategoryLabels: Record<string,string> = {
  mates:'Mate',bombillas:'Bombilla',materas:'Matera',termos:'Termo','kits-materos':'Kit matero',cuchillos:'Cuchillo',cintos:'Cinto',calzado:'Calzado',botas:'Bota',marroquineria:'Marroquinería',billeteras:'Billetera',carteras:'Cartera',
};
const catalogMaterialLabels: Record<string,string> = {
  cuero:'Cuero',plata:'Plata',alpaca:'Alpaca','acero-inoxidable':'Acero inoxidable','otros-metales':'Otros metales',madera:'Madera',estampado:'Estampado',
};

export const catalogColorLabels: Record<string, string> = {
  marron: 'Marrón',
  negro: 'Negro',
  natural: 'Natural',
  'cuero-crudo': 'Cuero crudo',
  rojo: 'Rojo',
  blanco: 'Blanco',
  rosado: 'Rosado',
  gris: 'Gris',
  dorado: 'Dorado',
  celeste: 'Celeste',
  azul: 'Azul',
  beige: 'Beige',
  metalico: 'Metálico',
};

function TaxonomyValueField({ definition, taxonomy, value, required, onChange }:{ definition:CatalogAttributeDefinition;taxonomy:CatalogTaxonomy;value:CatalogValue|undefined;required:boolean;onChange:(value:CatalogValue|undefined)=>void }) {
  const label = <span className="field-label">{definition.label_es}{definition.unit ? ` (${definition.unit})` : ''}{required&&<span className="field-required" aria-hidden="true">*</span>}</span>;
  if (definition.data_type === 'boolean') return <label className="taxonomy-boolean-field">{label}<input type="checkbox" checked={value===true} onChange={event=>onChange(event.target.checked)}/></label>;
  if (definition.data_type === 'enum') return <label>{label}<select required={required} value={typeof value==='string'?value:''} onChange={event=>onChange(event.target.value||undefined)}><option value="">Sin especificar</option>{taxonomyOptionsFor(taxonomy,definition.code).map(option=><option key={option.code} value={option.code}>{option.label_es}</option>)}</select></label>;
  return <label>{label}<input required={required} type={definition.data_type==='number'?'number':'text'} min={definition.data_type==='number'?'0':undefined} step={definition.data_type==='number'?'any':undefined} value={value===undefined?'':String(value)} onChange={event=>onChange(event.target.value===''?undefined:definition.data_type==='number'?Number(event.target.value):event.target.value)}/></label>;
}

function DynamicAttributeFields({taxonomy,category,scope,values,onChange}:{taxonomy:CatalogTaxonomy;category:string;scope:'product'|'variant';values:CatalogValueMap;onChange:(values:CatalogValueMap)=>void}) {
  const rules = taxonomyRulesForCategory(taxonomy,category,scope);
  if (!rules.length) return null;
  const knifeLength=category==='cuchillos'&&typeof values['largo-hoja-mm']==='number'?values['largo-hoja-mm']:null;
  const knifeType=typeof values['tipo-cuchillo']==='string'?values['tipo-cuchillo']:'';
  const orientativeWarning=knifeLength!==null&&((knifeType==='verijero'&&knifeLength>200)||(knifeType==='caronero'&&knifeLength<300));
  if (scope === 'variant') {
    return <div className="product-fields">{rules.map(rule=>{const definition=taxonomy.attributes.find(item=>item.code===rule.attribute_code);if(!definition)return null;return <TaxonomyValueField key={definition.code} definition={definition} taxonomy={taxonomy} value={values[definition.code]} required={rule.required} onChange={value=>{const next={...values};if(value===undefined)delete next[definition.code];else next[definition.code]=value;onChange(next)}}/>;})}</div>;
  }
  return <fieldset className="catalog-attributes"><legend>Características del producto</legend><p>Estos datos alimentan la ficha y los filtros del catálogo.</p><div className="product-fields">{rules.map(rule=>{const definition=taxonomy.attributes.find(item=>item.code===rule.attribute_code);if(!definition)return null;if(definition.code==='forma-gavilan'&&values['tiene-gavilan']!==true)return null;return <TaxonomyValueField key={definition.code} definition={definition} taxonomy={taxonomy} value={values[definition.code]} required={rule.required} onChange={value=>{const next={...values};if(value===undefined)delete next[definition.code];else next[definition.code]=value;onChange(next)}}/>})}</div>{orientativeWarning&&<p className="warning-inline">El largo no es el habitual para este tipo tradicional. Es una advertencia orientativa: podés guardar la pieza si la clasificación es correcta.</p>}</fieldset>;
}

function Login({onSession}:{onSession:(session:Session)=>void}){const[username,setUsername]=useState('');const[password,setPassword]=useState('');const[error,setError]=useState('');const[busy,setBusy]=useState(false);return <main className="login"><form onSubmit={async e=>{e.preventDefault();setBusy(true);setError('');const value=username.trim().toLowerCase();const email=value===TEST_ADMIN_USERNAME?TEST_ADMIN_EMAIL:value;const{data,error}=await supabase.auth.signInWithPassword({email,password});setBusy(false);if(error)setError(error.message);else if(data.session)onSession(data.session)}}><p className="eyebrow">Administración segura</p><h1>Comercio MateArte</h1><p>Acceso limitado a membresías guardadas en la base de datos.</p>{error&&<div className="error">{error}</div>}<label>Usuario o correo<input type="text" autoComplete="username" required value={username} onChange={e=>setUsername(e.target.value)}/></label><label>Contraseña<input type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)}/></label><button disabled={busy}>{busy?'Ingresando…':'Ingresar'}</button></form></main>}

export function App(){
  const [session, setSession] = useState<Session|null>(null);
  const [authorized, setAuthorized] = useState<boolean|null>(null);
  const [authorizationError, setAuthorizationError] = useState('');
  const [tab, setTab] = useState<Tab>(getTabFromUrl);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({data}) => setSession(data.session));
    const {data} = supabase.auth.onAuthStateChange((_e, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const onPopState = () => {
      setTab(getTabFromUrl());
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const switchTab = (nextTab: Tab) => {
    setTab(nextTab);
    const targetPath = nextTab === 'catalog' ? '/' : `/${nextTab}`;
    if (window.location.pathname !== targetPath) {
      window.history.pushState(null, '', targetPath);
    }
  };

  useEffect(() => {
    if (!session) { setAuthorized(null); setAuthorizationError(''); return; }
    let cancelled = false;
    supabase.from('commerce_admin_users').select('user_id').eq('user_id', session.user.id).eq('active', true).maybeSingle().then(({data, error}) => {
      if (cancelled) return;
      if (error) { setAuthorizationError(error.message); setAuthorized(false); return; }
      setAuthorizationError('');
      setAuthorized(Boolean(data));
    });
    return () => { cancelled = true; };
  }, [session]);

  if (!session) return <Login onSession={setSession} />;
  if (authorized === null) return <p className="loading">Verificando membresía…</p>;
  if (authorizationError) return <main className="denied"><h1>Verificación no disponible</h1><p>No se pudo comprobar el permiso de Comercio por un problema temporal de Supabase. Intentá de nuevo en unos minutos.</p><button onClick={() => supabase.auth.signOut()}>Cerrar sesión</button></main>;
  if (!authorized) return <main className="denied"><h1>Acceso denegado</h1><p>La cuenta está autenticada, pero no integra commerce_admin_users.</p><button onClick={() => supabase.auth.signOut()}>Cerrar sesión</button></main>;

  const navItems: Array<{id:Tab;label:string}> = [
    {id:'catalog',label:'Catálogo'},
    {id:'list',label:'Lista'},
    {id:'orders',label:'Pedidos'},
    {id:'personalized',label:'Pedidos personalizados'},
    {id:'shipping',label:'Envíos'},
    {id:'rates',label:'Cotizaciones'},
    {id:'settings',label:'Configuración'},
  ];
  const pageTitle = tab==='catalog'?'Catálogo':tab==='list'?'Lista':tab==='orders'?'Pedidos':tab==='personalized'?'Pedidos personalizados':tab==='shipping'?'Zonas y tarifas':tab==='rates'?'Cotizaciones':'Configuración';
  return (
    <div className="shell">
      <a className="skip-link" href="#commerce-content">Saltar al contenido</a>
      <aside className="side-navigation">
        <div className="brand-lockup"><img className="brand-logo" src="/logo-matearte.avif" alt="" aria-hidden="true"/><div><strong>MateArte</strong><small>COMERCIO</small></div></div>
        <nav aria-label="Administración de comercio">
          {navItems.map(({id,label})=><button type="button" key={id} className={tab===id?'active':''} aria-current={tab===id?'page':undefined} onClick={()=>switchTab(id)}><Icon name={id}/><span>{label}</span></button>)}
        </nav>
        <div className="side-account"><small>{session.user.email}</small><button className="logout" onClick={()=>supabase.auth.signOut({scope:'local'})}><Icon name="logout"/><span>Cerrar sesión</span></button></div>
      </aside>
     <main id="commerce-content">
       <header className="page-header"><div><h1>{pageTitle}</h1></div><strong>{session.user.email}</strong></header>
       {notice&&<div className="notice" role="status">{notice}</div>}
       {tab==='catalog'&&<Catalog onNotice={setNotice}/>} {tab==='list'&&<CatalogList onNotice={setNotice}/>} {tab==='orders'&&<Orders session={session} onNotice={setNotice}/>} {tab==='personalized'&&<PersonalizedOrders onNotice={setNotice}/>} {tab==='shipping'&&<Shipping onNotice={setNotice}/>} {tab==='rates'&&<Rates onNotice={setNotice}/>} {tab==='settings'&&<Settings onNotice={setNotice}/>}
     </main>
   </div>
 )}

function Rates({onNotice}:{onNotice:(v:string)=>void}) {
  const [rates, setRates] = useState<{currency_code:string;rate_to_uyu:number}[]>([]);
  const [busy, setBusy] = useState(true);

  const load = useCallback(async () => {
    setBusy(true);
    const { data, error } = await supabase.from('commerce_exchange_rates').select('*').order('currency_code');
    if (error) { onNotice(error.message); setBusy(false); return; }
    setRates(data || []);
    setBusy(false);
  }, [onNotice]);

  useEffect(() => { void load(); }, [load]);

  const updateRate = async (code: string, newRate: number) => {
    if (isNaN(newRate) || newRate <= 0) { onNotice('La cotización debe ser un número positivo.'); return; }
    const { error } = await supabase.from('commerce_exchange_rates').upsert({ currency_code: code, rate_to_uyu: newRate });
    if (error) { onNotice(error.message); return; }
    onNotice(`Cotización de ${code} guardada.`);
    void load();
  };

  return <section className="commerce-section">
    <div className="section-header">
      <h2>Conversión de moneda</h2>
      <p>Establecé el valor del Dólar y el Real frente al Peso Uruguayo (UYU). Este valor se usa para convertir los precios en la tienda según el idioma.</p>
    </div>
    {busy ? <p className="loading">Cargando cotizaciones…</p> : (
      <div className="data-table" style={{ maxWidth: '600px', margin: '2rem 0' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr>
              <th style={{ padding: '0.75rem', borderBottom: '1px solid #ddd' }}>Moneda</th>
              <th style={{ padding: '0.75rem', borderBottom: '1px solid #ddd' }}>Equivalencia (1 Unidad = X UYU)</th>
              <th style={{ padding: '0.75rem', borderBottom: '1px solid #ddd' }}>Acción</th>
            </tr>
          </thead>
          <tbody>
            {['USD', 'BRL'].map(code => {
              const current = rates.find(r => r.currency_code === code);
              return <RateRow key={code} code={code} initialRate={current?.rate_to_uyu || 1} onSave={val => updateRate(code, val)} />
            })}
          </tbody>
        </table>
      </div>
    )}
  </section>;
}

function RateRow({ code, initialRate, onSave }: { code: string; initialRate: number; onSave: (val: number) => void }) {
  const [value, setValue] = useState(initialRate.toString());
  return <tr>
    <td style={{ padding: '0.75rem', borderBottom: '1px solid #ddd' }}><strong>{code}</strong></td>
    <td style={{ padding: '0.75rem', borderBottom: '1px solid #ddd' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span>$</span>
        <input type="number" step="0.01" min="0.01" value={value} onChange={e => setValue(e.target.value)} style={{ width: '100px', padding: '0.25rem' }} />
        <span>UYU</span>
      </div>
    </td>
    <td style={{ padding: '0.75rem', borderBottom: '1px solid #ddd' }}>
      <button type="button" onClick={() => onSave(parseFloat(value))} disabled={parseFloat(value) === initialRate}>Guardar</button>
    </td>
  </tr>;
}

function Catalog({onNotice}:{onNotice:(v:string)=>void}) {
  const [taxonomy,setTaxonomy] = useState<CatalogTaxonomy>(defaultCatalogTaxonomy);
  const [products,setProducts] = useState<Product[]>([]);
  const [selected,setSelected] = useState('');
  const [search,setSearch] = useState('');
  const [imageBusy,setImageBusy] = useState('');
  const [imageTargets,setImageTargets] = useState<Record<string,string>>({});
  const [productBusy,setProductBusy] = useState('');
  const [showNewProduct,setShowNewProduct] = useState(false);
  const [newProduct,setNewProduct] = useState<ProductForm>(EMPTY_PRODUCT_FORM);
  const [productDetails,setProductDetails] = useState<ProductForm>(EMPTY_PRODUCT_FORM);
  const [variant,setVariant] = useState<{sku:string;price:string;options:CatalogValueMap}>({sku:'',price:'',options:{}});
  const [editingVariantId, setEditingVariantId] = useState<string | null>(null);
  const [editingVariantForm, setEditingVariantForm] = useState<{sku:string;price:string;options:CatalogValueMap}>({sku:'',price:'',options:{}});

  useEffect(()=>{void loadCatalogTaxonomy(false).then(setTaxonomy)},[]);

  const load = useCallback(async(preferredId?:string) => {
    const selection = 'id,editorial_slug,name,category,category_code,description,sale_mode,published,catalog_filters,attributes,commerce_variants(id,sku,name,price_minor,weight_grams,active,color,option_values),commerce_product_images(id,storage_path,original_name,alt_text,mime_type,byte_size,sort_order,variant_id,option_values)';
    const legacySelection = 'id,editorial_slug,name,category,description,sale_mode,published,catalog_filters,commerce_variants(id,sku,name,price_minor,active,color),commerce_product_images(id,storage_path,original_name,alt_text,mime_type,byte_size,sort_order,variant_id)';
    let {data,error}:{data:unknown;error:{message:string;code?:string}|null} = await supabase
      .from('commerce_products')
      .select(selection)
      .order('name');
    if (error && (error.code === '42703' || /category_code|attributes|option_values|weight_grams/i.test(error.message))) {
      ({data,error} = await supabase.from('commerce_products').select(legacySelection).order('name'));
    }
    if (error) {
      onNotice(error.message);
      return;
    }
    const nextProducts = (data || []) as Product[];
    setProducts(nextProducts);
    setSelected(current => {
      const requested = preferredId || current;
      return nextProducts.some(item => item.id === requested) ? requested : nextProducts[0]?.id || '';
    });
  },[onNotice]);

  useEffect(() => { void load(); },[load]);
  const filteredProducts = useMemo(() => {
    const query = normalizeSearch(search);
    if (!query) return products;
    return products.filter(item => normalizeSearch(`${item.name} ${item.editorial_slug} ${item.category}`).includes(query));
  }, [products, search]);
  const product = products.find(item => item.id === selected);
  const images = [...(product?.commerce_product_images || [])].sort((a,b) => a.sort_order - b.sort_order || a.original_name.localeCompare(b.original_name));
  const variantRules = product ? taxonomyRulesForCategory(taxonomy,product.category_code||product.category,'variant') : [];
  const variantDefinitions = variantRules.map(rule=>({rule,definition:taxonomy.attributes.find(item=>item.code===rule.attribute_code)})).filter((item):item is typeof item & {definition:CatalogAttributeDefinition}=>Boolean(item.definition));
  const imageColors = [...new Set((product?.commerce_variants||[]).map(item=>String(normalizeCatalogValueMap(item.option_values).color||item.color||'')).filter(Boolean))];

  useEffect(() => {
    if (!product) return;
    const rawCategory = product.category_code || (product.category === 'kit-matero' ? 'kits-materos' : product.category === 'cuchillo' ? 'cuchillos' : product.category);
    const category = taxonomy.categories.some(item=>item.code===rawCategory) ? rawCategory : '';
    setProductDetails({name:product.name,category,description:product.description,saleMode:product.sale_mode,catalogFilters:normalizeCatalogAttributes(product.catalog_filters),attributes:normalizeCatalogValueMap(product.attributes)});
    setEditingVariantId(null);
  },[product,taxonomy.categories]);

  const createProduct = async(event:React.FormEvent) => {
    event.preventDefault();
    const name = newProduct.name.trim();
    const category = newProduct.category.trim().toLowerCase();
    if (!name || !category) {
      onNotice('Completá el nombre y la categoría del producto.');
      return;
    }

    setProductBusy('create');
    try {
      const payload = {name,category,category_code:category,description:newProduct.description.trim(),sale_mode:newProduct.saleMode,catalog_filters:newProduct.catalogFilters,attributes:newProduct.attributes,published:false};
      const baseSlug = productSlug(name);
      let result = await supabase.from('commerce_products').insert({...payload,editorial_slug:baseSlug}).select('id').single();
      if (result.error?.code === '23505') {
        result = await supabase.from('commerce_products').insert({...payload,editorial_slug:`${baseSlug}-${crypto.randomUUID().slice(0,8)}`}).select('id').single();
      }
      if (result.error) throw result.error;
      setNewProduct(EMPTY_PRODUCT_FORM());
      setShowNewProduct(false);
      onNotice('Producto creado. Ahora podés cargar sus fotos y variantes.');
      await load(result.data.id);
    } catch (reason) {
      onNotice(reason && typeof reason === 'object' && 'message' in reason ? String(reason.message) : 'No se pudo crear el producto.');
    } finally {
      setProductBusy('');
    }
  };

  const saveProduct = async(event:React.FormEvent) => {
    event.preventDefault();
    if (!product) return;
    const name = productDetails.name.trim();
    const category = productDetails.category.trim().toLowerCase();
    if (!name || !category) {
      onNotice('Completá el nombre y la categoría del producto.');
      return;
    }

    setProductBusy('save');
    const {error} = await supabase.from('commerce_products').update({name,category,category_code:category,description:productDetails.description.trim(),sale_mode:productDetails.saleMode,catalog_filters:productDetails.catalogFilters,attributes:productDetails.attributes}).eq('id',product.id);
    onNotice(error ? error.message : 'Datos del producto guardados.');
    if (!error) await load(product.id);
    setProductBusy('');
  };

  const deleteProduct = async() => {
    if (!product) return;
    const confirmed = window.confirm(`¿Eliminar definitivamente “${product.name}”?\n\nSe eliminarán también ${product.commerce_variants.length} variantes y ${images.length} fotos. Si solo querés sacarlo de la tienda, usá “Ocultar”.`);
    if (!confirmed) return;

    setProductBusy('delete');
    const paths = images.map(image => image.storage_path);
    const {data,error} = await supabase.from('commerce_products').delete().eq('id',product.id).select('id').maybeSingle();
    if (error || !data) {
      const linked = error?.code === '23503';
      onNotice(linked ? 'Este producto ya tiene movimientos asociados y no puede eliminarse. Podés ocultarlo para retirarlo de la tienda.' : error?.message || 'No se pudo eliminar el producto.');
      setProductBusy('');
      return;
    }

    const {error:storageError} = paths.length ? await supabase.storage.from('product-images').remove(paths) : {error:null};
    onNotice(storageError ? 'Producto eliminado. Algunos archivos requieren limpieza manual.' : 'Producto eliminado definitivamente.');
    setProductBusy('');
    await load();
  };

  const uploadImages = async(event:React.ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const files = Array.from(input.files || []);
    input.value = '';
    if (!product || files.length === 0) return;

    const invalidType = files.find(file => !PRODUCT_IMAGE_TYPES.has(file.type));
    if (invalidType) {
      onNotice(`“${invalidType.name}” no es PNG, JPEG ni WebP.`);
      return;
    }
    const oversized = files.find(file => file.size > MAX_PRODUCT_IMAGE_BYTES);
    if (oversized) {
      onNotice(`“${oversized.name}” supera el máximo de 10 MB.`);
      return;
    }

    setImageBusy('upload');
    let uploaded = 0;
    try {
      for (const [index,file] of files.entries()) {
        const path = `${product.id}/${crypto.randomUUID()}.${fileExtension(file)}`;
        const {error:uploadError} = await supabase.storage.from('product-images').upload(path,file,{cacheControl:'31536000',contentType:file.type,upsert:false});
        if (uploadError) throw uploadError;

        const {error:rowError} = await supabase.from('commerce_product_images').insert({
          product_id:product.id,
          storage_path:path,
          original_name:file.name.slice(0,240),
          alt_text:`Foto de ${product.name}`,
          mime_type:file.type,
          byte_size:file.size,
          sort_order:images.length + index,
        });
        if (rowError) {
          await supabase.storage.from('product-images').remove([path]);
          throw rowError;
        }
        uploaded += 1;
      }
      onNotice(uploaded === 1 ? 'Imagen subida.' : `${uploaded} imágenes subidas.`);
      await load();
    } catch (reason) {
      const message = reason && typeof reason === 'object' && 'message' in reason ? String(reason.message) : 'No se pudieron subir las imágenes.';
      onNotice(uploaded ? `${uploaded} imágenes se guardaron. La siguiente falló: ${message}` : message);
      await load();
    } finally {
      setImageBusy('');
    }
  };

  const removeImage = async(image:ProductImage) => {
    if (!product || !window.confirm(`¿Eliminar “${image.original_name}”?`)) return;
    setImageBusy(image.id);
    try {
      const {error:rowError} = await supabase.from('commerce_product_images').delete().eq('id',image.id).eq('product_id',product.id);
      if (rowError) throw rowError;
      const {error:storageError} = await supabase.storage.from('product-images').remove([image.storage_path]);
      onNotice(storageError ? 'La imagen se quitó del catálogo, pero el archivo necesita limpieza manual.' : 'Imagen eliminada.');
      await load();
    } catch (reason) {
      onNotice(reason && typeof reason === 'object' && 'message' in reason ? String(reason.message) : 'No se pudo eliminar la imagen.');
    } finally {
      setImageBusy('');
    }
  };
  const linkImageColor = async(image:ProductImage, color:string) => {
    if (!product) return;
    setImageBusy(image.id);
    const {error} = await supabase.from('commerce_product_images').update({option_values:color?{color}:{},variant_id:null}).eq('id', image.id);
    onNotice(error ? error.message : color ? 'Color enlazado a la foto.' : 'Foto marcada como general.');
    if (!error) await load(product.id);
    setImageBusy('');
  };

  const moveImage = async(image:ProductImage) => {
    if (!product) return;
    const targetId = imageTargets[image.id];
    const target = products.find(item => item.id === targetId);
    if (!target) {
      onNotice('Elegí a qué producto querés mover la foto.');
      return;
    }

    setImageBusy(image.id);
    const extension = image.mime_type === 'image/png' ? 'png' : image.mime_type === 'image/webp' ? 'webp' : 'jpg';
    const newPath = `${target.id}/${crypto.randomUUID()}.${extension}`;
    try {
      const {data:file,error:downloadError} = await supabase.storage.from('product-images').download(image.storage_path);
      if (downloadError || !file) throw downloadError || new Error('No se pudo leer la foto original.');
      const {error:uploadError} = await supabase.storage.from('product-images').upload(newPath,file,{cacheControl:'31536000',contentType:image.mime_type,upsert:false});
      if (uploadError) throw uploadError;

      const {error:updateError} = await supabase.from('commerce_product_images').update({
        product_id:target.id,
        storage_path:newPath,
        alt_text:`Foto de ${target.name}`,
        sort_order:target.commerce_product_images.length,
      }).eq('id',image.id).eq('product_id',product.id);
      if (updateError) {
        await supabase.storage.from('product-images').remove([newPath]);
        throw updateError;
      }

      const {error:cleanupError} = await supabase.storage.from('product-images').remove([image.storage_path]);
      setImageTargets(current => {const next={...current};delete next[image.id];return next});
      onNotice(cleanupError ? `Foto movida a “${target.name}”. El archivo anterior requiere limpieza manual.` : `Foto movida a “${target.name}”.`);
      await load(product.id);
    } catch (reason) {
      const message = reason && typeof reason === 'object' && 'message' in reason ? String(reason.message) : 'No se pudo mover la foto.';
      onNotice(message);
    } finally {
      setImageBusy('');
    }
  };

  const createVariant = async(e:React.FormEvent) => {
    e.preventDefault();
    if (!product) return;
    const price = Number(variant.price);
    const missing = variantRules.find(rule=>rule.required&&(variant.options[rule.attribute_code]===undefined||variant.options[rule.attribute_code]===''));
    if(!variant.sku.trim()||!Number.isFinite(price)||price<=0||missing){onNotice(missing?`Completá ${catalogAttributeLabel(taxonomy,missing.attribute_code)}.`:'Completá SKU y un precio válido.');return}
    const signature=optionSignature(variant.options);
    if(product.commerce_variants.some(item=>optionSignature(normalizeCatalogValueMap(item.option_values))===signature)){onNotice('Ya existe una variante con esa combinación de opciones.');return}
    setProductBusy('variant-create');
    const {error} = await supabase.from('commerce_variants').insert({
      product_id: product.id,
      sku: variant.sku.trim(),
      name: formatVariantLabel(taxonomy,product.category_code||product.category,variant.options),
      price_minor: Math.round(price*100),
      option_values: variant.options,
      color: typeof variant.options.color==='string'?variant.options.color:null,
      active: true,
    });
    onNotice(error?error.message:'Variante creada.');
    if(!error){setVariant({sku:'',price:'',options:{}});await load(product.id)}
    setProductBusy('');
  };

  const updateVariant = async (item: ProductVariant, form: typeof editingVariantForm) => {
    if (!product) return;
    const priceNum = Number(form.price);
    const missing = variantRules.find(rule=>rule.required&&(form.options[rule.attribute_code]===undefined||form.options[rule.attribute_code]===''));
    if (!form.sku.trim() || !form.price.trim() || isNaN(priceNum) || priceNum <= 0 || missing) {
      onNotice(missing?`Completá ${catalogAttributeLabel(taxonomy,missing.attribute_code)}.`:'Completá SKU y un precio válido mayor a 0.');
      return;
    }
    const signature=optionSignature(form.options);
    if(product.commerce_variants.some(candidate=>candidate.id!==item.id&&optionSignature(normalizeCatalogValueMap(candidate.option_values))===signature)){onNotice('Ya existe una variante con esa combinación de opciones.');return}
    setProductBusy(`variant-${item.id}`);
    const { error } = await supabase.from('commerce_variants').update({
      sku: form.sku.trim(),
      name: formatVariantLabel(taxonomy,product.category_code||product.category,form.options),
      color: typeof form.options.color==='string'?form.options.color:null,
      option_values: form.options,
      price_minor: Math.round(Number(form.price) * 100),
    }).eq('id', item.id).eq('product_id', product.id);

    if (error) {
      onNotice(error.message);
    } else {
      onNotice('Variante actualizada.');
      setEditingVariantId(null);
      await load(product.id);
    }
    setProductBusy('');
  };

  const toggleVariant = async(item:ProductVariant) => {
    if (!product) return;
    setProductBusy(`variant-${item.id}`);
    const {error} = await supabase.from('commerce_variants').update({active:!item.active}).eq('id',item.id).eq('product_id',product.id);
    onNotice(error ? error.message : item.active ? 'Variante desactivada.' : 'Variante activada.');
    if (!error) await load(product.id);
    setProductBusy('');
  };

  const removeVariant = async(item:ProductVariant) => {
    if (!product || !window.confirm(`¿Eliminar la variante “${item.name}” (${item.sku})?`)) return;
    setProductBusy(`variant-${item.id}`);
    const {error} = await supabase.from('commerce_variants').delete().eq('id',item.id).eq('product_id',product.id);
    onNotice(error?.code === '23503' ? 'Esta variante ya tiene movimientos asociados. Desactivala para retirarla de la venta.' : error?.message || 'Variante eliminada.');
    if (!error) await load(product.id);
    setProductBusy('');
  };

  const toggleProductPublication = async () => {
    if (!product) return;
    if (!product.published) {
      const category=product.category_code||product.category;
      const productAttributes=normalizeCatalogValueMap(product.attributes);
      const missingProduct=taxonomyRulesForCategory(taxonomy,category,'product').find(rule=>rule.required&&(productAttributes[rule.attribute_code]===undefined||productAttributes[rule.attribute_code]===''));
      if(missingProduct){onNotice(`Antes de publicar completá ${catalogAttributeLabel(taxonomy,missingProduct.attribute_code)}.`);return}
      const activeVariants=product.commerce_variants.filter(item=>item.active);
      if(!activeVariants.length){onNotice('Antes de publicar agregá al menos una variante activa.');return}
      const rules=taxonomyRulesForCategory(taxonomy,category,'variant');
      const signatures=new Set<string>();
      for(const item of activeVariants){
        const options=normalizeCatalogValueMap(item.option_values);if(!options.color&&item.color)options.color=item.color;
        const missing=rules.find(rule=>rule.required&&(options[rule.attribute_code]===undefined||options[rule.attribute_code]===''));
        if(missing){onNotice(`La variante ${item.sku} necesita ${catalogAttributeLabel(taxonomy,missing.attribute_code)}.`);return}
        if(!item.sku.trim()){onNotice('Todas las variantes activas necesitan SKU.');return}
        const signature=optionSignature(options);if(signatures.has(signature)){onNotice('Hay dos variantes activas con la misma combinación de opciones.');return}signatures.add(signature);
      }
    }
    setProductBusy('publish');
    const{error}=await supabase.from('commerce_products').update({published:!product.published}).eq('id',product.id);
    onNotice(error?error.message:!product.published?'Producto publicado.':'Producto oculto.');
    if(!error)await load(product.id);
    setProductBusy('');
  };

  return (
    <section className="catalog-workspace">
      {showNewProduct && (
        <form className="new-product-panel" onSubmit={event=>void createProduct(event)}>
          <div className="new-product-heading">
            <div><p className="eyebrow">Nueva ficha</p><h3>Crear producto</h3></div>
            <button type="button" className="secondary-button" onClick={()=>{setShowNewProduct(false);setNewProduct(EMPTY_PRODUCT_FORM())}}>Cancelar</button>
          </div>
          <p className="catalog-rule"><strong>¿Ficha o variante?</strong> Usá una variante si solo cambia el color o el tamaño. Creá otra ficha si cambia el modelo o el material.</p>
          <div className="product-fields">
            <label><span className="field-label">Nombre del producto <span className="field-required" aria-hidden="true">*</span></span><input required autoFocus value={newProduct.name} onChange={event=>setNewProduct({...newProduct,name:event.target.value})} placeholder="Ej.: Imperial clásico marrón"/></label>
            <label><span className="field-label">Categoría <span className="field-required" aria-hidden="true">*</span></span><select required value={newProduct.category} onChange={event=>setNewProduct({...newProduct,category:event.target.value,attributes:{}})}><option value="" disabled>Elegí una categoría</option>{taxonomy.categories.filter(item=>item.active).sort((a,b)=>a.sort_order-b.sort_order).map(category=><option key={category.code} value={category.code}>{category.label_es}</option>)}</select></label>
            <label><span className="field-label">Modalidad</span><select value={newProduct.saleMode} onChange={event=>setNewProduct({...newProduct,saleMode:event.target.value as SaleMode})}><option value="standard">Venta normal</option><option value="made_to_order">Por encargo</option></select></label>
            <label className="wide-field"><span className="field-label">Descripción</span><textarea value={newProduct.description} onChange={event=>setNewProduct({...newProduct,description:event.target.value})} placeholder="Material y cualquier detalle que lo diferencie."/></label>
          </div>
          <DynamicAttributeFields taxonomy={taxonomy} category={newProduct.category} scope="product" values={newProduct.attributes} onChange={attributes=>setNewProduct({...newProduct,attributes})}/>
          <div className="form-actions"><button type="submit" disabled={Boolean(productBusy)}>{productBusy === 'create' ? 'Creando…' : 'Crear producto'}</button></div>
        </form>
      )}
      <div className="catalog-index">
        <button className="new-product-button" type="button" onClick={()=>setShowNewProduct(value=>!value)}>{showNewProduct ? 'Cerrar formulario' : '+ Nuevo producto'}</button>
        <label className="catalog-search">
          <span className="sr-only">Buscar en el catálogo</span>
          <Icon name="search"/>
          <input type="search" value={search} onChange={event=>setSearch(event.target.value)} placeholder="Buscar producto, categoría o código" />
        </label>
        <div className="list" aria-label="Productos del catálogo">
        {filteredProducts.map(item => (
          <button key={item.id} className={item.id===selected?'selected':''} onClick={()=>setSelected(item.id)}>
            <strong>{item.name}</strong>
            <small>{item.published?'Publicado':'Incompleto'} · {item.commerce_variants.length} variantes · {item.commerce_product_images?.length || 0} fotos</small>
          </button>
        ))}
        {!filteredProducts.length && <div className="catalog-no-results"><strong>Sin resultados</strong><small>Probá con otra palabra.</small></div>}
        </div>
      </div>
      {product && (
        <div className="panel">
          <div className="panel-head">
            <div><h3>{product.name}</h3></div>
            <div className="product-actions">
              <button className="secondary-button" disabled={Boolean(productBusy)} onClick={()=>void toggleProductPublication()}>{productBusy === 'publish' ? 'Guardando…' : product.published?'Ocultar':'Publicar'}</button>
              <button className="danger-button" disabled={Boolean(productBusy)} onClick={()=>void deleteProduct()}>{productBusy === 'delete' ? 'Eliminando…' : 'Eliminar producto'}</button>
            </div>
          </div>

          <form className="product-details" onSubmit={event=>void saveProduct(event)}>
            <div><h4>Datos del producto</h4><p>Editá esta ficha sin afectar los demás productos del catálogo.</p></div>
            <div className="product-fields">
              <label><span className="field-label">Nombre <span className="field-required" aria-hidden="true">*</span></span><input required value={productDetails.name} onChange={event=>setProductDetails({...productDetails,name:event.target.value})}/></label>
              <label><span className="field-label">Categoría <span className="field-required" aria-hidden="true">*</span></span><select required value={productDetails.category} onChange={event=>setProductDetails({...productDetails,category:event.target.value,attributes:{}})}><option value="" disabled>Elegí una categoría</option>{taxonomy.categories.filter(item=>item.active).sort((a,b)=>a.sort_order-b.sort_order).map(category=><option key={category.code} value={category.code}>{category.label_es}</option>)}</select></label>
              <label><span className="field-label">Modalidad</span><select value={productDetails.saleMode} onChange={event=>setProductDetails({...productDetails,saleMode:event.target.value as SaleMode})}><option value="standard">Venta normal</option><option value="made_to_order">Por encargo</option></select></label>
              <label className="wide-field"><span className="field-label">Descripción</span><textarea value={productDetails.description} onChange={event=>setProductDetails({...productDetails,description:event.target.value})}/></label>
            </div>
            <DynamicAttributeFields taxonomy={taxonomy} category={productDetails.category} scope="product" values={productDetails.attributes} onChange={attributes=>setProductDetails({...productDetails,attributes})}/>
            <div className="form-actions"><button type="submit" disabled={Boolean(productBusy)}>{productBusy === 'save' ? 'Guardando…' : 'Guardar cambios'}</button></div>
          </form>

          <section className="image-manager" aria-labelledby="product-images-title">
            <input id={`product-images-${product.id}`} className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" multiple disabled={Boolean(imageBusy)} onChange={event=>void uploadImages(event)}/>
            <div className="image-manager-head">
              <div>
                <h4 id="product-images-title">Imágenes del producto</h4>
                <p>La primera imagen será la principal. PNG, JPEG o WebP de hasta 10 MB.</p>
              </div>
              {images.length > 0 && (
                <label className={`upload-button ${imageBusy ? 'disabled' : ''}`} htmlFor={`product-images-${product.id}`} aria-disabled={Boolean(imageBusy)}>
                  {imageBusy === 'upload' ? 'Subiendo…' : 'Subir imágenes'}
                </label>
              )}
            </div>
            {images.length ? (
              <div className="image-gallery">
                {images.map((image,index) => (
                  <figure className="product-image" key={image.id}>
                    <img src={productImageUrl(image.storage_path)} alt={image.alt_text || `Foto de ${product.name}`} loading="lazy" />
                    <figcaption>
                      <div className="image-meta"><strong>{index === 0 ? 'Principal' : `Imagen ${index + 1}`}</strong><span title={image.original_name}>{image.original_name}</span></div>
                      <div className="image-card-actions">
                        {imageColors.length > 0 && (
                          <select className="image-variant-select" value={String(normalizeCatalogValueMap(image.option_values).color || '')} disabled={Boolean(imageBusy)} onChange={event=>void linkImageColor(image, event.target.value)} aria-label={`Color para ${image.original_name}`}>
                            <option value="">General (todos los colores)</option>
                            {imageColors.map(color=><option key={color} value={color}>{catalogValueLabel(taxonomy,'color',color)}</option>)}
                          </select>
                        )}
                        <select value={imageTargets[image.id] || ''} disabled={Boolean(imageBusy)} onChange={event=>setImageTargets({...imageTargets,[image.id]:event.target.value})} aria-label={`Mover ${image.original_name} a otro producto`}>
                          <option value="">Mover a…</option>
                          {products.filter(item=>item.id!==product.id).map(item=><option key={item.id} value={item.id}>{item.name}</option>)}
                        </select>
                        <button className="image-move" type="button" disabled={Boolean(imageBusy) || !imageTargets[image.id]} onClick={()=>void moveImage(image)}>{imageBusy === image.id ? 'Moviendo…' : 'Mover'}</button>
                        <button className="image-delete" type="button" disabled={Boolean(imageBusy)} onClick={()=>void removeImage(image)} aria-label={`Eliminar ${image.original_name}`}>Eliminar</button>
                      </div>
                    </figcaption>
                  </figure>
                ))}
              </div>
            ) : (
              <div className="image-empty">
                <strong>Todavía no hay imágenes</strong>
                <span>Seleccioná una o varias fotos para este producto.</span>
                <label className={`upload-button ${imageBusy ? 'disabled' : ''}`} htmlFor={`product-images-${product.id}`} aria-disabled={Boolean(imageBusy)}>
                  {imageBusy === 'upload' ? 'Subiendo…' : 'Subir imágenes'}
                </label>
              </div>
            )}
          </section>

          <section className="variants-section" aria-labelledby="variants-title">
            <div><h4 id="variants-title">Variantes comprables</h4><p>El SKU y las opciones identifican cada variante. La etiqueta se genera automáticamente.</p></div>
            <div className="table-scroll">
              <table><thead><tr><th>SKU</th>{variantDefinitions.map(({definition})=><th key={definition.code}>{definition.label_es}</th>)}<th>Precio</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>
                {product.commerce_variants.map(item => {
                  const itemOptions = normalizeCatalogValueMap(item.option_values);
                  if (!itemOptions.color && item.color) itemOptions.color = item.color;
                  if (editingVariantId !== item.id) {
                    return (
                      <tr key={item.id}>
                        <td>{item.sku}<small>{item.name}</small></td>
                        {variantDefinitions.map(({definition})=><td key={definition.code}>{itemOptions[definition.code]!==undefined?catalogValueLabel(taxonomy,definition.code,itemOptions[definition.code] as CatalogValue):'—'}</td>)}
                        <td>{money(item.price_minor)}</td>
                        <td><span className={`status-badge ${item.active ? 'status-ready_for_production' : 'status-cancelled'}`}>{item.active ? 'Activa' : 'Inactiva'}</span></td>
                        <td>
                          <div className="row-actions">
                            <button className="compact-button secondary-button" type="button" disabled={Boolean(productBusy)} onClick={() => { setEditingVariantId(item.id); setEditingVariantForm({ sku: item.sku, price: (item.price_minor / 100).toString(), options: itemOptions }); }}>Editar</button>
                            <button className="compact-button secondary-button" type="button" disabled={Boolean(productBusy)} onClick={()=>void toggleVariant(item)}>{item.active ? 'Desactivar' : 'Activar'}</button>
                            <button className="compact-button danger-button" type="button" disabled={Boolean(productBusy)} onClick={()=>void removeVariant(item)}>Eliminar</button>
                          </div>
                        </td>
                      </tr>
                    );
                  }

                  const handleKeyDown = (e: React.KeyboardEvent) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void updateVariant(item, editingVariantForm);
                    } else if (e.key === 'Escape') {
                      e.preventDefault();
                      setEditingVariantId(null);
                    }
                  };

                  return (
                    <tr key={item.id}>
                      <td>
                        <input type="text" placeholder="SKU" value={editingVariantForm.sku} disabled={Boolean(productBusy)} onChange={e => setEditingVariantForm({ ...editingVariantForm, sku: e.target.value })} onKeyDown={handleKeyDown} aria-label="SKU" autoFocus />
                      </td>
                      {variantDefinitions.map(({rule,definition})=><td key={definition.code}><TaxonomyValueField definition={definition} taxonomy={taxonomy} value={editingVariantForm.options[definition.code]} required={rule.required} onChange={value=>{const options={...editingVariantForm.options};if(value===undefined)delete options[definition.code];else options[definition.code]=value;setEditingVariantForm({...editingVariantForm,options})}}/></td>)}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <span>$</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            value={editingVariantForm.price}
                            disabled={Boolean(productBusy)}
                            onChange={e => setEditingVariantForm({ ...editingVariantForm, price: e.target.value })}
                            onKeyDown={handleKeyDown}
                            style={{ width: '85px' }}
                            aria-label="Precio"
                          />
                        </div>
                      </td>
                      <td>
                        <span className={`status-badge ${item.active ? 'status-ready_for_production' : 'status-cancelled'}`}>
                          {item.active ? 'Activa' : 'Inactiva'}
                        </span>
                      </td>
                      <td>
                        <div className="row-actions">
                          <button
                            className="compact-button"
                            type="button"
                            disabled={Boolean(productBusy)}
                            onClick={() => void updateVariant(item, editingVariantForm)}
                          >
                            {productBusy === `variant-${item.id}` ? 'Guardando…' : 'Guardar'}
                          </button>
                          <button
                            className="compact-button secondary-button"
                            type="button"
                            disabled={Boolean(productBusy)}
                            onClick={() => setEditingVariantId(null)}
                          >
                            Cancelar
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!product.commerce_variants.length&&<tr><td className="empty-table" colSpan={variantDefinitions.length+4}>Este producto todavía no tiene variantes.</td></tr>}
              </tbody></table>
            </div>
          </section>
          <form className="form-grid variant-create" onSubmit={event=>void createVariant(event)}>
            <h4>Nueva variante</h4>
            <label><span className="field-label">SKU <span className="field-required" aria-hidden="true">*</span></span><input required value={variant.sku} onChange={e=>setVariant({...variant,sku:e.target.value})}/></label>
            <DynamicAttributeFields taxonomy={taxonomy} category={product.category_code||product.category} scope="variant" values={variant.options} onChange={options=>setVariant({...variant,options})}/>
            <label><span className="field-label">Precio UYU <span className="field-required" aria-hidden="true">*</span></span><input required type="number" min="1" step="0.01" value={variant.price} onChange={e=>setVariant({...variant,price:e.target.value})}/></label>
            <button disabled={Boolean(productBusy)}>{productBusy === 'variant-create' ? 'Creando…' : 'Crear variante'}</button>
          </form>
        </div>
      )}
    </section>
  );
}

type CatalogListProduct = Pick<Product, 'id' | 'name' | 'category' | 'category_code' | 'attributes' | 'catalog_filters' | 'commerce_variants'>;
type CatalogListRow = CatalogListProduct & { material:string; color:string; variant:ProductVariant|null };

function CatalogList({onNotice}:{onNotice:(v:string)=>void}) {
  const [products,setProducts] = useState<CatalogListProduct[]>([]);
  const [sortColumn, setSortColumn] = useState<'sku' | 'price' | null>('sku');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const load = useCallback(async() => {
    const selection = 'id,name,category,category_code,attributes,catalog_filters,commerce_variants(id,sku,name,price_minor,active,color,weight_grams,option_values)';
    const legacySelection = 'id,name,category,commerce_variants(id,sku,name,price_minor,active,color)';
    let {data,error}:{data:unknown;error:{message:string;code?:string}|null} = await supabase
      .from('commerce_products')
      .select(selection)
      .neq('category','sandbox')
      .order('name');
    if (error && (error.code === '42703' || /category_code|attributes|option_values|catalog_filters/i.test(error.message))) {
      ({data,error} = await supabase.from('commerce_products').select(legacySelection).neq('category','sandbox').order('name'));
    }
    if (error) {
      onNotice(`No se pudo cargar la lista: ${error.message}`);
      return;
    }
    setProducts((data || []) as CatalogListProduct[]);
  },[onNotice]);

  useEffect(() => { void load(); },[load]);

  const rows: CatalogListRow[] = useMemo(() => {
    return products.flatMap<CatalogListRow>(product => {
      const normalizedAttrs = normalizeCatalogAttributes(product.catalog_filters);
      const structuredAttributes = normalizeCatalogValueMap(product.attributes);
      const structuredMaterial = structuredAttributes.material;
      const material = structuredMaterial !== undefined
        ? catalogValueLabel(defaultCatalogTaxonomy,'material',structuredMaterial)
        : normalizedAttrs.materials
        .map(value => catalogMaterialLabels[value] || value)
        .join(', ') || '—';
      const defaultColor = normalizedAttrs.colors
        .map(value => catalogColorLabels[value] || value)
        .join(', ') || '—';
      const variants = product.commerce_variants || [];
      return variants.length
        ? variants.map(variant => {
            const structuredColor = normalizeCatalogValueMap(variant.option_values).color;
            const variantColor = structuredColor === undefined ? variant.color : String(structuredColor);
            const color = variantColor
              ? catalogValueLabel(defaultCatalogTaxonomy,'color',variantColor)
              : defaultColor;
            return { ...product, material, color, variant };
          })
        : [{ ...product, material, color: defaultColor, variant: null }];
    });
  }, [products]);

  const toggleSkuSort = () => {
    if (sortColumn === 'sku') {
      setSortDirection(current => (current === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn('sku');
      setSortDirection('asc');
    }
  };

  const togglePriceSort = () => {
    if (sortColumn === 'price') {
      setSortDirection(current => (current === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn('price');
      setSortDirection('asc');
    }
  };

  const filteredAndSortedRows = useMemo(() => {
    let result = rows;

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(r =>
        (r.variant?.sku && r.variant.sku.toLowerCase().includes(q)) ||
        r.name.toLowerCase().includes(q) ||
        (r.variant?.name && r.variant.name.toLowerCase().includes(q)) ||
        r.material.toLowerCase().includes(q) ||
        r.color.toLowerCase().includes(q)
      );
    }

    if (categoryFilter !== 'all') {
      result = result.filter(r => r.category === categoryFilter);
    }

    if (sortColumn === 'sku') {
      result = [...result].sort((a, b) => {
        const skuA = (a.variant?.sku || '').trim();
        const skuB = (b.variant?.sku || '').trim();
        if (!skuA && !skuB) return 0;
        if (!skuA) return 1;
        if (!skuB) return -1;
        const cmp = skuA.localeCompare(skuB, undefined, { numeric: true, sensitivity: 'base' });
        return sortDirection === 'asc' ? cmp : -cmp;
      });
    } else if (sortColumn === 'price') {
      result = [...result].sort((a, b) => {
        const priceA = a.variant?.price_minor ?? Infinity;
        const priceB = b.variant?.price_minor ?? Infinity;
        if (priceA === priceB) return 0;
        if (priceA === Infinity) return 1;
        if (priceB === Infinity) return -1;
        return sortDirection === 'asc' ? priceA - priceB : priceB - priceA;
      });
    }

    return result;
  }, [rows, search, categoryFilter, sortColumn, sortDirection]);

  return <section className="data-panel" aria-label="Lista de productos del catálogo">
    <div className="print-only-header">
      <div className="print-header-top">
        <div className="print-brand">
          <img src="/logo-matearte.avif" alt="MateArte" className="print-logo" />
          <div>
            <h2>MateArte</h2>
            <span className="print-subtitle">Lista de Precios</span>
          </div>
        </div>
        <div className="print-meta">
          <div><span>Fecha:</span> <strong>{new Date().toLocaleDateString('es-UY', { day: '2-digit', month: '2-digit', year: 'numeric' })}</strong></div>
          {categoryFilter !== 'all' && (
            <div><span>Categoría:</span> <strong>{catalogCategoryLabels[categoryFilter] || categoryFilter}</strong></div>
          )}
        </div>
      </div>
    </div>
    <div className="table-summary" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
      <div>
        <strong>{products.length} productos</strong>
        <small style={{ marginLeft: '0.5rem' }}>
          {filteredAndSortedRows.length} {filteredAndSortedRows.length === 1 ? 'variante listada' : 'variantes listadas'}
        </small>
      </div>
      <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
        <input
          type="search"
          className="no-print"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por SKU o producto…"
          style={{
            height: '34px',
            padding: '0.35rem 0.65rem',
            border: '1px solid #b7c0b9',
            borderRadius: '0.25rem',
            fontSize: '0.8rem',
            minWidth: '180px',
          }}
        />
        <select
          className="no-print"
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
          style={{
            height: '34px',
            padding: '0.35rem 0.65rem',
            border: '1px solid #b7c0b9',
            borderRadius: '0.25rem',
            fontSize: '0.8rem',
            background: '#fff',
          }}
        >
          <option value="all">Todas las categorías</option>
          {catalogCategoryIds.map(cat => (
            <option key={cat} value={cat}>{catalogCategoryLabels[cat] || cat}</option>
          ))}
        </select>
        <button
          type="button"
          className="secondary-button no-print print-button"
          onClick={() => window.print()}
          title="Imprimir lista de precios"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            minHeight: '34px',
            height: '34px',
            padding: '0.35rem 0.75rem',
            fontSize: '0.8rem',
            cursor: 'pointer',
          }}
        >
          <Icon name="print" />
          <span>Imprimir</span>
        </button>
      </div>
    </div>
    <div className="table-scroll">
      <table className="data-table catalog-list-table">
        <thead>
          <tr>
            <th
              scope="col"
              style={{ cursor: 'pointer', userSelect: 'none' }}
              onClick={toggleSkuSort}
              title="Click para alternar orden por SKU (menor a mayor / mayor a menor)"
            >
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                <span>SKU</span>
                <span className="no-print" style={{ fontSize: '0.85rem', color: sortColumn === 'sku' ? 'var(--green-800)' : '#8a9990' }}>
                  {sortColumn === 'sku' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}
                </span>
              </div>
            </th>
            <th>Producto</th>
            <th>Categoría</th>
            <th>Material</th>
            <th>Color</th>
            <th
              scope="col"
              className="numeric"
              style={{ cursor: 'pointer', userSelect: 'none' }}
              onClick={togglePriceSort}
              title="Ordenar por precio (menor a mayor / mayor a menor)"
            >
              <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.35rem' }}>
                <span>Precio</span>
                <span className="no-print" style={{ fontSize: '0.85rem', color: sortColumn === 'price' ? 'var(--green-800)' : '#8a9990' }}>
                  {sortColumn === 'price' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}
                </span>
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          {filteredAndSortedRows.map(row => <tr key={`${row.id}-${row.variant?.id || 'sin-variante'}`}>
            <td>{row.variant?.sku || '—'}</td>
            <td><strong>{row.name}</strong>{row.variant?.name && <small>{row.variant.name}</small>}</td>
            <td>{catalogCategoryLabels[row.category_code||row.category] || row.category_code || row.category || '—'}</td>
            <td>{row.material}</td>
            <td>{row.color}</td>
            <td className="numeric"><strong>{row.variant ? money(row.variant.price_minor) : '—'}</strong></td>
          </tr>)}
          {!filteredAndSortedRows.length && <tr><td className="empty-table" colSpan={6}>No se encontraron productos con los filtros seleccionados.</td></tr>}
        </tbody>
      </table>
    </div>
  </section>;
}

export const CARRIER_OPTIONS = [
  { value: 'DAC', label: 'DAC', group: 'national' },
  { value: 'Correo Uruguayo', label: 'Correo Uruguayo', group: 'national' },
  { value: 'Mirtrans', label: 'Mirtrans', group: 'national' },
  { value: 'DePunta', label: 'DePunta', group: 'national' },
  { value: 'DHL Express', label: 'DHL Express', group: 'international' },
  { value: 'FedEx', label: 'FedEx', group: 'international' },
  { value: 'UPS', label: 'UPS', group: 'international' },
];

export function resolveCarrierSelection(rawCarrier?: string | null, predefinedOptions = CARRIER_OPTIONS) {
  const carrier = rawCarrier?.trim() || '';
  const matched = predefinedOptions.find(c => c.value === carrier);
  if (matched) {
    return {
      selectedCarrier: matched.value,
      customCarrier: '',
      shippingCarrier: matched.value,
    };
  }
  if (carrier) {
    return {
      selectedCarrier: '__other__',
      customCarrier: carrier,
      shippingCarrier: carrier,
    };
  }
  return {
    selectedCarrier: '',
    customCarrier: '',
    shippingCarrier: '',
  };
}

export function getStoreApiUrl(): string {
  const envUrl = (import.meta.env.VITE_STORE_API_URL || '').trim();
  if (envUrl) return envUrl.replace(/\/$/, '');
  const isLocalhost = typeof window !== 'undefined' && (
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname === '[::1]' ||
    window.location.hostname.endsWith('.localhost')
  );
  return isLocalhost ? 'http://localhost:3000' : 'https://www.matearteuruguay.com';
}

function OrderDeliverySummary({order,compact=false}:{order:Order;compact?:boolean}) {
  const details = getOrderDeliveryDetails(order);
  const locality = [details.city,details.department].filter((value,index,all)=>value&&all.indexOf(value)===index).join(', ');
  return <section className={`order-delivery-summary${compact?' order-delivery-summary--compact':''}`} aria-label="Datos de entrega">
    <div className="order-delivery-summary__heading">
      <div><small>Entrega</small><strong>{details.methodLabel}</strong></div>
      {details.zone&&<span>{details.zone}</span>}
    </div>
    <div className="order-delivery-grid">
      <div>
        <small>Cliente</small>
        <strong>{details.contactName}</strong>
        {details.phone&&<span>{details.phone}</span>}
        {details.email&&<span>{details.email}</span>}
      </div>
      <div>
        <small>{details.isPickup?'Modalidad':'Enviar a'}</small>
        {details.isPickup
          ? <strong>Retiro: no requiere despacho</strong>
          : <address>
              <strong className={details.address?'':'missing-delivery-data'}>{details.address||'Dirección no disponible'}</strong>
              {locality&&<span>{locality}</span>}
              {details.country&&<span>{details.country}</span>}
            </address>}
      </div>
    </div>
  </section>;
}

function Orders({session,onNotice}:{session:Session;onNotice:(v:string)=>void}) {
  const [orders,setOrders] = useState<Order[]>([]);
  const [taxonomy,setTaxonomy] = useState<CatalogTaxonomy>(defaultCatalogTaxonomy);
  const [busy,setBusy] = useState('');
  const [detailOrder,setDetailOrder] = useState<Order|null>(null);
  const [shipmentOrder,setShipmentOrder] = useState<Order|null>(null);
  const [shippingCarrier,setShippingCarrier] = useState('');
  const [selectedCarrier,setSelectedCarrier] = useState('');
  const [customCarrier,setCustomCarrier] = useState('');
  const [trackingCode,setTrackingCode] = useState('');
  const [shipmentError,setShipmentError] = useState('');
  const detailTriggerRef = useRef<HTMLElement|null>(null);
  const [search,setSearch] = useState(() => {
    if (typeof window === 'undefined') return '';
    const params = new URLSearchParams(window.location.search);
    return params.get('q') || params.get('search') || params.get('order') || '';
  });
  const load = useCallback(async() => {
    const {data,error} = await supabase.from('orders').select('id,order_number,status,shipping_method,shipping_snapshot,shipping_carrier,tracking_code,shipped_at,total_minor,created_at,customer_snapshot,order_items(id,item_type,title,quantity,requires_review,review_status,immutable_snapshot)').order('created_at',{ascending:false}).limit(100);
    if (error) onNotice(`No se pudieron cargar los pedidos: ${error.message}`);
    setOrders((data||[]) as Order[]);
  },[onNotice]);
  useEffect(()=>{void load()},[load]);
  useEffect(()=>{let active=true;void loadCatalogTaxonomy().then(value=>{if(active)setTaxonomy(value)});return()=>{active=false}},[]);

  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase().replace(/^#/, '');
    if (!q) return orders;
    return orders.filter(o => {
      const orderNum = String(o.order_number);
      const customer = orderCustomer(o.customer_snapshot).toLowerCase();
      const email = textValue(o.customer_snapshot.email).toLowerCase();
      const status = orderStatus(o.status).toLowerCase();
      const tracking = (o.tracking_code || '').toLowerCase();
      const id = o.id.toLowerCase();
      return orderNum.includes(q) || customer.includes(q) || email.includes(q) || status.includes(q) || tracking.includes(q) || id.includes(q);
    });
  }, [orders, search]);

  const review = async(id:string,decision:'approve'|'reject') => {
    const reason = decision === 'reject' ? window.prompt('Indicá el motivo del rechazo y reembolso:')?.trim() || '' : '';
    if (decision === 'reject' && !reason) return;
    setBusy(id);
    try {
      if (decision === 'approve') {
        const { error: itemsError } = await supabase
          .from('order_items')
          .update({ review_status: 'approved' })
          .eq('order_id', id);
        if (itemsError) throw itemsError;

        const { error: orderError } = await supabase
          .from('orders')
          .update({ status: 'ready_for_production' })
          .eq('id', id);
        if (orderError) throw orderError;

        void supabase.functions.invoke('commerce-email', { body: { orderId: id } }).catch(() => {});
        onNotice('Pedido aprobado.');
        await load();
      } else {
        const storeApi = getStoreApiUrl();
        const response = await fetch(`${storeApi}/api/admin/orders/${id}/review`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ decision, reason }),
        });
        const value = await response.json();
        onNotice(response.ok ? 'Pedido actualizado.' : value.error || 'No se pudo actualizar.');
        if (response.ok) await load();
      }
    } catch (err) {
      onNotice(decision === 'approve'
        ? (err instanceof Error ? `No se pudo aprobar el pedido: ${err.message}` : 'No se pudo aprobar el pedido.')
        : (err instanceof Error ? err.message : 'No se pudo conectar con el servicio de pedidos.'));
    } finally {
      setBusy('');
    }
  };

  const updateFulfillment = async(order:Order,action:'ship'|'restore',details?:{shippingCarrier:string;trackingCode:string}) => {
    setBusy(order.id);
    setShipmentError('');
    try {
      if (action === 'ship') {
        const carrier = (details?.shippingCarrier || '').trim();
        const tracking = (details?.trackingCode || '').trim();
        if (carrier.length < 2 || carrier.length > 120) {
          setShipmentError('Ingresá una empresa de envío válida.');
          return false;
        }
        if (tracking.length < 3 || tracking.length > 160) {
          setShipmentError('Ingresá un código de seguimiento válido.');
          return false;
        }

        const isNewShipment = order.status !== 'shipped';
        const shippedAt = order.status === 'shipped' && order.shipped_at ? order.shipped_at : new Date().toISOString();

        const { error } = await supabase
          .from('orders')
          .update({
            status: 'shipped',
            shipping_carrier: carrier,
            tracking_code: tracking,
            shipped_at: shippedAt,
          })
          .eq('id', order.id);

        if (error) {
          setShipmentError(`No se pudo actualizar el envío: ${error.message}`);
          return false;
        }

        if (isNewShipment) {
          void supabase.functions.invoke('commerce-email', { body: { orderId: order.id } }).catch(() => {});
        }

        onNotice(order.status === 'shipped' ? 'Datos de envío actualizados.' : 'Pedido marcado como enviado.');
        await load();
        return true;
      }

      if (action === 'restore') {
        const hasCustomItem = order.order_items?.some(item => item.requires_review) ?? false;
        const restoredStatus = order.shipping_method === 'international_coordination'
          ? 'manual_review'
          : hasCustomItem
            ? 'ready_for_production'
            : 'ready_for_fulfillment';

        const { error } = await supabase
          .from('orders')
          .update({
            status: restoredStatus,
            shipped_at: null,
          })
          .eq('id', order.id);

        if (error) {
          onNotice(`No se pudo restaurar el pedido: ${error.message}`);
          return false;
        }

        onNotice('Pedido devuelto a preparación.');
        await load();
        return true;
      }

      return false;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error inesperado al actualizar el envío.';
      if (action === 'ship') setShipmentError(message);
      else onNotice(message);
      return false;
    } finally {
      setBusy('');
    }
  };

  const openShipment = (order:Order) => {
    setShipmentOrder(order);
    const resolved = resolveCarrierSelection(order.shipping_carrier);
    setSelectedCarrier(resolved.selectedCarrier);
    setCustomCarrier(resolved.customCarrier);
    setShippingCarrier(resolved.shippingCarrier);
    setTrackingCode(order.tracking_code||'');
    setShipmentError('');
  };

  const openDetails = (order:Order) => {
    detailTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setDetailOrder(order);
  };

  const closeDetails = () => {
    setDetailOrder(null);
    window.requestAnimationFrame(()=>detailTriggerRef.current?.focus());
  };

  const closeShipment = () => {
    if (shipmentOrder && busy === shipmentOrder.id) return;
    setShipmentOrder(null);
    setShipmentError('');
  };

  useEffect(() => {
    if (!shipmentOrder) return;
    const onKeyDown = (event:KeyboardEvent) => { if (event.key === 'Escape') closeShipment(); };
    window.addEventListener('keydown',onKeyDown);
    return () => window.removeEventListener('keydown',onKeyDown);
  },[shipmentOrder,busy]);

  useEffect(() => {
    if (!detailOrder) return;
    const onKeyDown = (event:KeyboardEvent) => { if (event.key === 'Escape') closeDetails(); };
    window.addEventListener('keydown',onKeyDown);
    return () => window.removeEventListener('keydown',onKeyDown);
  },[detailOrder]);

  return (
    <>
      <section className="data-panel" aria-label="Listado de pedidos">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          <div className="table-summary"><strong>{filteredOrders.length} {filteredOrders.length === 1 ? 'pedido' : 'pedidos'}</strong><small>{search ? `Filtrado por "${search}"` : 'Últimos 100 registros'}</small></div>
          <div style={{ position: 'relative', minWidth: '220px', maxWidth: '340px', flex: '1 1 auto' }}>
            <input
              type="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por #, cliente, correo o estado…"
              style={{
                width: '100%',
                height: '38px',
                padding: '0.4rem 0.75rem',
                border: '1px solid #b7c0b9',
                borderRadius: '0.25rem',
                fontSize: '0.85rem'
              }}
            />
          </div>
        </div>
        <div className="table-scroll">
          <table className="data-table orders-table">
            <thead><tr><th>Pedido</th><th>Fecha</th><th>Cliente</th><th>Detalle</th><th>Entrega</th><th>Estado</th><th className="numeric">Total</th><th>Acciones</th></tr></thead>
            <tbody>
              {filteredOrders.map(order => {
                const destination = order.shipping_method==='international_coordination'
                  ? [textValue(order.shipping_snapshot.city),textValue(order.shipping_snapshot.country)].filter(Boolean).join(', ') || 'Exterior'
                  : order.shipping_method === 'pickup' ? 'Retiro' : 'Envío';
                const canShip = order.shipping_method !== 'pickup' && ['ready_for_fulfillment', 'ready_for_production', 'manual_review'].includes(order.status);
                return <tr key={order.id} id={`order-${order.order_number}`}>
                  <td><button type="button" className="order-detail-trigger" onClick={()=>openDetails(order)} aria-label={`Ver detalle del pedido ${order.order_number}`}>#{order.order_number}</button></td>
                  <td>{new Date(order.created_at).toLocaleDateString('es-UY')}</td>
                  <td>{orderCustomer(order.customer_snapshot)}</td>
                  <td className="order-items-cell">{order.order_items.length?<div className="order-items-summary">{order.order_items.map(item=>{const options=getCatalogOrderOptionDetails(item,taxonomy);return <div key={item.id}><strong>{item.title}</strong>{options.length>0&&<small>{options.map(option=>`${option.label}: ${option.value}`).join(' · ')}</small>}</div>})}</div>:'Sin artículos'}</td>
                  <td><strong>{destination}</strong>{order.status==='shipped'&&<small className="tracking-summary">{order.shipping_carrier} · {order.tracking_code}</small>}</td>
                  <td><span className={`status-badge status-${order.status}`}>{orderStatus(order.status)}</span></td>
                  <td className="numeric"><strong>{money(order.total_minor)}</strong></td>
                  <td><div className="row-actions">
                    <button className="compact-button secondary-button" type="button" onClick={()=>openDetails(order)}>Ver detalle</button>
                    {order.status==='paid_pending_review'&&<><button className="compact-button" disabled={busy===order.id} onClick={()=>void review(order.id,'approve')}>{busy===order.id?'Procesando…':'Aprobar'}</button><button className="compact-button danger" disabled={busy===order.id} onClick={()=>void review(order.id,'reject')}>Rechazar</button></>}
                    {canShip&&<button className="compact-button" disabled={busy===order.id} onClick={()=>openShipment(order)}>Marcar enviado</button>}
                    {order.status==='shipped'&&<><button className="compact-button secondary-button" disabled={busy===order.id} onClick={()=>openShipment(order)}>Editar envío</button><button className="compact-button secondary-button" disabled={busy===order.id} onClick={()=>{if(window.confirm('¿Querés volver este pedido a preparación? El cliente dejará de verlo como enviado.'))void updateFulfillment(order,'restore')}}>{busy===order.id?'Procesando…':order.shipping_method==='international_coordination'?'Volver a revisión':order.order_items.some(item=>item.requires_review)?'Volver a producción':'Volver a preparación'}</button></>}
                  </div>{order.shipping_method==='pickup'&&['ready_for_fulfillment','ready_for_production'].includes(order.status)&&<small className="row-action-note">Retiro: no requiere envío</small>}</td>
                </tr>;
              })}
              {!filteredOrders.length && <tr><td className="empty-table" colSpan={8}>{search ? `No se encontraron pedidos con "${search}".` : 'Todavía no hay pedidos.'}</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {detailOrder&&<div className="modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)closeDetails()}}>
        <section className="shipment-modal order-detail-modal" role="dialog" aria-modal="true" aria-labelledby="order-detail-modal-title" aria-describedby="order-detail-modal-description">
          <div className="order-detail-modal__content">
            <header>
              <div className="order-detail-modal__title-row">
                <div><p className="eyebrow">Pedido #{detailOrder.order_number}</p><h2 id="order-detail-modal-title">Detalle del pedido</h2></div>
                <span className={`status-badge status-${detailOrder.status}`}>{orderStatus(detailOrder.status)}</span>
              </div>
              <p id="order-detail-modal-description">Datos guardados al confirmar la compra. Usá este destino para preparar la entrega.</p>
            </header>
            <OrderDeliverySummary order={detailOrder}/>
            <section className="order-detail-items" aria-labelledby="order-detail-items-title">
              <div className="order-detail-section-heading"><h3 id="order-detail-items-title">Artículos</h3><strong>{money(detailOrder.total_minor)}</strong></div>
              <ul>{detailOrder.order_items.map(item=>{const options=getCatalogOrderOptionDetails(item,taxonomy);return <li key={item.id}><div className="order-detail-item-copy"><span>{item.title}</span>{options.length>0&&<dl>{options.map(option=><div key={option.attribute}><dt>{option.label}</dt><dd>{option.value}</dd></div>)}</dl>}</div><strong>{item.quantity} ×</strong></li>})}</ul>
            </section>
            {detailOrder.status==='shipped'&&<section className="order-tracking-detail" aria-label="Seguimiento guardado"><small>Envío registrado</small><strong>{detailOrder.shipping_carrier}</strong><span>{detailOrder.tracking_code}</span></section>}
            <footer>
              <button type="button" className="secondary-button" autoFocus onClick={closeDetails}>Cerrar</button>
              {detailOrder.shipping_method!=='pickup'&&['ready_for_fulfillment','ready_for_production','manual_review'].includes(detailOrder.status)&&<button type="button" onClick={()=>{const order=detailOrder;setDetailOrder(null);openShipment(order)}}>Marcar enviado</button>}
              {detailOrder.status==='shipped'&&<button type="button" onClick={()=>{const order=detailOrder;setDetailOrder(null);openShipment(order)}}>Editar envío</button>}
            </footer>
          </div>
        </section>
      </div>}

      {shipmentOrder&&<div className="modal-backdrop">
        <section className="shipment-modal" role="dialog" aria-modal="true" aria-labelledby="shipment-modal-title" aria-describedby="shipment-modal-description">
          <form onSubmit={async event=>{event.preventDefault();const saved=await updateFulfillment(shipmentOrder,'ship',{shippingCarrier,trackingCode});if(saved)setShipmentOrder(null)}}>
            <header>
              <p className="eyebrow">Pedido #{shipmentOrder.order_number}</p>
              <h2 id="shipment-modal-title">{shipmentOrder.status==='shipped'?'Editar datos de envío':'Marcar como enviado'}</h2>
              <p id="shipment-modal-description">Guardá la empresa y el código que el cliente necesita para seguir el paquete.</p>
            </header>
            <OrderDeliverySummary order={shipmentOrder} compact/>
            <label htmlFor="shipping-carrier-select">Empresa de envío <span aria-hidden="true">*</span></label>
            <select
              id="shipping-carrier-select"
              required
              autoFocus={selectedCarrier !== '__other__'}
              value={selectedCarrier}
              onChange={event => {
                const val = event.target.value;
                setSelectedCarrier(val);
                if (val === '__other__') {
                  setShippingCarrier(customCarrier);
                } else {
                  setShippingCarrier(val);
                }
              }}
            >
              <option value="" disabled>Seleccioná una empresa</option>
              <optgroup label="Envíos nacionales (Uruguay)">
                {CARRIER_OPTIONS.filter(c => c.group === 'national').map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </optgroup>
              <optgroup label="Envíos internacionales">
                {CARRIER_OPTIONS.filter(c => c.group === 'international').map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </optgroup>
              <option value="__other__">Otra empresa (escribir nombre)…</option>
            </select>
            {selectedCarrier === '__other__' && (
              <>
                <label htmlFor="custom-shipping-carrier">Nombre de la empresa <span aria-hidden="true">*</span></label>
                <input
                  id="custom-shipping-carrier"
                  required
                  minLength={2}
                  maxLength={120}
                  placeholder="Ej.: Turil, Nuñez, Starken…"
                  value={customCarrier}
                  onChange={e => {
                    setCustomCarrier(e.target.value);
                    setShippingCarrier(e.target.value);
                  }}
                  autoFocus
                />
              </>
            )}
            <label htmlFor="tracking-code">Código de seguimiento <span aria-hidden="true">*</span></label>
            <input id="tracking-code" required minLength={3} maxLength={160} autoComplete="off" value={trackingCode} onChange={event=>setTrackingCode(event.target.value)} />
            <p className="field-help">{shipmentOrder.status==='shipped'?'Los cambios se verán en el detalle del pedido del cliente.':'Al confirmar, el pedido cambia a Enviado y el cliente recibe estos datos por correo.'}</p>
            {shipmentError&&<p className="modal-error" role="alert">{shipmentError}</p>}
            <footer>
              <button type="button" className="secondary-button" disabled={busy===shipmentOrder.id} onClick={closeShipment}>Cancelar</button>
              <button type="submit" disabled={busy===shipmentOrder.id}>{busy===shipmentOrder.id?'Guardando…':shipmentOrder.status==='shipped'?'Guardar cambios':'Confirmar envío'}</button>
            </footer>
          </form>
        </section>
      </div>}
    </>
  );
}

function Shipping({onNotice}:{onNotice:(v:string)=>void}){const[rates,setRates]=useState<Rate[]>([]);const[form,setForm]=useState({code:'',name:'',rate:'',departments:''});const load=useCallback(async()=>{const{data}=await supabase.from('shipping_rates').select('*').order('is_pickup',{ascending:false});setRates((data||[]) as Rate[])},[]);useEffect(()=>{void load()},[load]);return <section className="panel"><table><thead><tr><th>Zona</th><th>Departamentos</th><th>Tarifa</th><th>Estado</th></tr></thead><tbody>{rates.map(r=><tr key={r.id}><td>{r.name}</td><td>{r.is_pickup?'Retiro':r.departments.join(', ')}</td><td>{money(r.rate_minor)}</td><td>{r.active?'Activa':'Inactiva'}</td></tr>)}</tbody></table><form className="form-grid" onSubmit={async e=>{e.preventDefault();const{error}=await supabase.from('shipping_rates').insert({code:form.code,name:form.name,rate_minor:Math.round(Number(form.rate)*100),departments:form.departments.split(',').map(v=>v.trim()).filter(Boolean),is_pickup:false,active:true});onNotice(error?error.message:'Zona creada.');if(!error){setForm({code:'',name:'',rate:'',departments:''});await load()}}}><h4>Nueva zona nacional</h4><label>Código<input required value={form.code} onChange={e=>setForm({...form,code:e.target.value})}/></label><label>Nombre<input required value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label><label>Tarifa UYU<input required type="number" min="0" value={form.rate} onChange={e=>setForm({...form,rate:e.target.value})}/></label><label>Departamentos, separados por coma<input required value={form.departments} onChange={e=>setForm({...form,departments:e.target.value})}/></label><button>Crear zona</button></form></section>}

function Settings({onNotice}:{onNotice:(v:string)=>void}){const[value,setValue]=useState<Record<string,boolean|number>|null>(null);const load=useCallback(async()=>{const{data}=await supabase.from('commerce_settings').select('*').eq('singleton',true).single();setValue(data)},[]);useEffect(()=>{void load()},[load]);if(!value)return <p>Cargando…</p>;const save=async(next:Record<string,boolean|number>)=>{const{error}=await supabase.from('commerce_settings').update(next).eq('singleton',true);onNotice(error?error.message:'Configuración guardada.');if(!error)setValue({...value,...next})};return <><section className="panel settings"><div className="warning"><strong>Salida controlada</strong><p>Mercado Pago y el comercio permanecen apagados hasta cerrar sandbox, credenciales y catálogo. La comisión requiere aprobación legal independiente.</p></div>{[['commerce_enabled','Habilitar comercio'],['mercado_pago_enabled','Habilitar Mercado Pago'],['payment_fee_legal_approval','Aprobación escrita de comisión'],['payment_fee_enabled','Cobrar comisión separada']].map(([key,label])=><label className="toggle" key={key}><span>{label}</span><input type="checkbox" checked={Boolean(value[key])} onChange={e=>void save({[key]:e.target.checked})}/></label>)}</section><TaxonomyManager onNotice={onNotice}/></>}
