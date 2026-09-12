import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CatalogAttributeDataType, CatalogAttributeInputStyle, CatalogAttributeScope, CatalogTaxonomy } from '../../shared/catalog-taxonomy';
import { supabase } from './supabase';
import { loadCatalogTaxonomy, normalizeTaxonomyCode } from './catalogTaxonomy';

type Props = { onNotice: (value: string) => void };

export function TaxonomyManager({ onNotice }: Props) {
  const [taxonomy, setTaxonomy] = useState<CatalogTaxonomy | null>(null);
  const [selectedAttribute, setSelectedAttribute] = useState('color');
  const [categoryForm, setCategoryForm] = useState({ code: '', label: '', parent: '', order: '90' });
  const [attributeForm, setAttributeForm] = useState({ code: '', label: '', dataType: 'enum' as CatalogAttributeDataType, inputStyle: 'select' as CatalogAttributeInputStyle, unit: '' });
  const [optionForm, setOptionForm] = useState({ code: '', label: '', swatch: '', order: '100' });
  const [ruleForm, setRuleForm] = useState({ category: '', attribute: '', scope: 'product' as CatalogAttributeScope, required: false, filterable: true, order: '100' });

  const load = useCallback(async () => setTaxonomy(await loadCatalogTaxonomy(true)), []);
  useEffect(() => { void load(); }, [load]);

  const selectedOptions = useMemo(() => (taxonomy?.options ?? [])
    .filter(item => item.attribute_code === selectedAttribute)
    .sort((a, b) => a.sort_order - b.sort_order), [taxonomy, selectedAttribute]);
  const selectedDefinition = taxonomy?.attributes.find(item=>item.code===selectedAttribute);

  const saveRow = async (table: string, match: Record<string, string>, changes: Record<string, unknown>) => {
    let query = supabase.from(table).update(changes);
    Object.entries(match).forEach(([key, value]) => { query = query.eq(key, value); });
    const { error } = await query;
    onNotice(error ? error.message : 'Taxonomía actualizada.');
    if (!error) await load();
  };

  if (!taxonomy) return <p className="loading-inline">Cargando taxonomía…</p>;

  return <section className="taxonomy-manager" aria-labelledby="taxonomy-title">
    <header><p className="eyebrow">Fuente de verdad del catálogo</p><h2 id="taxonomy-title">Categorías y atributos</h2><p>Los códigos no cambian una vez utilizados. Desactivá los elementos que ya no deban mostrarse.</p></header>

    <section className="taxonomy-block">
      <h3>Familias y subcategorías</h3>
      <div className="table-scroll"><table><thead><tr><th>Código</th><th>Nombre</th><th>Familia superior</th><th>Orden</th><th>Activa</th></tr></thead><tbody>
        {taxonomy.categories.map(category => <tr key={category.code}>
          <td><code>{category.code}</code></td>
          <td><input aria-label={`Nombre de ${category.code}`} value={category.label_es} onChange={event => setTaxonomy({...taxonomy,categories:taxonomy.categories.map(item=>item.code===category.code?{...item,label_es:event.target.value}:item)})} onBlur={()=>void saveRow('commerce_categories',{code:category.code},{label_es:category.label_es})}/></td>
          <td><select value={category.parent_code ?? ''} onChange={event=>void saveRow('commerce_categories',{code:category.code},{parent_code:event.target.value||null})}><option value="">— Familia principal —</option>{taxonomy.categories.filter(item=>item.code!==category.code&&!item.parent_code).map(item=><option key={item.code} value={item.code}>{item.label_es}</option>)}</select></td>
          <td><input type="number" value={category.sort_order} onChange={event=>setTaxonomy({...taxonomy,categories:taxonomy.categories.map(item=>item.code===category.code?{...item,sort_order:Number(event.target.value)}:item)})} onBlur={()=>void saveRow('commerce_categories',{code:category.code},{sort_order:category.sort_order})}/></td>
          <td><input type="checkbox" checked={category.active} onChange={event=>void saveRow('commerce_categories',{code:category.code},{active:event.target.checked})}/></td>
        </tr>)}</tbody></table></div>
      <form className="taxonomy-add-row" onSubmit={async event=>{event.preventDefault();const code=normalizeTaxonomyCode(categoryForm.code||categoryForm.label);const{error}=await supabase.from('commerce_categories').insert({code,label_es:categoryForm.label.trim(),parent_code:categoryForm.parent||null,sort_order:Number(categoryForm.order),active:true});onNotice(error?error.message:'Categoría creada.');if(!error){setCategoryForm({code:'',label:'',parent:'',order:'90'});await load()}}}>
        <label>Nombre<input required value={categoryForm.label} onChange={event=>setCategoryForm({...categoryForm,label:event.target.value})}/></label>
        <label>Código<input value={categoryForm.code} onChange={event=>setCategoryForm({...categoryForm,code:event.target.value})} placeholder="Se genera del nombre"/></label>
        <label>Familia superior<select value={categoryForm.parent} onChange={event=>setCategoryForm({...categoryForm,parent:event.target.value})}><option value="">Ninguna</option>{taxonomy.categories.filter(item=>!item.parent_code).map(item=><option key={item.code} value={item.code}>{item.label_es}</option>)}</select></label>
        <label>Orden<input type="number" value={categoryForm.order} onChange={event=>setCategoryForm({...categoryForm,order:event.target.value})}/></label><button>Agregar categoría</button>
      </form>
    </section>

    <section className="taxonomy-block">
      <h3>Atributos</h3>
      <div className="taxonomy-columns"><div className="taxonomy-list">{[...taxonomy.attributes].sort((a,b)=>a.sort_order-b.sort_order||a.label_es.localeCompare(b.label_es,'es')).map(attribute=><button type="button" key={attribute.code} className={selectedAttribute===attribute.code?'selected':''} onClick={()=>setSelectedAttribute(attribute.code)}><strong>{attribute.label_es}</strong><small>{attribute.code} · {attribute.data_type}{attribute.active?'':' · inactivo'}</small></button>)}</div>
      <div><h4>Opciones de {selectedDefinition?.label_es}</h4>{selectedDefinition&&<div className="taxonomy-attribute-controls"><label>Nombre<input value={selectedDefinition.label_es} onChange={event=>setTaxonomy({...taxonomy,attributes:taxonomy.attributes.map(item=>item.code===selectedDefinition.code?{...item,label_es:event.target.value}:item)})} onBlur={()=>void saveRow('commerce_attribute_definitions',{code:selectedDefinition.code},{label_es:selectedDefinition.label_es})}/></label><label>Orden<input type="number" value={selectedDefinition.sort_order} onChange={event=>setTaxonomy({...taxonomy,attributes:taxonomy.attributes.map(item=>item.code===selectedDefinition.code?{...item,sort_order:Number(event.target.value)}:item)})} onBlur={()=>void saveRow('commerce_attribute_definitions',{code:selectedDefinition.code},{sort_order:selectedDefinition.sort_order})}/></label><label className="inline-check"><input type="checkbox" checked={selectedDefinition.active} onChange={event=>void saveRow('commerce_attribute_definitions',{code:selectedDefinition.code},{active:event.target.checked})}/> Activo</label></div>}<div className="taxonomy-option-list">{selectedOptions.map(item=><div key={item.code}><code>{item.code}</code><input aria-label={`Nombre de ${item.code}`} value={item.label_es} onChange={event=>setTaxonomy({...taxonomy,options:taxonomy.options.map(option=>option.attribute_code===item.attribute_code&&option.code===item.code?{...option,label_es:event.target.value}:option)})} onBlur={()=>void saveRow('commerce_attribute_options',{attribute_code:item.attribute_code,code:item.code},{label_es:item.label_es})}/><input className="taxonomy-order" type="number" aria-label={`Orden de ${item.label_es}`} value={item.sort_order} onChange={event=>setTaxonomy({...taxonomy,options:taxonomy.options.map(option=>option.attribute_code===item.attribute_code&&option.code===item.code?{...option,sort_order:Number(event.target.value)}:option)})} onBlur={()=>void saveRow('commerce_attribute_options',{attribute_code:item.attribute_code,code:item.code},{sort_order:item.sort_order})}/>{selectedAttribute==='color'&&<input type="color" aria-label={`Muestra de ${item.label_es}`} value={item.swatch_hex||'#cccccc'} onChange={event=>void saveRow('commerce_attribute_options',{attribute_code:item.attribute_code,code:item.code},{swatch_hex:event.target.value})}/>}<label className="inline-check"><input type="checkbox" checked={item.active} onChange={event=>void saveRow('commerce_attribute_options',{attribute_code:item.attribute_code,code:item.code},{active:event.target.checked})}/> Activa</label></div>)}</div>
        <form className="taxonomy-add-row" onSubmit={async event=>{event.preventDefault();const code=normalizeTaxonomyCode(optionForm.code||optionForm.label);const{error}=await supabase.from('commerce_attribute_options').insert({attribute_code:selectedAttribute,code,label_es:optionForm.label.trim(),swatch_hex:optionForm.swatch||null,sort_order:Number(optionForm.order),active:true});onNotice(error?error.message:'Opción creada.');if(!error){setOptionForm({code:'',label:'',swatch:'',order:'100'});await load()}}}><label>Nombre<input required value={optionForm.label} onChange={event=>setOptionForm({...optionForm,label:event.target.value})}/></label><label>Código<input value={optionForm.code} onChange={event=>setOptionForm({...optionForm,code:event.target.value})}/></label>{selectedAttribute==='color'&&<label>Color<input type="color" value={optionForm.swatch||'#cccccc'} onChange={event=>setOptionForm({...optionForm,swatch:event.target.value})}/></label>}<button>Agregar opción</button></form>
      </div></div>
      <form className="taxonomy-add-row" onSubmit={async event=>{event.preventDefault();const code=normalizeTaxonomyCode(attributeForm.code||attributeForm.label);const{error}=await supabase.from('commerce_attribute_definitions').insert({code,label_es:attributeForm.label.trim(),data_type:attributeForm.dataType,input_style:attributeForm.inputStyle,unit:attributeForm.unit.trim()||null,active:true});onNotice(error?error.message:'Atributo creado.');if(!error){setSelectedAttribute(code);setAttributeForm({code:'',label:'',dataType:'enum',inputStyle:'select',unit:''});await load()}}}>
        <label>Nombre<input required value={attributeForm.label} onChange={event=>setAttributeForm({...attributeForm,label:event.target.value})}/></label><label>Código<input value={attributeForm.code} onChange={event=>setAttributeForm({...attributeForm,code:event.target.value})}/></label><label>Tipo<select value={attributeForm.dataType} onChange={event=>setAttributeForm({...attributeForm,dataType:event.target.value as CatalogAttributeDataType})}><option value="enum">Lista</option><option value="number">Número</option><option value="boolean">Sí/No</option><option value="text">Texto</option></select></label><label>Unidad<input value={attributeForm.unit} onChange={event=>setAttributeForm({...attributeForm,unit:event.target.value})} placeholder="mm, ml…"/></label><button>Agregar atributo</button>
      </form>
    </section>

    <section className="taxonomy-block"><h3>Reglas por categoría</h3><div className="table-scroll"><table><thead><tr><th>Categoría</th><th>Atributo</th><th>Uso</th><th>Obligatorio</th><th>Filtro</th><th></th></tr></thead><tbody>{taxonomy.rules.map(item=><tr key={`${item.category_code}-${item.attribute_code}-${item.scope}`}><td>{taxonomy.categories.find(category=>category.code===item.category_code)?.label_es}</td><td>{taxonomy.attributes.find(attribute=>attribute.code===item.attribute_code)?.label_es}</td><td>{item.scope==='product'?'Producto':'Variante'}</td><td>{item.required?'Sí':'No'}</td><td>{item.filterable?'Sí':'No'}</td><td><button type="button" className="compact-button danger-button" onClick={async()=>{const{error}=await supabase.from('commerce_category_attributes').delete().eq('category_code',item.category_code).eq('attribute_code',item.attribute_code).eq('scope',item.scope);onNotice(error?error.message:'Regla eliminada.');if(!error)await load()}}>Quitar</button></td></tr>)}</tbody></table></div>
      <form className="taxonomy-add-row" onSubmit={async event=>{event.preventDefault();const{error}=await supabase.from('commerce_category_attributes').upsert({category_code:ruleForm.category,attribute_code:ruleForm.attribute,scope:ruleForm.scope,required:ruleForm.required,filterable:ruleForm.filterable,sort_order:Number(ruleForm.order)});onNotice(error?error.message:'Regla guardada.');if(!error)await load()}}><label>Categoría<select required value={ruleForm.category} onChange={event=>setRuleForm({...ruleForm,category:event.target.value})}><option value="">Elegí…</option>{taxonomy.categories.map(item=><option key={item.code} value={item.code}>{item.label_es}</option>)}</select></label><label>Atributo<select required value={ruleForm.attribute} onChange={event=>setRuleForm({...ruleForm,attribute:event.target.value})}><option value="">Elegí…</option>{taxonomy.attributes.map(item=><option key={item.code} value={item.code}>{item.label_es}</option>)}</select></label><label>Uso<select value={ruleForm.scope} onChange={event=>setRuleForm({...ruleForm,scope:event.target.value as CatalogAttributeScope})}><option value="product">Producto</option><option value="variant">Variante</option></select></label><label className="inline-check"><input type="checkbox" checked={ruleForm.required} onChange={event=>setRuleForm({...ruleForm,required:event.target.checked})}/> Obligatorio</label><label className="inline-check"><input type="checkbox" checked={ruleForm.filterable} onChange={event=>setRuleForm({...ruleForm,filterable:event.target.checked})}/> Filtro</label><button>Guardar regla</button></form>
    </section>
  </section>;
}
