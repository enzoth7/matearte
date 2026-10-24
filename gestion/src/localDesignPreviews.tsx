import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { domToBlob } from 'modern-screenshot';
import { ConfiguratorPreview } from '../../visualizador/src/components/ConfiguratorPreview';
import { FlatFlejePreview } from '../../visualizador/src/components/FlatFlejePreview';
import { commerceSource } from './commerceSource';

type Snapshot = any;
export function SavedDesignViews({ snapshot, exporting = false }: { snapshot: Snapshot; exporting?: boolean }) {
  const c = snapshot.configuration;
  if (!c?.rim) return null;
  const model = snapshot.assembly?.selections?.['tipo-mate'] || c.modelId || 'camionero';
  return <div className={exporting ? "customer-assets" : "local-production-views"}>
    {c.capabilities?.hasRim !== false && <section className="customer-asset local-production-rim"><h4>Virola</h4><div data-local-preview="virola" style={exporting ? {width:600,height:600,background:"#fbf3de"} : undefined}><ConfiguratorPreview model={model} rim={c.rim} engravingTypeId={c.engravingTypeId} /></div></section>}
    {c.capabilities?.hasFleje && snapshot.flejeConfiguration && (['front','back'] as const).map(side => <section className="customer-asset local-production-fleje" key={side}><h4>{side === 'front' ? 'Fleje · frente' : 'Fleje · reverso'}</h4><div data-local-preview={`fleje_${side}`} style={exporting ? {width:900,background:"#fbf3de"} : undefined}><FlatFlejePreview flejeConfig={snapshot.flejeConfiguration} activeSide={side} visibleSides={[side]} showLabels={false} /></div></section>)}
  </div>;
}
async function resolveImages(snapshot: Snapshot) {
  const copy = structuredClone(snapshot);
  const visit = async (value: any): Promise<void> => {
    if (!value || typeof value !== 'object') return;
    for (const key of Object.keys(value)) {
      if (typeof value[key] === 'string' && value[key].startsWith('storage:')) {
        const [,bucket,...parts] = value[key].split(':');
        const {data,error} = await commerceSource!.storage.from(bucket).createSignedUrl(parts.join(':'),3600);
        if (error || !data) throw new Error('No se pudo cargar una imagen del diseño.');
        value[key]=data.signedUrl;
      } else await visit(value[key]);
    }
  };
  await visit(copy); return copy;
}
export function RecoveredDesignViews({snapshot}:{snapshot:Snapshot}) {
  const [resolved,setResolved]=useState<Snapshot>(null);
  const [error,setError]=useState('');
  useEffect(()=>{let active=true; resolveImages(snapshot).then(value=>{if(active)setResolved(value)}).catch(()=>{if(active)setError('No se pudieron cargar las imágenes del diseño.')});return()=>{active=false}},[snapshot]);
  return resolved ? <SavedDesignViews snapshot={resolved}/> : <p>{error || 'Cargando diseño guardado…'}</p>;
}
export async function captureLocalDesign(snapshot: Snapshot) {
  if (!snapshot.configuration?.rim) return [];
  const resolved = await resolveImages(snapshot);
  const host=document.createElement('div');
  host.style.cssText='position:fixed;left:-20000px;top:0;width:1000px';
  document.body.append(host); const root=createRoot(host);
  try {
    flushSync(()=>root.render(<SavedDesignViews snapshot={resolved} exporting/>));
    await document.fonts.ready;
    await Promise.all(Array.from(host.querySelectorAll('img')).map(img=>img.decode()));
    const result=[];
    for (const target of host.querySelectorAll<HTMLElement>('[data-local-preview]')) {
      const blob=await domToBlob(target,{scale:2,backgroundColor:'#fbf3de'});
      if (!blob || !blob.size) throw new Error('No se pudo generar la imagen del diseño.');
      result.push({role:target.dataset.localPreview!,blob});
    }
    return result;
  } finally {root.unmount();host.remove()}
}
