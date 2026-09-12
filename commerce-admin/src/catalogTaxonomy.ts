import { supabase } from './supabase';
import {
  defaultCatalogTaxonomy,
  type CatalogAttributeDefinition,
  type CatalogAttributeOption,
  type CatalogCategoryAttribute,
  type CatalogCategoryDefinition,
  type CatalogTaxonomy,
} from '../../shared/catalog-taxonomy';

export async function loadCatalogTaxonomy(includeInactive = true): Promise<CatalogTaxonomy> {
  const [categories, attributes, options, rules] = await Promise.all([
    supabase.from('commerce_categories').select('code,label_es,parent_code,active,sort_order').order('sort_order'),
    supabase.from('commerce_attribute_definitions').select('code,label_es,data_type,unit,input_style,active').order('label_es'),
    supabase.from('commerce_attribute_options').select('attribute_code,code,label_es,swatch_hex,active,sort_order').order('sort_order'),
    supabase.from('commerce_category_attributes').select('category_code,attribute_code,scope,required,filterable,sort_order').order('sort_order'),
  ]);
  if (categories.error || attributes.error || options.error || rules.error) return defaultCatalogTaxonomy;
  const taxonomy: CatalogTaxonomy = {
    categories: (categories.data ?? []) as CatalogCategoryDefinition[],
    attributes: (attributes.data ?? []) as CatalogAttributeDefinition[],
    options: (options.data ?? []) as CatalogAttributeOption[],
    rules: (rules.data ?? []) as CatalogCategoryAttribute[],
  };
  if (includeInactive) return taxonomy;
  return {
    categories: taxonomy.categories.filter(item => item.active),
    attributes: taxonomy.attributes.filter(item => item.active),
    options: taxonomy.options.filter(item => item.active),
    rules: taxonomy.rules,
  };
}

export function normalizeTaxonomyCode(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
