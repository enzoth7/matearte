import { useCallback, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

type Tab = 'catalog' | 'orders' | 'shipping' | 'settings';
type ProductImage = { id:string;storage_path:string;original_name:string;alt_text:string;mime_type:string;byte_size:number;sort_order:number };
type Product = { id:string; editorial_slug:string; name:string; category:string; sale_mode:'standard'|'made_to_order'; published:boolean; commerce_variants:Array<{id:string;sku:string;name:string;price_minor:number;weight_grams:number|null;inventory_tracked:boolean;stock_on_hand:number;stock_reserved:number;active:boolean}>; commerce_product_images:ProductImage[] };
type Order = { id:string;order_number:number;status:string;shipping_method:string;shipping_snapshot:Record<string,unknown>;total_minor:number;created_at:string;customer_snapshot:Record<string,unknown>;order_items:Array<{id:string;title:string;requires_review:boolean;review_status:string|null}> };
type Rate = {id:string;code:string;name:string;departments:string[];rate_minor:number;is_pickup:boolean;active:boolean};
const money=(minor:number)=>new Intl.NumberFormat('es-UY',{style:'currency',currency:'UYU',maximumFractionDigits:0}).format(minor/100);
const MAX_PRODUCT_IMAGE_BYTES = 5 * 1024 * 1024;
const PRODUCT_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const productImageUrl = (path:string) => supabase.storage.from('product-images').getPublicUrl(path).data.publicUrl;
const fileExtension = (file:File) => file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || (file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg');

function Login({onSession}:{onSession:(session:Session)=>void}){const[email,setEmail]=useState('');const[password,setPassword]=useState('');const[error,setError]=useState('');const[busy,setBusy]=useState(false);return <main className="login"><form onSubmit={async e=>{e.preventDefault();setBusy(true);setError('');const{data,error}=await supabase.auth.signInWithPassword({email,password});setBusy(false);if(error)setError(error.message);else if(data.session)onSession(data.session)}}><p className="eyebrow">Administración segura</p><h1>Comercio MateArte</h1><p>Acceso limitado a membresías guardadas en la base de datos.</p>{error&&<div className="error">{error}</div>}<label>Correo<input type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)}/></label><label>Contraseña<input type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)}/></label><button disabled={busy}>{busy?'Ingresando…':'Ingresar'}</button></form></main>}

export function App(){const[session,setSession]=useState<Session|null>(null);const[authorized,setAuthorized]=useState<boolean|null>(null);const[tab,setTab]=useState<Tab>('catalog');const[notice,setNotice]=useState('');
 useEffect(()=>{supabase.auth.getSession().then(({data})=>setSession(data.session));const{data}=supabase.auth.onAuthStateChange((_e,next)=>setSession(next));return()=>data.subscription.unsubscribe()},[]);
 useEffect(()=>{if(!session){setAuthorized(null);return}supabase.from('commerce_admin_users').select('user_id').eq('user_id',session.user.id).eq('active',true).maybeSingle().then(({data})=>setAuthorized(Boolean(data)))},[session]);
 if(!session)return <Login onSession={setSession}/>;if(authorized===null)return <p className="loading">Verificando membresía…</p>;if(!authorized)return <main className="denied"><h1>Acceso denegado</h1><p>La cuenta está autenticada, pero no integra commerce_admin_users.</p><button onClick={()=>supabase.auth.signOut()}>Cerrar sesión</button></main>;
 return <div className="shell"><aside><div><p className="eyebrow">MateArte</p><h1>Comercio</h1></div><nav>{([['catalog','Catálogo'],['orders','Pedidos'],['shipping','Envíos'],['settings','Activación']] as const).map(([id,label])=><button key={id} className={tab===id?'active':''} onClick={()=>setTab(id)}>{label}</button>)}</nav><button className="logout" onClick={()=>supabase.auth.signOut({scope:'local'})}>Cerrar sesión</button></aside><main><header><div><p className="eyebrow">Panel separado</p><h2>{tab==='catalog'?'Catálogo y stock':tab==='orders'?'Pedidos y personalizados':tab==='shipping'?'Zonas y tarifas':'Controles de salida'}</h2></div><span>{session.user.email}</span></header>{notice&&<div className="notice" role="status">{notice}</div>}{tab==='catalog'&&<Catalog onNotice={setNotice}/>} {tab==='orders'&&<Orders session={session} onNotice={setNotice}/>} {tab==='shipping'&&<Shipping onNotice={setNotice}/>} {tab==='settings'&&<Settings onNotice={setNotice}/>}</main></div>}

function Catalog({onNotice}:{onNotice:(v:string)=>void}) {
  const [products,setProducts] = useState<Product[]>([]);
  const [selected,setSelected] = useState('');
  const [imageBusy,setImageBusy] = useState('');
  const [variant,setVariant] = useState({sku:'',name:'Única',price:'',weight:'',stock:'0',tracked:true});

  const load = useCallback(async() => {
    const {data,error} = await supabase
      .from('commerce_products')
      .select('id,editorial_slug,name,category,sale_mode,published,commerce_variants(id,sku,name,price_minor,weight_grams,inventory_tracked,stock_on_hand,stock_reserved,active),commerce_product_images(id,storage_path,original_name,alt_text,mime_type,byte_size,sort_order)')
      .order('name');
    if (error) {
      onNotice(error.message);
      return;
    }
    setProducts((data || []) as Product[]);
    if (!selected && data?.[0]) setSelected(data[0].id);
  },[onNotice,selected]);

  useEffect(() => { void load(); },[load]);
  const product = products.find(item => item.id === selected);
  const images = [...(product?.commerce_product_images || [])].sort((a,b) => a.sort_order - b.sort_order || a.original_name.localeCompare(b.original_name));

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

  const createVariant = async(e:React.FormEvent) => {
    e.preventDefault();
    if (!product) return;
    const {error} = await supabase.from('commerce_variants').insert({product_id:product.id,sku:variant.sku.trim(),name:variant.name.trim(),price_minor:Math.round(Number(variant.price)*100),weight_grams:variant.weight?Number(variant.weight):null,inventory_tracked:variant.tracked,stock_on_hand:Number(variant.stock),active:true});
    onNotice(error?error.message:'Variante creada.');
    if(!error){setVariant({sku:'',name:'Única',price:'',weight:'',stock:'0',tracked:true});await load()}
  };

  return (
    <section className="grid">
      <div className="list">
        {products.map(item => (
          <button key={item.id} className={item.id===selected?'selected':''} onClick={()=>setSelected(item.id)}>
            <strong>{item.name}</strong>
            <span>{item.published?'Publicado':'Incompleto'} · {item.commerce_variants.length} variantes · {item.commerce_product_images?.length || 0} fotos</span>
          </button>
        ))}
      </div>
      {product && (
        <div className="panel">
          <div className="panel-head">
            <div><p className="eyebrow">{product.editorial_slug}</p><h3>{product.name}</h3></div>
            <button onClick={async()=>{const{error}=await supabase.from('commerce_products').update({published:!product.published}).eq('id',product.id);onNotice(error?error.message:!product.published?'Producto publicado.':'Producto oculto.');await load()}}>{product.published?'Ocultar':'Publicar'}</button>
          </div>

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
                      <div><strong>{index === 0 ? 'Principal' : `Imagen ${index + 1}`}</strong><span title={image.original_name}>{image.original_name}</span></div>
                      <button className="image-delete" type="button" disabled={Boolean(imageBusy)} onClick={()=>void removeImage(image)} aria-label={`Eliminar ${image.original_name}`}>{imageBusy === image.id ? 'Eliminando…' : 'Eliminar'}</button>
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

          <table><thead><tr><th>SKU</th><th>Precio</th><th>Stock</th></tr></thead><tbody>{product.commerce_variants.map(v=><tr key={v.id}><td>{v.sku}<small>{v.name}</small></td><td>{money(v.price_minor)}</td><td>{v.inventory_tracked?`${v.stock_on_hand-v.stock_reserved} disp.`:'Por encargo'}</td></tr>)}</tbody></table>
          <form className="form-grid" onSubmit={createVariant}><h4>Nueva variante</h4><label>SKU<input required value={variant.sku} onChange={e=>setVariant({...variant,sku:e.target.value})}/></label><label>Nombre<input required value={variant.name} onChange={e=>setVariant({...variant,name:e.target.value})}/></label><label>Precio UYU<input required type="number" min="1" step="0.01" value={variant.price} onChange={e=>setVariant({...variant,price:e.target.value})}/></label><label>Peso (g)<input type="number" min="1" value={variant.weight} onChange={e=>setVariant({...variant,weight:e.target.value})}/></label><label>Stock<input type="number" min="0" value={variant.stock} onChange={e=>setVariant({...variant,stock:e.target.value})}/></label><label className="check"><input type="checkbox" checked={variant.tracked} onChange={e=>setVariant({...variant,tracked:e.target.checked})}/> Controlar stock</label><button>Crear variante</button></form>
        </div>
      )}
    </section>
  );
}

function Orders({session,onNotice}:{session:Session;onNotice:(v:string)=>void}){const[orders,setOrders]=useState<Order[]>([]);const[reason,setReason]=useState('');const load=useCallback(async()=>{const{data}=await supabase.from('orders').select('id,order_number,status,shipping_method,shipping_snapshot,total_minor,created_at,customer_snapshot,order_items(id,title,requires_review,review_status)').order('created_at',{ascending:false}).limit(100);setOrders((data||[]) as Order[])},[]);useEffect(()=>{void load()},[load]);const review=async(id:string,decision:'approve'|'reject')=>{const storeApi=(import.meta.env.VITE_STORE_API_URL||'http://localhost:3000').trim().replace(/\/$/,'');const response=await fetch(`${storeApi}/api/admin/orders/${id}/review`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.access_token}`},body:JSON.stringify({decision,reason})});const value=await response.json();onNotice(response.ok?'Pedido actualizado.':value.error||'No se pudo actualizar.');if(response.ok){setReason('');await load()}};return <section className="cards">{orders.map(order=><article key={order.id}><div className="panel-head"><div><p className="eyebrow">#{order.order_number}</p><h3>{money(order.total_minor)}</h3></div><span className="status">{order.shipping_method==='international_coordination'?'Coordinación exterior':order.status}</span></div><p>{new Date(order.created_at).toLocaleString('es-UY')}</p>{order.shipping_method==='international_coordination'&&<p><strong>Destino:</strong> {[order.shipping_snapshot?.city,order.shipping_snapshot?.country].filter(Boolean).join(', ')}</p>}<ul>{order.order_items.map(item=><li key={item.id}>{item.title}{item.requires_review?' · personalizado':''}</li>)}</ul>{order.status==='paid_pending_review'&&<div className="review"><textarea placeholder="Motivo obligatorio si rechazás" value={reason} onChange={e=>setReason(e.target.value)}/><div><button onClick={()=>void review(order.id,'approve')}>Aprobar producción</button><button className="danger" onClick={()=>void review(order.id,'reject')}>Rechazar y reembolsar</button></div></div>}</article>)}</section>}

function Shipping({onNotice}:{onNotice:(v:string)=>void}){const[rates,setRates]=useState<Rate[]>([]);const[form,setForm]=useState({code:'',name:'',rate:'',departments:''});const load=useCallback(async()=>{const{data}=await supabase.from('shipping_rates').select('*').order('is_pickup',{ascending:false});setRates((data||[]) as Rate[])},[]);useEffect(()=>{void load()},[load]);return <section className="panel"><table><thead><tr><th>Zona</th><th>Departamentos</th><th>Tarifa</th><th>Estado</th></tr></thead><tbody>{rates.map(r=><tr key={r.id}><td>{r.name}</td><td>{r.is_pickup?'Retiro':r.departments.join(', ')}</td><td>{money(r.rate_minor)}</td><td>{r.active?'Activa':'Inactiva'}</td></tr>)}</tbody></table><form className="form-grid" onSubmit={async e=>{e.preventDefault();const{error}=await supabase.from('shipping_rates').insert({code:form.code,name:form.name,rate_minor:Math.round(Number(form.rate)*100),departments:form.departments.split(',').map(v=>v.trim()).filter(Boolean),is_pickup:false,active:true});onNotice(error?error.message:'Zona creada.');if(!error){setForm({code:'',name:'',rate:'',departments:''});await load()}}}><h4>Nueva zona nacional</h4><label>Código<input required value={form.code} onChange={e=>setForm({...form,code:e.target.value})}/></label><label>Nombre<input required value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label><label>Tarifa UYU<input required type="number" min="0" value={form.rate} onChange={e=>setForm({...form,rate:e.target.value})}/></label><label>Departamentos, separados por coma<input required value={form.departments} onChange={e=>setForm({...form,departments:e.target.value})}/></label><button>Crear zona</button></form></section>}

function Settings({onNotice}:{onNotice:(v:string)=>void}){const[value,setValue]=useState<Record<string,boolean|number>|null>(null);const load=useCallback(async()=>{const{data}=await supabase.from('commerce_settings').select('*').eq('singleton',true).single();setValue(data)},[]);useEffect(()=>{void load()},[load]);if(!value)return <p>Cargando…</p>;const save=async(next:Record<string,boolean|number>)=>{const{error}=await supabase.from('commerce_settings').update(next).eq('singleton',true);onNotice(error?error.message:'Configuración guardada.');if(!error)setValue({...value,...next})};return <section className="panel settings"><div className="warning"><strong>Salida controlada</strong><p>Mercado Pago y el comercio permanecen apagados hasta cerrar sandbox, credenciales y catálogo. La comisión requiere aprobación legal independiente.</p></div>{[['commerce_enabled','Habilitar comercio'],['mercado_pago_enabled','Habilitar Mercado Pago'],['payment_fee_legal_approval','Aprobación escrita de comisión'],['payment_fee_enabled','Cobrar comisión separada']].map(([key,label])=><label className="toggle" key={key}><span>{label}</span><input type="checkbox" checked={Boolean(value[key])} onChange={e=>void save({[key]:e.target.checked})}/></label>)}</section>}
