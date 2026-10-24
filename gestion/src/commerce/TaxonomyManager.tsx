import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import type {
  CatalogAttributeDataType, CatalogAttributeInputStyle, CatalogAttributeScope,
  CatalogCategoryDefinition, CatalogAttributeDefinition, CatalogAttributeOption, CatalogTaxonomy,
} from '../../../shared/catalog-taxonomy';
import { taxonomyRulesForCategory } from '../../../shared/catalog-taxonomy';
import { supabase } from './supabase';
import { loadCatalogTaxonomy, normalizeTaxonomyCode } from './catalogTaxonomy';

type Props = { onNotice: (value: string) => void };
type Section = 'categories' | 'attributes' | 'rules';
const typeLabel: Record<CatalogAttributeDataType, string> = {
  enum: 'Lista de opciones', number: 'Número', boolean: 'Sí o no', text: 'Texto',
};
const initialCategory = { code: '', label: '', parent: '', order: '90' };
const initialAttribute = { code: '', label: '', dataType: 'enum' as CatalogAttributeDataType, inputStyle: 'select' as CatalogAttributeInputStyle, unit: '' };
const initialOption = { code: '', label: '', swatch: '', order: '100' };
const initialRule = { attribute: '', required: false, filterable: true, purchaseSelectable: false, order: '100' };

export function TaxonomyManager({ onNotice }: Props) {
  const [taxonomy, setTaxonomy] = useState<CatalogTaxonomy | null>(null);
  const [section, setSection] = useState<Section>('categories');
  const [categoryCode, setCategoryCode] = useState('mates');
  const [attributeCode, setAttributeCode] = useState('color');
  const [ruleCategoryCode, setRuleCategoryCode] = useState('mates');
  const [categorySearch, setCategorySearch] = useState('');
  const [attributeSearch, setAttributeSearch] = useState('');
  const [optionSearch, setOptionSearch] = useState('');
  const [addCategory, setAddCategory] = useState(false);
  const [addAttribute, setAddAttribute] = useState(false);
  const [addOption, setAddOption] = useState(false);
  const [addRule, setAddRule] = useState(false);
  const [removeKey, setRemoveKey] = useState('');
  const [categoryForm, setCategoryForm] = useState(initialCategory);
  const [attributeForm, setAttributeForm] = useState(initialAttribute);
  const [optionForm, setOptionForm] = useState(initialOption);
  const [ruleForm, setRuleForm] = useState(initialRule);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try { setTaxonomy(await loadCatalogTaxonomy(true)); setError(''); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudieron cargar las categorías.'); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const categories = useMemo(() => [...(taxonomy?.categories ?? [])].sort((a, b) =>
    a.sort_order - b.sort_order || a.label_es.localeCompare(b.label_es, 'es')), [taxonomy]);
  const orderedCategories = useMemo(() => {
    const roots = categories.filter(item => !item.parent_code || !categories.some(parent => parent.code === item.parent_code));
    return roots.flatMap(item => [item, ...categories.filter(child => child.parent_code === item.code)]);
  }, [categories]);
  const attributes = useMemo(() => [...(taxonomy?.attributes ?? [])].sort((a, b) =>
    a.sort_order - b.sort_order || a.label_es.localeCompare(b.label_es, 'es')), [taxonomy]);
  const category = taxonomy?.categories.find(item => item.code === categoryCode) ?? categories[0];
  const attribute = taxonomy?.attributes.find(item => item.code === attributeCode) ?? attributes[0];
  const ruleCategory = taxonomy?.categories.find(item => item.code === ruleCategoryCode) ?? categories[0];
  const options = useMemo(() => [...(taxonomy?.options ?? [])].filter(item => item.attribute_code === attribute?.code)
    .sort((a, b) => a.sort_order - b.sort_order || a.label_es.localeCompare(b.label_es, 'es')), [taxonomy, attribute?.code]);
  const visibleOptions = options.filter(item => (item.label_es + ' ' + item.code).toLocaleLowerCase('es-UY').includes(optionSearch.toLocaleLowerCase('es-UY')));
  const visibleCategories = orderedCategories.filter(item => (item.label_es + ' ' + item.code).toLocaleLowerCase('es-UY').includes(categorySearch.toLocaleLowerCase('es-UY')));
  const visibleAttributes = attributes.filter(item => (item.label_es + ' ' + item.code).toLocaleLowerCase('es-UY').includes(attributeSearch.toLocaleLowerCase('es-UY')));
  const rules = [...(taxonomy?.rules ?? [])].filter(item => item.category_code === ruleCategory?.code).sort((a, b) => a.sort_order - b.sort_order);
  const inheritedRules = ruleCategory?.parent_code && taxonomy
    ? taxonomyRulesForCategory(taxonomy, ruleCategory.code).filter(item => item.category_code !== ruleCategory.code)
    : [];

  const patchCategory = (code: string, changes: Partial<CatalogCategoryDefinition>) =>
    setTaxonomy(current => current ? { ...current, categories: current.categories.map(item => item.code === code ? { ...item, ...changes } : item) } : current);
  const patchAttribute = (code: string, changes: Partial<CatalogAttributeDefinition>) =>
    setTaxonomy(current => current ? { ...current, attributes: current.attributes.map(item => item.code === code ? { ...item, ...changes } : item) } : current);
  const patchOption = (attributeCode: string, code: string, changes: Partial<CatalogAttributeOption>) =>
    setTaxonomy(current => current ? { ...current, options: current.options.map(item => item.attribute_code === attributeCode && item.code === code ? { ...item, ...changes } : item) } : current);
  const saveRow = async (table: string, match: Record<string, string>, changes: Record<string, unknown>) => {
    let query = supabase.from(table).update(changes);
    Object.entries(match).forEach(([key, value]) => { query = query.eq(key, value); });
    const { error: saveError } = await query;
    onNotice(saveError ? saveError.message : 'Cambios guardados.');
    await load();
  };
  const createCategory = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const code = normalizeTaxonomyCode(categoryForm.code || categoryForm.label);
    const { error: createError } = await supabase.from('commerce_categories').insert({
      code, label_es: categoryForm.label.trim(), parent_code: categoryForm.parent || null,
      sort_order: Number(categoryForm.order), active: true,
    });
    onNotice(createError ? createError.message : 'Categoría creada.');
    if (!createError) { setCategoryCode(code); setCategoryForm(initialCategory); setAddCategory(false); await load(); }
  };
  const createAttribute = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const code = normalizeTaxonomyCode(attributeForm.code || attributeForm.label);
    const { error: createError } = await supabase.from('commerce_attribute_definitions').insert({
      code, label_es: attributeForm.label.trim(), data_type: attributeForm.dataType,
      input_style: attributeForm.inputStyle, unit: attributeForm.unit.trim() || null, active: true,
    });
    onNotice(createError ? createError.message : 'Atributo creado.');
    if (!createError) { setAttributeCode(code); setAttributeForm(initialAttribute); setAddAttribute(false); await load(); }
  };
  const createOption = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!attribute) return;
    const code = normalizeTaxonomyCode(optionForm.code || optionForm.label);
    const { error: createError } = await supabase.from('commerce_attribute_options').insert({
      attribute_code: attribute.code, code, label_es: optionForm.label.trim(),
      swatch_hex: attribute.code === 'color' ? optionForm.swatch || null : null,
      sort_order: Number(optionForm.order), active: true,
    });
    onNotice(createError ? createError.message : 'Opción creada.');
    if (!createError) { setOptionForm(initialOption); setAddOption(false); setOptionSearch(''); await load(); }
  };
  const createRule = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!ruleCategory) return;
    const scope: CatalogAttributeScope = ruleForm.attribute === 'color' ? 'variant' : 'product';
    const { error: createError } = await supabase.from('commerce_category_attributes').upsert({
      category_code: ruleCategory.code, attribute_code: ruleForm.attribute, scope,
      required: ruleForm.required, filterable: ruleForm.filterable,
      purchase_selectable: scope === 'product' && ruleForm.purchaseSelectable,
      sort_order: Number(ruleForm.order),
    });
    onNotice(createError ? createError.message : 'Regla guardada.');
    if (!createError) { setRuleForm(initialRule); setAddRule(false); await load(); }
  };

  if (error) return <div className="taxonomy-error" role="alert">{error}<button type="button" onClick={() => void load()}>Reintentar</button></div>;
  if (!taxonomy) return <div className="loading-inline">Cargando taxonomía…</div>;

  return <section className="taxonomy-manager" aria-labelledby="taxonomy-title">
    <header className="taxonomy-intro">
      <h2 id="taxonomy-title">Organizá tu catálogo</h2>
      <div>Organizá los productos, definí sus opciones y elegí qué datos se piden en cada categoría.</div>
    </header>
    <nav className="taxonomy-nav" aria-label="Organización del catálogo">
      {([
        ['categories', 'Categorías', 'Familias y subcategorías', taxonomy.categories.length],
        ['attributes', 'Atributos y opciones', 'Colores, materiales y más', taxonomy.attributes.length],
        ['rules', 'Reglas por categoría', 'Datos para cada producto', taxonomy.rules.length],
      ] as const).map(([id, title, description, count]) =>
        <button key={id} type="button" aria-current={section === id ? 'page' : undefined} onClick={() => setSection(id)}>
          <strong>{title}</strong><small>{description}</small><em>{count}</em>
        </button>)}
    </nav>

    {section === 'categories' && <section className="taxonomy-workspace" aria-labelledby="taxonomy-categories-title">
      <div className="taxonomy-section-head">
        <div><h3 id="taxonomy-categories-title">Familias y subcategorías</h3><div>Las familias reúnen productos; las subcategorías van dentro de una familia.</div></div>
        <button type="button" className="taxonomy-primary" onClick={() => setAddCategory(value => !value)}>{addCategory ? 'Cancelar' : '+ Agregar categoría'}</button>
      </div>
      {addCategory && <form className="taxonomy-create" onSubmit={createCategory}>
        <h4>Nueva categoría</h4>
        <div className="taxonomy-form-grid">
          <label>Nombre<input required autoFocus value={categoryForm.label} onChange={event => setCategoryForm({ ...categoryForm, label: event.target.value })} placeholder="Ej.: Accesorios" /></label>
          <label>Ubicación<select value={categoryForm.parent} onChange={event => setCategoryForm({ ...categoryForm, parent: event.target.value })}><option value="">Familia principal</option>{categories.filter(item => !item.parent_code).map(item => <option key={item.code} value={item.code}>Dentro de {item.label_es}</option>)}</select></label>
        </div>
        <details className="taxonomy-advanced"><summary>Opciones avanzadas</summary><div className="taxonomy-form-grid"><label>Código interno<input value={categoryForm.code} onChange={event => setCategoryForm({ ...categoryForm, code: event.target.value })} placeholder="Se genera del nombre" /></label><label>Orden<input type="number" value={categoryForm.order} onChange={event => setCategoryForm({ ...categoryForm, order: event.target.value })} /></label></div></details>
        <div className="taxonomy-create-actions"><button type="submit" className="taxonomy-primary">Crear categoría</button></div>
      </form>}
      <div className="taxonomy-split">
        <aside className="taxonomy-rail" aria-label="Lista de categorías">
          <label className="taxonomy-search">Buscar categoría<input type="search" value={categorySearch} onChange={event => setCategorySearch(event.target.value)} placeholder="Nombre o código" /></label>
          <div className="taxonomy-rail-list">
            {visibleCategories.map(item => <button key={item.code} type="button" className={item.parent_code ? 'is-child' : ''} aria-pressed={category?.code === item.code} onClick={() => { setCategoryCode(item.code); setRuleCategoryCode(item.code); }}>
              <strong>{item.label_es}</strong><small>{item.parent_code ? 'Subcategoría' : 'Familia principal'}{item.active ? '' : ' · Inactiva'}</small>
            </button>)}
            {!visibleCategories.length && <div className="taxonomy-empty">No hay categorías con ese nombre.</div>}
          </div>
        </aside>
        {category && <div className="taxonomy-detail">
          <div className="taxonomy-detail-head"><div><small>{category.parent_code ? 'Subcategoría' : 'Familia principal'}</small><h4>{category.label_es}</h4></div><div className={category.active ? 'taxonomy-status' : 'taxonomy-status is-inactive'}>{category.active ? 'Activa' : 'Inactiva'}</div></div>
          <div className="taxonomy-help">El nombre se muestra al organizar los productos. Cambiar la ubicación mueve esta categoría dentro de otra familia.</div>
          <div className="taxonomy-form-grid">
            <label>Nombre visible<input aria-label={'Nombre de ' + category.code} value={category.label_es} onChange={event => patchCategory(category.code, { label_es: event.target.value })} onBlur={() => void saveRow('commerce_categories', { code: category.code }, { label_es: category.label_es })} /></label>
            <label>Ubicación<select value={category.parent_code ?? ''} onChange={event => void saveRow('commerce_categories', { code: category.code }, { parent_code: event.target.value || null })}><option value="">Familia principal</option>{categories.filter(item => item.code !== category.code && !item.parent_code).map(item => <option key={item.code} value={item.code}>Dentro de {item.label_es}</option>)}</select></label>
          </div>
          <div className="taxonomy-detail-bottom"><label className="taxonomy-toggle"><input type="checkbox" checked={category.active} onChange={event => void saveRow('commerce_categories', { code: category.code }, { active: event.target.checked })} /><span>Mostrar esta categoría</span></label><label className="taxonomy-order-field">Orden<input type="number" value={category.sort_order} onChange={event => patchCategory(category.code, { sort_order: Number(event.target.value) })} onBlur={() => void saveRow('commerce_categories', { code: category.code }, { sort_order: category.sort_order })} /></label></div>
          <div className="taxonomy-code">Código interno: <code>{category.code}</code></div>
        </div>}
      </div>
    </section>}

    {section === 'attributes' && <section className="taxonomy-workspace taxonomy-workspace--attributes" aria-labelledby="taxonomy-attributes-title">
      <div className="taxonomy-section-head"><div><h3 id="taxonomy-attributes-title">Atributos y opciones</h3><div>Un atributo es un dato del producto, como Color. Sus opciones son valores posibles, como Marrón o Negro.</div></div><button type="button" className="taxonomy-primary" onClick={() => setAddAttribute(value => !value)}>{addAttribute ? 'Cancelar' : '+ Agregar atributo'}</button></div>
      {addAttribute && <form className="taxonomy-create" onSubmit={createAttribute}>
        <h4>Nuevo atributo</h4><div className="taxonomy-form-grid"><label>Nombre<input required autoFocus value={attributeForm.label} onChange={event => setAttributeForm({ ...attributeForm, label: event.target.value })} placeholder="Ej.: Material" /></label><label>Tipo de dato<select value={attributeForm.dataType} onChange={event => { const dataType = event.target.value as CatalogAttributeDataType; setAttributeForm({ ...attributeForm, dataType, inputStyle: ({ enum: 'select', number: 'number', boolean: 'checkbox', text: 'text' } as const)[dataType] }); }}><option value="enum">Lista de opciones</option><option value="number">Número</option><option value="boolean">Sí o no</option><option value="text">Texto</option></select></label></div>
        {attributeForm.dataType === 'number' && <label>Unidad (opcional)<input value={attributeForm.unit} onChange={event => setAttributeForm({ ...attributeForm, unit: event.target.value })} placeholder="Ej.: mm, ml" /></label>}
        <details className="taxonomy-advanced"><summary>Opciones avanzadas</summary><label>Código interno<input value={attributeForm.code} onChange={event => setAttributeForm({ ...attributeForm, code: event.target.value })} placeholder="Se genera del nombre" /></label></details>
        <div className="taxonomy-create-actions"><button type="submit" className="taxonomy-primary">Crear atributo</button></div>
      </form>}
      <div className="taxonomy-split">
        <aside className="taxonomy-rail" aria-label="Lista de atributos"><label className="taxonomy-search">Buscar atributo<input type="search" value={attributeSearch} onChange={event => setAttributeSearch(event.target.value)} placeholder="Nombre o código" /></label><label className="taxonomy-attribute-picker">Atributo<select value={attribute?.code ?? ''} onChange={event => { setAttributeCode(event.target.value); setOptionSearch(''); setAddOption(false); }}>{attributes.map(item => <option key={item.code} value={item.code}>{item.label_es}{item.active ? '' : ' · Inactivo'}</option>)}</select></label><div className="taxonomy-rail-list">{visibleAttributes.map(item => <button key={item.code} type="button" aria-pressed={attribute?.code === item.code} onClick={() => { setAttributeCode(item.code); setOptionSearch(''); setAddOption(false); }}><strong>{item.label_es}</strong><small>{typeLabel[item.data_type]}{item.active ? '' : ' · Inactivo'}</small></button>)}{!visibleAttributes.length && <div className="taxonomy-empty">{attributes.length ? 'No hay atributos con ese nombre.' : 'Todavía no hay atributos.'}</div>}</div></aside>
        {attribute && <div className="taxonomy-detail">
          <div className="taxonomy-detail-head"><div><small>{typeLabel[attribute.data_type]}</small><h4>{attribute.label_es}</h4></div><div className={attribute.active ? 'taxonomy-status' : 'taxonomy-status is-inactive'}>{attribute.active ? 'Activo' : 'Inactivo'}</div></div>
          <div className="taxonomy-form-grid"><label>Nombre visible<input value={attribute.label_es} onChange={event => patchAttribute(attribute.code, { label_es: event.target.value })} onBlur={() => void saveRow('commerce_attribute_definitions', { code: attribute.code }, { label_es: attribute.label_es })} /></label><label className="taxonomy-order-field">Orden<input type="number" value={attribute.sort_order ?? 0} onChange={event => patchAttribute(attribute.code, { sort_order: Number(event.target.value) })} onBlur={() => void saveRow('commerce_attribute_definitions', { code: attribute.code }, { sort_order: attribute.sort_order })} /></label></div>
          <div className="taxonomy-detail-bottom"><label className="taxonomy-toggle"><input type="checkbox" checked={attribute.active} onChange={event => void saveRow('commerce_attribute_definitions', { code: attribute.code }, { active: event.target.checked })} /><span>Usar este atributo</span></label><div className="taxonomy-code">Código interno: <code>{attribute.code}</code></div></div>
          {attribute.data_type === 'enum' ? <div className="taxonomy-options">
            <div className="taxonomy-options-head"><div><h5>Opciones de {attribute.label_es}</h5><small>{options.length} valores · Tocá un valor para editarlo</small></div><button type="button" className="taxonomy-secondary" onClick={() => setAddOption(value => !value)}>{addOption ? 'Cancelar' : '+ Agregar opción'}</button></div>
            {addOption && <form className="taxonomy-create taxonomy-create--nested" onSubmit={createOption}><div className="taxonomy-form-grid"><label>Nombre de la opción<input required autoFocus value={optionForm.label} onChange={event => setOptionForm({ ...optionForm, label: event.target.value })} placeholder="Ej.: Negro" /></label>{attribute.code === 'color' && <label>Muestra de color<input type="color" value={optionForm.swatch || '#cccccc'} onChange={event => setOptionForm({ ...optionForm, swatch: event.target.value })} /></label>}</div><details className="taxonomy-advanced"><summary>Opciones avanzadas</summary><div className="taxonomy-form-grid"><label>Código interno<input value={optionForm.code} onChange={event => setOptionForm({ ...optionForm, code: event.target.value })} placeholder="Se genera del nombre" /></label><label>Orden<input type="number" value={optionForm.order} onChange={event => setOptionForm({ ...optionForm, order: event.target.value })} /></label></div></details><div className="taxonomy-create-actions"><button type="submit" className="taxonomy-primary">Crear opción</button></div></form>}
            {options.length > 8 && <label className="taxonomy-search">Buscar opción<input type="search" value={optionSearch} onChange={event => setOptionSearch(event.target.value)} placeholder="Nombre o código" /></label>}
            {visibleOptions.length > 0 && <div className={'taxonomy-option-header' + (attribute.code === 'color' ? ' has-swatch' : '')} aria-hidden="true">
              {attribute.code === 'color' && <div />}<div>Nombre</div><div>Orden</div><div>Visible</div>
            </div>}
            <div className="taxonomy-option-list">{visibleOptions.map(item => <div className="taxonomy-option-row" key={item.code}>
              {attribute.code === 'color' && <label className="taxonomy-swatch" style={{ background: item.swatch_hex || '#cccccc' }}><input type="color" aria-label={'Muestra de ' + item.label_es} value={item.swatch_hex || '#cccccc'} onChange={event => void saveRow('commerce_attribute_options', { attribute_code: item.attribute_code, code: item.code }, { swatch_hex: event.target.value })} /></label>}
              <label className="taxonomy-option-name"><span className="taxonomy-row-label">Nombre</span><input aria-label={'Nombre de ' + item.code} value={item.label_es} onChange={event => patchOption(item.attribute_code, item.code, { label_es: event.target.value })} onBlur={() => void saveRow('commerce_attribute_options', { attribute_code: item.attribute_code, code: item.code }, { label_es: item.label_es })} /></label>
              <label className="taxonomy-order-field"><span className="taxonomy-row-label">Orden</span><input type="number" aria-label={'Orden de ' + item.label_es} value={item.sort_order} onChange={event => patchOption(item.attribute_code, item.code, { sort_order: Number(event.target.value) })} onBlur={() => void saveRow('commerce_attribute_options', { attribute_code: item.attribute_code, code: item.code }, { sort_order: item.sort_order })} /></label>
              <label className="taxonomy-toggle"><input type="checkbox" aria-label={'Visible: ' + item.label_es} checked={item.active} onChange={event => void saveRow('commerce_attribute_options', { attribute_code: item.attribute_code, code: item.code }, { active: event.target.checked })} /><span className="taxonomy-row-label">Visible</span></label>
            </div>)}{!visibleOptions.length && <div className="taxonomy-empty">{options.length ? 'No hay opciones con ese nombre.' : 'Todavía no hay opciones.'}</div>}</div>
          </div> : <div className="taxonomy-help">Este dato se completa directamente en la ficha del producto; no necesita una lista de opciones.</div>}
        </div>}
      </div>
    </section>}

    {section === 'rules' && <section className="taxonomy-workspace" aria-labelledby="taxonomy-rules-title">
      <div className="taxonomy-section-head"><div><h3 id="taxonomy-rules-title">Reglas por categoría</h3><div>Elegí qué datos aparecen al cargar productos de cada categoría. Las subcategorías también reciben las reglas de su familia.</div></div><button type="button" className="taxonomy-primary" onClick={() => setAddRule(value => !value)}>{addRule ? 'Cancelar' : '+ Agregar regla'}</button></div>
      <div className="taxonomy-rule-context"><label>Categoría a configurar<select value={ruleCategory?.code ?? ''} onChange={event => { setRuleCategoryCode(event.target.value); setRemoveKey(''); }}><option value="" disabled>Elegí una categoría</option>{orderedCategories.map(item => <option key={item.code} value={item.code}>{item.parent_code ? '↳ ' : ''}{item.label_es}</option>)}</select></label><div>{rules.length} {rules.length === 1 ? 'regla propia' : 'reglas propias'} para esta categoría</div></div>
      <div className="taxonomy-rule-guide"><div><strong>Dato</strong></div><div><strong>Obligatorio</strong><small>Hay que completarlo</small></div><div><strong>Filtro</strong><small>Sirve para buscar</small></div><div><strong>Elegible al comprar</strong><small>Lo elige el cliente</small></div><div /></div>
      {addRule && <form className="taxonomy-create" onSubmit={createRule}><h4>Nueva regla para {ruleCategory?.label_es}</h4><div className="taxonomy-form-grid"><label>Atributo<select required value={ruleForm.attribute} onChange={event => setRuleForm({ ...ruleForm, attribute: event.target.value, purchaseSelectable: false })}><option value="">Elegí un dato</option>{attributes.map(item => <option key={item.code} value={item.code}>{item.label_es}</option>)}</select></label><div className="taxonomy-scope-note">{ruleForm.attribute === 'color' ? 'Color se aplica a cada variante.' : 'Este dato se aplica al producto.'}</div></div><div className="taxonomy-rule-controls"><label className="taxonomy-toggle"><input type="checkbox" checked={ruleForm.required} onChange={event => setRuleForm({ ...ruleForm, required: event.target.checked })} /><span>Obligatorio</span></label><label className="taxonomy-toggle"><input type="checkbox" checked={ruleForm.filterable} onChange={event => setRuleForm({ ...ruleForm, filterable: event.target.checked })} /><span>Filtro</span></label><label className="taxonomy-toggle"><input type="checkbox" disabled={ruleForm.attribute === 'color'} checked={ruleForm.purchaseSelectable} onChange={event => setRuleForm({ ...ruleForm, purchaseSelectable: event.target.checked })} /><span>Elegible al comprar</span></label></div><details className="taxonomy-advanced"><summary>Orden de aparición</summary><label>Orden<input type="number" value={ruleForm.order} onChange={event => setRuleForm({ ...ruleForm, order: event.target.value })} /></label></details><div className="taxonomy-create-actions"><button type="submit" className="taxonomy-primary">Guardar regla</button></div></form>}
      <div className="taxonomy-rule-list">{rules.map(item => {
        const key = item.category_code + '-' + item.attribute_code + '-' + item.scope;
        const label = taxonomy.attributes.find(definition => definition.code === item.attribute_code)?.label_es ?? item.attribute_code;
        const match = { category_code: item.category_code, attribute_code: item.attribute_code, scope: item.scope };
        return <article className="taxonomy-rule" key={key}><div className="taxonomy-rule-name"><h4>{label}</h4><small>{item.scope === 'product' ? 'Dato del producto' : 'Dato de cada variante'}</small></div><div className="taxonomy-rule-controls"><label className="taxonomy-toggle"><input type="checkbox" aria-label={'Obligatorio: ' + label} checked={item.required} onChange={event => void saveRow('commerce_category_attributes', match, { required: event.target.checked })} /><span>Obligatorio</span></label><label className="taxonomy-toggle"><input type="checkbox" aria-label={'Filtro: ' + label} checked={item.filterable} onChange={event => void saveRow('commerce_category_attributes', match, { filterable: event.target.checked })} /><span>Filtro</span></label><label className="taxonomy-toggle"><input type="checkbox" aria-label={'Elegible al comprar: ' + label} disabled={item.scope !== 'product'} checked={item.purchase_selectable} onChange={event => void saveRow('commerce_category_attributes', match, { purchase_selectable: event.target.checked })} /><span>Elegible al comprar</span></label></div><button type="button" className={removeKey === key ? 'taxonomy-remove is-confirming' : 'taxonomy-remove'} onClick={async () => { if (removeKey !== key) { setRemoveKey(key); return; } const { error: removeError } = await supabase.from('commerce_category_attributes').delete().eq('category_code', item.category_code).eq('attribute_code', item.attribute_code).eq('scope', item.scope); onNotice(removeError ? removeError.message : 'Regla eliminada.'); setRemoveKey(''); if (!removeError) await load(); }}>{removeKey === key ? 'Confirmar eliminación' : 'Quitar regla'}</button></article>;
      })}{!rules.length && <div className="taxonomy-empty taxonomy-empty--large">Esta categoría no tiene reglas propias. Podés agregar una o usar las que hereda de su familia.</div>}</div>
      {inheritedRules.length > 0 && <div className="taxonomy-inherited">
        <h4>Datos heredados de la familia</h4>
        <p>Se aplican automáticamente a esta subcategoría. Para cambiarlos, editá la familia o agregá una regla propia para este dato.</p>
        <div>{inheritedRules.map(item => <div key={item.scope + '-' + item.attribute_code}>
          <strong>{taxonomy.attributes.find(definition => definition.code === item.attribute_code)?.label_es ?? item.attribute_code}</strong>
          <span>{[item.required && 'Obligatorio', item.filterable && 'Filtro', item.purchase_selectable && 'Elegible al comprar'].filter(Boolean).join(' · ') || 'Sin condiciones especiales'}</span>
        </div>)}</div>
      </div>}
    </section>}
    <div className="taxonomy-save-note">Los nombres y el orden se guardan al salir del campo. Las casillas y selectores se guardan al cambiarlos.</div>
  </section>;
}
