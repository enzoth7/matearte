import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { PersonalizedOrders } from './PersonalizedOrdersView';
import {
  catalogCategoryIds,
  catalogColorIds,
  catalogFinishIds,
  catalogMaterialIds,
  catalogProductTypeIds,
  emptyCatalogAttributes,
  normalizeCatalogAttributes,
  type CatalogAttributes,
} from '../../shared/catalog-taxonomy';

type Tab = 'catalog' | 'orders' | 'personalized' | 'shipping' | 'settings';
type ProductImage = { id:string;storage_path:string;original_name:string;alt_text:string;mime_type:string;byte_size:number;sort_order:number };
type SaleMode = 'standard'|'made_to_order';
type ProductVariant = {id:string;sku:string;name:string;price_minor:number;weight_grams:number|null;inventory_tracked:boolean;stock_on_hand:number;stock_reserved:number;active:boolean};
type Product = { id:string; editorial_slug:string; name:string; category:string; description:string; sale_mode:SaleMode; published:boolean; catalog_filters?:unknown; commerce_variants:ProductVariant[]; commerce_product_images:ProductImage[] };
type ProductForm = {name:string;category:string;description:string;saleMode:SaleMode;catalogFilters:CatalogAttributes};
type Order = { id:string;order_number:number;status:string;shipping_method:string;shipping_snapshot:Record<string,unknown>;total_minor:number;created_at:string;customer_snapshot:Record<string,unknown>;order_items:Array<{id:string;title:string;requires_review:boolean;review_status:string|null}> };
type Rate = {id:string;code:string;name:string;departments:string[];rate_minor:number;is_pickup:boolean;active:boolean};
const money=(minor:number)=>new Intl.NumberFormat('es-UY',{style:'currency',currency:'UYU',maximumFractionDigits:0}).format(minor/100);
const MAX_PRODUCT_IMAGE_BYTES = 5 * 1024 * 1024;
const PRODUCT_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const productImageUrl = (path:string) => supabase.storage.from('product-images').getPublicUrl(path).data.publicUrl;
const fileExtension = (file:File) => file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || (file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg');
const TEST_ADMIN_USERNAME = (import.meta.env.VITE_COMMERCE_ADMIN_USERNAME || 'user').trim().toLowerCase();
const TEST_ADMIN_EMAIL = (import.meta.env.VITE_COMMERCE_ADMIN_EMAIL || 'user@matearte.uy').trim().toLowerCase();
const EMPTY_PRODUCT_FORM = (): ProductForm => ({name:'',category:'mates',description:'',saleMode:'standard',catalogFilters:emptyCatalogAttributes()});
const productSlug = (name:string) => name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,120) || `producto-${Date.now()}`;

type IconName = Tab | 'logout' | 'search';

function Icon({ name }: { name: IconName }) {
  const paths: Record<IconName, ReactNode> = {
    catalog: <><path d="M4 5.5h16v13H4z"/><path d="M8 9h8M8 13h5"/></>,
    orders: <><path d="M6 3.5h12v17H6z"/><path d="M9 8h6M9 12h6M9 16h4"/></>,
    personalized: <><path d="M12 3 14.2 8.8 20 11l-5.8 2.2L12 19l-2.2-5.8L4 11l5.8-2.2z"/></>,
    shipping: <><path d="M3 6h11v11H3zM14 10h4l3 3v4h-7z"/><path d="M7 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm10 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"/></>,
    settings: <><path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/></>,
    logout: <><path d="M10 5H5v14h5M14 8l4 4-4 4M8 12h10"/></>,
    search: <><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 4 4"/></>,
  };
  return <svg className="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

const textValue = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const orderCustomer = (snapshot: Record<string, unknown>) => textValue(snapshot.fullName) || textValue(snapshot.name) || textValue(snapshot.email) || 'Cliente sin nombre';
const orderStatus = (status: string) => ({
  pending_payment: 'Pendiente de pago',
  paid_pending_review: 'Requiere revisión',
  ready_for_production: 'En producción',
  ready_for_fulfillment: 'Listo para entregar',
  payment_failed: 'Pago fallido',
  cancelled: 'Cancelado',
  refunded: 'Reembolsado',
  manual_review: 'Revisión manual',
}[status] || status.replaceAll('_', ' '));
const normalizeSearch = (value:string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

type AttributeKey = keyof CatalogAttributes;
const catalogAttributeGroups: Array<{key:AttributeKey;legend:string;options:Array<{value:string;label:string}>}> = [
  {key:'materials',legend:'Material',options:catalogMaterialIds.map(value=>({value,label:({
    cuero:'Cuero',plata:'Plata',alpaca:'Alpaca','acero-inoxidable':'Acero inoxidable','otros-metales':'Otros metales',madera:'Madera',
  } as Record<string,string>)[value]}))},
  {key:'productTypes',legend:'Tipo / modelo',options:catalogProductTypeIds.map(value=>({value,label:({
    imperial:'Imperial',camionero:'Camionero',criollo:'Criollo',torpedo:'Torpedo',cuadrado:'Cuadrado',ovalado:'Ovalado',fina:'Fina',bombillon:'Bombillón','pico-de-loro':'Pico de loro',cinto:'Cinto',billetera:'Billetera',calzado:'Calzado',bota:'Bota',
  } as Record<string,string>)[value]}))},
  {key:'finishes',legend:'Terminación',options:catalogFinishIds.map(value=>({value,label:({
    premium:'Premium',clasico:'Clásico',liso:'Liso',estampado:'Estampado',cincelado:'Cincelado','con-aplique':'Con aplique','con-aros':'Con aros','con-virola':'Con virola',
  } as Record<string,string>)[value]}))},
  {key:'colors',legend:'Color',options:catalogColorIds.map(value=>({value,label:({
    marron:'Marrón',negro:'Negro',natural:'Natural',colorado:'Colorado','cuero-crudo':'Cuero crudo','cuero-tostado':'Cuero tostado',arena:'Arena',cacao:'Cacao',salvia:'Salvia',
  } as Record<string,string>)[value]}))},
];

function CatalogAttributeFields({attributes,onChange}:{attributes:CatalogAttributes;onChange:(value:CatalogAttributes)=>void}) {
  const toggle = (key:AttributeKey,value:string) => {
    const selected = attributes[key] as string[];
    onChange({...attributes,[key]:selected.includes(value)?selected.filter(item=>item!==value):[...selected,value]} as CatalogAttributes);
  };
  return <fieldset className="catalog-attributes">
    <legend>Filtros del catálogo</legend>
    <p>Marcá todas las opciones que correspondan a esta ficha. Si el color cambia entre variantes, dejá marcados todos los colores disponibles.</p>
    <div className="catalog-attribute-groups">
      {catalogAttributeGroups.map(group=><section key={group.key} className="catalog-attribute-group" aria-label={group.legend}>
        <h5>{group.legend}</h5>
        <div>{group.options.map(option=><label key={option.value}><input type="checkbox" checked={(attributes[group.key] as string[]).includes(option.value)} onChange={()=>toggle(group.key,option.value)}/><span>{option.label}</span></label>)}</div>
      </section>)}
    </div>
  </fieldset>;
}

function Login({onSession}:{onSession:(session:Session)=>void}){const[username,setUsername]=useState('');const[password,setPassword]=useState('');const[error,setError]=useState('');const[busy,setBusy]=useState(false);return <main className="login"><form onSubmit={async e=>{e.preventDefault();setBusy(true);setError('');const value=username.trim().toLowerCase();const email=value===TEST_ADMIN_USERNAME?TEST_ADMIN_EMAIL:value;const{data,error}=await supabase.auth.signInWithPassword({email,password});setBusy(false);if(error)setError(error.message);else if(data.session)onSession(data.session)}}><p className="eyebrow">Administración segura</p><h1>Comercio MateArte</h1><p>Acceso limitado a membresías guardadas en la base de datos.</p>{error&&<div className="error">{error}</div>}<label>Usuario o correo<input type="text" autoComplete="username" required value={username} onChange={e=>setUsername(e.target.value)}/></label><label>Contraseña<input type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)}/></label><button disabled={busy}>{busy?'Ingresando…':'Ingresar'}</button></form></main>}

export function App(){const[session,setSession]=useState<Session|null>(null);const[authorized,setAuthorized]=useState<boolean|null>(null);const[authorizationError,setAuthorizationError]=useState('');const[tab,setTab]=useState<Tab>('catalog');const[notice,setNotice]=useState('');
 useEffect(()=>{supabase.auth.getSession().then(({data})=>setSession(data.session));const{data}=supabase.auth.onAuthStateChange((_e,next)=>setSession(next));return()=>data.subscription.unsubscribe()},[]);
 useEffect(()=>{if(!session){setAuthorized(null);setAuthorizationError('');return}let cancelled=false;supabase.from('commerce_admin_users').select('user_id').eq('user_id',session.user.id).eq('active',true).maybeSingle().then(({data,error})=>{if(cancelled)return;if(error){setAuthorizationError(error.message);setAuthorized(false);return}setAuthorizationError('');setAuthorized(Boolean(data))});return()=>{cancelled=true}},[session]);
 if(!session)return <Login onSession={setSession}/>;if(authorized===null)return <p className="loading">Verificando membresía…</p>;if(authorizationError)return <main className="denied"><h1>Verificación no disponible</h1><p>No se pudo comprobar el permiso de Comercio por un problema temporal de Supabase. Intentá de nuevo en unos minutos.</p><button onClick={()=>supabase.auth.signOut()}>Cerrar sesión</button></main>;if(!authorized)return <main className="denied"><h1>Acceso denegado</h1><p>La cuenta está autenticada, pero no integra commerce_admin_users.</p><button onClick={()=>supabase.auth.signOut()}>Cerrar sesión</button></main>;
 const navItems: Array<{id:Tab;label:string}> = [
   {id:'catalog',label:'Catálogo'},
   {id:'orders',label:'Pedidos'},
   {id:'personalized',label:'Pedidos personalizados'},
   {id:'shipping',label:'Envíos'},
   {id:'settings',label:'Activación'},
 ];
 const pageTitle = tab==='catalog'?'Catálogo y stock':tab==='orders'?'Pedidos':tab==='personalized'?'Pedidos personalizados':tab==='shipping'?'Zonas y tarifas':'Controles de salida';
 return (
   <div className="shell">
     <a className="skip-link" href="#commerce-content">Saltar al contenido</a>
     <aside className="side-navigation">
       <div className="brand-lockup"><img className="brand-logo" src="/logo-matearte.avif" alt="" aria-hidden="true"/><div><strong>MateArte</strong><small>COMERCIO</small></div></div>
       <nav aria-label="Administración de comercio">
         {navItems.map(({id,label})=><button key={id} className={tab===id?'active':''} aria-current={tab===id?'page':undefined} onClick={()=>setTab(id)}><Icon name={id}/><span>{label}</span></button>)}
       </nav>
       <div className="side-account"><small>{session.user.email}</small><button className="logout" onClick={()=>supabase.auth.signOut({scope:'local'})}><Icon name="logout"/><span>Cerrar sesión</span></button></div>
     </aside>
     <main id="commerce-content">
       <header className="page-header"><div><small>Panel de comercio</small><h1>{pageTitle}</h1></div><strong>{session.user.email}</strong></header>
       {notice&&<div className="notice" role="status">{notice}</div>}
       {tab==='catalog'&&<Catalog onNotice={setNotice}/>} {tab==='orders'&&<Orders session={session} onNotice={setNotice}/>} {tab==='personalized'&&<PersonalizedOrders onNotice={setNotice}/>} {tab==='shipping'&&<Shipping onNotice={setNotice}/>} {tab==='settings'&&<Settings onNotice={setNotice}/>}
     </main>
   </div>
 )}

function Catalog({onNotice}:{onNotice:(v:string)=>void}) {
  const [products,setProducts] = useState<Product[]>([]);
  const [selected,setSelected] = useState('');
  const [search,setSearch] = useState('');
  const [imageBusy,setImageBusy] = useState('');
  const [imageTargets,setImageTargets] = useState<Record<string,string>>({});
  const [productBusy,setProductBusy] = useState('');
  const [showNewProduct,setShowNewProduct] = useState(false);
  const [newProduct,setNewProduct] = useState<ProductForm>(EMPTY_PRODUCT_FORM);
  const [productDetails,setProductDetails] = useState<ProductForm>(EMPTY_PRODUCT_FORM);
  const [variant,setVariant] = useState({sku:'',name:'Única',price:'',weight:'',stock:'0',tracked:true});

  const load = useCallback(async(preferredId?:string) => {
    const selection = 'id,editorial_slug,name,category,description,sale_mode,published,catalog_filters,commerce_variants(id,sku,name,price_minor,weight_grams,inventory_tracked,stock_on_hand,stock_reserved,active),commerce_product_images(id,storage_path,original_name,alt_text,mime_type,byte_size,sort_order)';
    const legacySelection = selection.replace('catalog_filters,','');
    let {data,error}:{data:unknown;error:{message:string;code?:string}|null} = await supabase
      .from('commerce_products')
      .select(selection)
      .order('name');
    if (error && (error.code === '42703' || /catalog_filters/i.test(error.message))) {
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

  useEffect(() => {
    if (!product) return;
    setProductDetails({name:product.name,category:product.category,description:product.description,saleMode:product.sale_mode,catalogFilters:normalizeCatalogAttributes(product.catalog_filters)});
  },[product]);

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
      const payload = {name,category,description:newProduct.description.trim(),sale_mode:newProduct.saleMode,catalog_filters:newProduct.catalogFilters,published:false};
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
      onNotice(reason instanceof Error ? reason.message : 'No se pudo crear el producto.');
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
    const {error} = await supabase.from('commerce_products').update({name,category,description:productDetails.description.trim(),sale_mode:productDetails.saleMode,catalog_filters:productDetails.catalogFilters}).eq('id',product.id);
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
      onNotice(`“${oversized.name}” supera el máximo de 5 MB.`);
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
      const message = reason instanceof Error ? reason.message : 'No se pudieron subir las imágenes.';
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
      onNotice(reason instanceof Error ? reason.message : 'No se pudo eliminar la imagen.');
    } finally {
      setImageBusy('');
    }
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
    setProductBusy('variant-create');
    const {error} = await supabase.from('commerce_variants').insert({product_id:product.id,sku:variant.sku.trim(),name:variant.name.trim(),price_minor:Math.round(Number(variant.price)*100),weight_grams:variant.weight?Number(variant.weight):null,inventory_tracked:variant.tracked,stock_on_hand:Number(variant.stock),active:true});
    onNotice(error?error.message:'Variante creada.');
    if(!error){setVariant({sku:'',name:'Única',price:'',weight:'',stock:'0',tracked:true});await load(product.id)}
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

  return (
    <section className="catalog-workspace">
      {showNewProduct && (
        <form className="new-product-panel" onSubmit={event=>void createProduct(event)}>
          <div className="new-product-heading">
            <div><p className="eyebrow">Nueva ficha</p><h3>Crear producto</h3></div>
            <button type="button" className="secondary-button" onClick={()=>{setShowNewProduct(false);setNewProduct(EMPTY_PRODUCT_FORM())}}>Cancelar</button>
          </div>
          <p className="catalog-rule"><strong>¿Ficha o variante?</strong> Usá una variante si solo cambia el color o el tamaño. Creá otra ficha si cambia el modelo, el material o la terminación.</p>
          <div className="product-fields">
            <label>Nombre del producto <span aria-hidden="true">*</span><input required autoFocus value={newProduct.name} onChange={event=>setNewProduct({...newProduct,name:event.target.value})} placeholder="Ej.: Imperial clásico marrón"/></label>
            <label>Categoría <span aria-hidden="true">*</span><input required list="catalog-categories" value={newProduct.category} onChange={event=>setNewProduct({...newProduct,category:event.target.value})} placeholder="mates"/></label>
            <label>Modalidad<select value={newProduct.saleMode} onChange={event=>setNewProduct({...newProduct,saleMode:event.target.value as SaleMode})}><option value="standard">Venta normal</option><option value="made_to_order">Por encargo</option></select></label>
            <label className="wide-field">Descripción<textarea value={newProduct.description} onChange={event=>setNewProduct({...newProduct,description:event.target.value})} placeholder="Material, terminación y cualquier detalle que lo diferencie."/></label>
          </div>
          <CatalogAttributeFields attributes={newProduct.catalogFilters} onChange={catalogFilters=>setNewProduct({...newProduct,catalogFilters})}/>
          <div className="form-actions"><button type="submit" disabled={Boolean(productBusy)}>{productBusy === 'create' ? 'Creando…' : 'Crear producto'}</button></div>
        </form>
      )}
      <datalist id="catalog-categories">{catalogCategoryIds.map(category=><option key={category} value={category}/>)}</datalist>
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
            <div><p className="eyebrow">{product.editorial_slug}</p><h3>{product.name}</h3></div>
            <div className="product-actions">
              <button className="secondary-button" disabled={Boolean(productBusy)} onClick={async()=>{setProductBusy('publish');const{error}=await supabase.from('commerce_products').update({published:!product.published}).eq('id',product.id);onNotice(error?error.message:!product.published?'Producto publicado.':'Producto oculto.');if(!error)await load(product.id);setProductBusy('')}}>{productBusy === 'publish' ? 'Guardando…' : product.published?'Ocultar':'Publicar'}</button>
              <button className="danger-button" disabled={Boolean(productBusy)} onClick={()=>void deleteProduct()}>{productBusy === 'delete' ? 'Eliminando…' : 'Eliminar producto'}</button>
            </div>
          </div>

          <form className="product-details" onSubmit={event=>void saveProduct(event)}>
            <div><h4>Datos del producto</h4><p>Editá esta ficha sin afectar los demás productos del catálogo.</p></div>
            <div className="product-fields">
              <label>Nombre <span aria-hidden="true">*</span><input required value={productDetails.name} onChange={event=>setProductDetails({...productDetails,name:event.target.value})}/></label>
              <label>Categoría <span aria-hidden="true">*</span><input required list="catalog-categories" value={productDetails.category} onChange={event=>setProductDetails({...productDetails,category:event.target.value})}/></label>
              <label>Modalidad<select value={productDetails.saleMode} onChange={event=>setProductDetails({...productDetails,saleMode:event.target.value as SaleMode})}><option value="standard">Venta normal</option><option value="made_to_order">Por encargo</option></select></label>
              <label className="wide-field">Descripción<textarea value={productDetails.description} onChange={event=>setProductDetails({...productDetails,description:event.target.value})}/></label>
            </div>
            <CatalogAttributeFields attributes={productDetails.catalogFilters} onChange={catalogFilters=>setProductDetails({...productDetails,catalogFilters})}/>
            <div className="form-actions"><button type="submit" disabled={Boolean(productBusy)}>{productBusy === 'save' ? 'Guardando…' : 'Guardar cambios'}</button></div>
          </form>

          <section className="image-manager" aria-labelledby="product-images-title">
            <div className="image-manager-head">
              <div>
                <h4 id="product-images-title">Imágenes del producto</h4>
                <p>La primera imagen será la principal. PNG, JPEG o WebP de hasta 5 MB.</p>
              </div>
              <div>
                <input id={`product-images-${product.id}`} className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" multiple disabled={Boolean(imageBusy)} onChange={event=>void uploadImages(event)}/>
                <label className={`upload-button ${imageBusy ? 'disabled' : ''}`} htmlFor={`product-images-${product.id}`} aria-disabled={Boolean(imageBusy)}>
                  {imageBusy === 'upload' ? 'Subiendo…' : 'Subir imágenes'}
                </label>
              </div>
            </div>
            {images.length ? (
              <div className="image-gallery">
                {images.map((image,index) => (
                  <figure className="product-image" key={image.id}>
                    <img src={productImageUrl(image.storage_path)} alt={image.alt_text || `Foto de ${product.name}`} loading="lazy" />
                    <figcaption>
                      <div className="image-meta"><strong>{index === 0 ? 'Principal' : `Imagen ${index + 1}`}</strong><span title={image.original_name}>{image.original_name}</span></div>
                      <div className="image-card-actions">
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
              <label className={`image-empty ${imageBusy ? 'disabled' : ''}`} htmlFor={`product-images-${product.id}`}>
                <strong>Todavía no hay imágenes</strong>
                <span>Hacé clic para seleccionar una o varias fotos.</span>
              </label>
            )}
          </section>

          <section className="variants-section" aria-labelledby="variants-title">
            <div><h4 id="variants-title">Variantes</h4><p>Mismo producto con distinto color o tamaño. Si cambia el material o la terminación, creá otra ficha.</p></div>
            <div className="table-scroll">
              <table><thead><tr><th>SKU</th><th>Precio</th><th>Stock</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>
                {product.commerce_variants.map(item=><tr key={item.id}><td>{item.sku}<small>{item.name}</small></td><td>{money(item.price_minor)}</td><td>{item.inventory_tracked?`${item.stock_on_hand-item.stock_reserved} disp.`:'Por encargo'}</td><td><span className={`status-badge ${item.active ? 'status-ready_for_production' : 'status-cancelled'}`}>{item.active ? 'Activa' : 'Inactiva'}</span></td><td><div className="row-actions"><button className="compact-button secondary-button" type="button" disabled={Boolean(productBusy)} onClick={()=>void toggleVariant(item)}>{item.active ? 'Desactivar' : 'Activar'}</button><button className="compact-button danger-button" type="button" disabled={Boolean(productBusy)} onClick={()=>void removeVariant(item)}>Eliminar</button></div></td></tr>)}
                {!product.commerce_variants.length&&<tr><td className="empty-table" colSpan={5}>Este producto todavía no tiene variantes.</td></tr>}
              </tbody></table>
            </div>
          </section>
          <form className="form-grid" onSubmit={event=>void createVariant(event)}><h4>Nueva variante</h4><label>SKU<input required value={variant.sku} onChange={e=>setVariant({...variant,sku:e.target.value})}/></label><label>Nombre<input required value={variant.name} onChange={e=>setVariant({...variant,name:e.target.value})}/></label><label>Precio UYU<input required type="number" min="1" step="0.01" value={variant.price} onChange={e=>setVariant({...variant,price:e.target.value})}/></label><label>Peso (g)<input type="number" min="1" value={variant.weight} onChange={e=>setVariant({...variant,weight:e.target.value})}/></label><label>Stock<input type="number" min="0" value={variant.stock} onChange={e=>setVariant({...variant,stock:e.target.value})}/></label><label className="check"><input type="checkbox" checked={variant.tracked} onChange={e=>setVariant({...variant,tracked:e.target.checked})}/> Controlar stock</label><button disabled={Boolean(productBusy)}>{productBusy === 'variant-create' ? 'Creando…' : 'Crear variante'}</button></form>
        </div>
      )}
    </section>
  );
}

function Orders({session,onNotice}:{session:Session;onNotice:(v:string)=>void}) {
  const [orders,setOrders] = useState<Order[]>([]);
  const [busy,setBusy] = useState('');
  const load = useCallback(async() => {
    const {data,error} = await supabase.from('orders').select('id,order_number,status,shipping_method,shipping_snapshot,total_minor,created_at,customer_snapshot,order_items(id,title,requires_review,review_status)').order('created_at',{ascending:false}).limit(100);
    if (error) onNotice(`No se pudieron cargar los pedidos: ${error.message}`);
    setOrders((data||[]) as Order[]);
  },[onNotice]);
  useEffect(()=>{void load()},[load]);

  const review = async(id:string,decision:'approve'|'reject') => {
    const reason = decision === 'reject' ? window.prompt('Indicá el motivo del rechazo y reembolso:')?.trim() || '' : '';
    if (decision === 'reject' && !reason) return;
    setBusy(id);
    try {
      const storeApi=(import.meta.env.VITE_STORE_API_URL||'http://localhost:3000').trim().replace(/\/$/,'');
      const response=await fetch(`${storeApi}/api/admin/orders/${id}/review`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.access_token}`},body:JSON.stringify({decision,reason})});
      const value=await response.json();
      onNotice(response.ok?'Pedido actualizado.':value.error||'No se pudo actualizar.');
      if(response.ok) await load();
    } catch {
      onNotice('No se pudo conectar con el servicio de pedidos.');
    } finally {
      setBusy('');
    }
  };

  return (
    <section className="data-panel" aria-label="Listado de pedidos">
      <div className="table-summary"><strong>{orders.length} pedidos</strong><small>Últimos 100 registros</small></div>
      <div className="table-scroll">
        <table className="data-table orders-table">
          <thead><tr><th>Pedido</th><th>Fecha</th><th>Cliente</th><th>Detalle</th><th>Entrega</th><th>Estado</th><th className="numeric">Total</th><th>Acciones</th></tr></thead>
          <tbody>
            {orders.map(order => {
              const destination = order.shipping_method==='international_coordination'
                ? [textValue(order.shipping_snapshot.city),textValue(order.shipping_snapshot.country)].filter(Boolean).join(', ') || 'Exterior'
                : order.shipping_method === 'pickup' ? 'Retiro' : 'Envío';
              return <tr key={order.id}>
                <td><strong>#{order.order_number}</strong></td>
                <td>{new Date(order.created_at).toLocaleDateString('es-UY')}</td>
                <td>{orderCustomer(order.customer_snapshot)}</td>
                <td className="order-items-cell">{order.order_items.map(item=>item.title).join(' · ') || 'Sin artículos'}</td>
                <td>{destination}</td>
                <td><span className={`status-badge status-${order.status}`}>{orderStatus(order.status)}</span></td>
                <td className="numeric"><strong>{money(order.total_minor)}</strong></td>
                <td>{order.status==='paid_pending_review'
                  ? <div className="row-actions"><button className="compact-button" disabled={busy===order.id} onClick={()=>void review(order.id,'approve')}>{busy===order.id?'Procesando…':'Aprobar'}</button><button className="compact-button danger" disabled={busy===order.id} onClick={()=>void review(order.id,'reject')}>Rechazar</button></div>
                  : <small>Sin acciones</small>}</td>
              </tr>;
            })}
            {!orders.length && <tr><td className="empty-table" colSpan={8}>Todavía no hay pedidos.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Shipping({onNotice}:{onNotice:(v:string)=>void}){const[rates,setRates]=useState<Rate[]>([]);const[form,setForm]=useState({code:'',name:'',rate:'',departments:''});const load=useCallback(async()=>{const{data}=await supabase.from('shipping_rates').select('*').order('is_pickup',{ascending:false});setRates((data||[]) as Rate[])},[]);useEffect(()=>{void load()},[load]);return <section className="panel"><table><thead><tr><th>Zona</th><th>Departamentos</th><th>Tarifa</th><th>Estado</th></tr></thead><tbody>{rates.map(r=><tr key={r.id}><td>{r.name}</td><td>{r.is_pickup?'Retiro':r.departments.join(', ')}</td><td>{money(r.rate_minor)}</td><td>{r.active?'Activa':'Inactiva'}</td></tr>)}</tbody></table><form className="form-grid" onSubmit={async e=>{e.preventDefault();const{error}=await supabase.from('shipping_rates').insert({code:form.code,name:form.name,rate_minor:Math.round(Number(form.rate)*100),departments:form.departments.split(',').map(v=>v.trim()).filter(Boolean),is_pickup:false,active:true});onNotice(error?error.message:'Zona creada.');if(!error){setForm({code:'',name:'',rate:'',departments:''});await load()}}}><h4>Nueva zona nacional</h4><label>Código<input required value={form.code} onChange={e=>setForm({...form,code:e.target.value})}/></label><label>Nombre<input required value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label><label>Tarifa UYU<input required type="number" min="0" value={form.rate} onChange={e=>setForm({...form,rate:e.target.value})}/></label><label>Departamentos, separados por coma<input required value={form.departments} onChange={e=>setForm({...form,departments:e.target.value})}/></label><button>Crear zona</button></form></section>}

function Settings({onNotice}:{onNotice:(v:string)=>void}){const[value,setValue]=useState<Record<string,boolean|number>|null>(null);const load=useCallback(async()=>{const{data}=await supabase.from('commerce_settings').select('*').eq('singleton',true).single();setValue(data)},[]);useEffect(()=>{void load()},[load]);if(!value)return <p>Cargando…</p>;const save=async(next:Record<string,boolean|number>)=>{const{error}=await supabase.from('commerce_settings').update(next).eq('singleton',true);onNotice(error?error.message:'Configuración guardada.');if(!error)setValue({...value,...next})};return <section className="panel settings"><div className="warning"><strong>Salida controlada</strong><p>Mercado Pago y el comercio permanecen apagados hasta cerrar sandbox, credenciales y catálogo. La comisión requiere aprobación legal independiente.</p></div>{[['commerce_enabled','Habilitar comercio'],['mercado_pago_enabled','Habilitar Mercado Pago'],['payment_fee_legal_approval','Aprobación escrita de comisión'],['payment_fee_enabled','Cobrar comisión separada']].map(([key,label])=><label className="toggle" key={key}><span>{label}</span><input type="checkbox" checked={Boolean(value[key])} onChange={e=>void save({[key]:e.target.checked})}/></label>)}</section>}
