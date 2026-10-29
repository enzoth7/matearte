import { ArgentinaSettings } from "./ArgentinaSettings";
import { usdMoney } from "../data";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { saveWholesaleExchangeRate } from '../wholesaleSource';
import { INTERNAL_ORDER_CHANNELS } from '../commerceSource';
import { PersonalizedOrders } from './PersonalizedOrdersView';
import { TaxonomyManager } from './TaxonomyManager';
import { loadCatalogTaxonomy } from './catalogTaxonomy';
import { InternationalShipping } from './InternationalShippingView';
import { Discounts } from './DiscountsView';
import { ProductCoverEditor, type ProductCoverCrop } from './ProductCoverEditor';
import { FloppyDisk, PencilSimple, Power, Trash, X } from '@phosphor-icons/react';
import { CatalogVariantDetails } from '../CatalogVariantDetails';
import { CatalogProductCoreFields } from '../CatalogProductCoreFields';
import { purchaseCategoryLabel } from '../customerPurchase';
import { compactOrderItemName, orderColorLabel, orderSizeLabel } from '../orderItemPresentation';
import type { OrderDetailRow } from '../OrderDetailItems';
import { OrderDetailContent, type OrderDetailView } from '../OrderDetailContent';
import { Modal } from '../ui';
import type { Product as CatalogProduct } from '../data';
import { OrderContactPhone } from '../OrderContactPhone';
import {
  catalogAttributeLabel,
  catalogCategoryIds,
  catalogColorIds,
  catalogMaterialIds,
  catalogMaterialCodesForCategory,
  catalogPurchaseAxes,
  catalogProductTypeIds,
  catalogValueLabel,
  colorOnlyVariantValues,
  defaultCatalogTaxonomy,
  emptyCatalogAttributes,
  formatVariantLabel,
  allowsFlejeDesign,
  mateInteriorChoices,
  normalizeCatalogAttributes,
  normalizeCatalogValueMap,
  optionSignature,
  taxonomyOptionsFor,
  taxonomyRulesForCategory,
  taxonomyRulesForProduct,
  canonicalCategoryCode,
  type CatalogAttributes,
  type CatalogAttributeDefinition,
  type CatalogTaxonomy,
  type CatalogValue,
  type CatalogValueMap,
  type CatalogMaterialId,
} from '../../../shared/catalog-taxonomy';
import { formatDate } from "../dateFormat";

type Tab = 'catalog' | 'list' | 'orders' | 'personalized' | 'international_shipping' | 'discounts' | 'settings' | 'rates';

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
  international_shipping: 'international_shipping',
  'international-shipping': 'international_shipping',
  'envios-internacionales': 'international_shipping',
  'envios_internacionales': 'international_shipping',
  rates: 'rates',
  cotizaciones: 'rates',
  discounts: 'discounts',
  descuentos: 'discounts',
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
type ProductVariant = {id:string;sku:string;name:string;base_price_minor:number;price_minor:number;active:boolean;available_local?:boolean;available_web?:boolean;available_wholesale?:boolean;wholesale_price_arg?:number|null;legacy_product_id?:string|null;rim_type?:string;leather_type?:string;color?:string|null;weight_grams?:number|null;option_values?:unknown};
const variantColorValues = (variant: Pick<ProductVariant, 'color' | 'option_values'>): CatalogValueMap => {
  const values = colorOnlyVariantValues(normalizeCatalogValueMap(variant.option_values));
  if (!values.color && variant.color) values.color = variant.color;
  return values;
};
type Product = { id:string; editorial_slug:string; name:string; category:string; category_code?:string|null; description:string; sale_mode:SaleMode; published:boolean; apply_catalog_price_adjustment?:boolean; peso?:number; catalog_filters?:unknown; attributes?:unknown; commerce_variants:ProductVariant[]; commerce_product_images:ProductImage[] };
type ProductForm = {name:string;category:string;description:string;saleMode:SaleMode;peso:number;catalogFilters:CatalogAttributes;attributes:CatalogValueMap};
type VariantForm = {sku:string;price:string;priceArg:string;options:CatalogValueMap;local:boolean;web:boolean;wholesale:boolean;servicePriceMode:'fixed'|'variable'};
const emptyVariantForm = (service = false): VariantForm => ({sku:'',price:'',priceArg:'',options:{},local:true,web:!service,wholesale:false,servicePriceMode:service?'variable':'fixed'});
export type OrderItem = {id:string;item_type:'catalog'|'design';title:string;quantity:number;requires_review:boolean;review_status:string|null;immutable_snapshot:Record<string,unknown>;sku?:string|null;source_variant_id?:string|null;unit_price_minor?:number|null;total_minor?:number|null;source_variant?:{product?:{peso?:number}}};
export type BankTransferReceipt = {id:string;original_name:string;mime_type:string;byte_size:number;status:'pending'|'approved'|'rejected';rejection_reason:string|null;submitted_at:string;reviewed_at:string|null};
export type Order = { id:string;order_number:number;reference_code?:string|null;status:string;shipping_method:string;shipping_snapshot:Record<string,unknown>;shipping_carrier:string|null;tracking_code:string|null;shipped_at:string|null;items_subtotal_minor?:number;shipping_minor?:number;payment_fee_minor?:number;payment_method?:string|null;discount_code?:string|null;discount_minor?:number;total_minor:number;currency?:string;paypal_amount_usd_minor?:number|null;created_at:string;customer_snapshot:Record<string,unknown>;peso?:number|null;order_items:OrderItem[];commerce_bank_transfer_receipts?:BankTransferReceipt[] };
type SupabaseOrder = Omit<Order,'commerce_bank_transfer_receipts'> & {commerce_bank_transfer_receipts?:BankTransferReceipt[]|BankTransferReceipt|null};
export const normalizeBankTransferReceipts = (value:SupabaseOrder['commerce_bank_transfer_receipts']):BankTransferReceipt[] => Array.isArray(value) ? value : value ? [value] : [];
const money=(minor:number,currency='UYU')=>new Intl.NumberFormat('es-UY',{style:'currency',currency,currencyDisplay:'code',minimumFractionDigits:0,maximumFractionDigits:2}).format(minor/100);
export const roundCommercialPrice = (minor:number) => {
  const lowerMultiple = Math.floor(minor / 5000) * 5000;
  return minor - lowerMultiple < 1000 ? lowerMultiple : lowerMultiple + 5000;
};
export const calculateAdjustedCatalogPrice = (baseMinor:number, percent:number, enabled=true) => enabled ? roundCommercialPrice(baseMinor*(1+percent/100)) : baseMinor;
export const formatWeight = (grams: number) => {
  if (!grams || grams <= 0) return '0 g';
  if (grams >= 1000) {
    const kg = grams / 1000;
    return `${kg % 1 === 0 ? kg : kg.toFixed(2)} kg`;
  }
  return `${grams} g`;
};
export const getOrderItemWeight = (item: OrderItem): number => {
  if (item.item_type === 'design') {
    return 200;
  }
  const snapshot = item.immutable_snapshot as Record<string, unknown> | undefined;
  const productSnapshot = snapshot?.product as Record<string, unknown> | undefined;
  if (productSnapshot && typeof productSnapshot.peso === 'number' && productSnapshot.peso > 0) {
    return productSnapshot.peso;
  }
  const joinedVariant = item.source_variant;
  if (joinedVariant?.product && typeof joinedVariant.product.peso === 'number' && joinedVariant.product.peso > 0) {
    return joinedVariant.product.peso;
  }
  return 0;
};
export const getOrderTotalWeight = (order: Order): number => {
  if (typeof order.peso === 'number' && order.peso > 0) return order.peso;
  if (!order.order_items || !order.order_items.length) return 0;
  return order.order_items.reduce((total, item) => total + getOrderItemWeight(item) * (item.quantity || 1), 0);
};
const MAX_PRODUCT_IMAGE_BYTES = 10 * 1024 * 1024;
const PRODUCT_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const productImageUrl = (path:string) => supabase.storage.from('product-images').getPublicUrl(path).data.publicUrl;
const fileExtension = (file:File) => file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || (file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg');
const productCoverCrop = (image:ProductImage):ProductCoverCrop => {
  const values = normalizeCatalogValueMap(image.option_values);
  return {
    x: typeof values.cover_x === 'number' ? values.cover_x : 0,
    y: typeof values.cover_y === 'number' ? values.cover_y : 0,
    zoom: typeof values.cover_zoom === 'number' ? values.cover_zoom : 1,
  };
};
const productCoverStyle = (image:ProductImage) => {
  const crop = productCoverCrop(image);
  return {
    objectPosition:`${50-crop.x}% ${50-crop.y}%`,
    transform:`scale(${crop.zoom})`,
  };
};
const EMPTY_PRODUCT_FORM = (category = 'mates'): ProductForm => ({name:'',category,description:'',saleMode:'standard',peso:0,catalogFilters:emptyCatalogAttributes(),attributes:{}});
const productFormFrom = (product: Product, category: string): ProductForm => {
  const catalogFilters = normalizeCatalogAttributes(product.catalog_filters);
  const attributes = normalizeCatalogValueMap(product.attributes);
  const material = attributes.material;
  if (typeof material === 'string' && catalogMaterialIds.includes(material as CatalogMaterialId) && !catalogFilters.materials.includes(material as CatalogMaterialId)) {
    catalogFilters.materials = [material as CatalogMaterialId, ...catalogFilters.materials];
  }
  return {name:product.name,category,description:product.description,saleMode:product.sale_mode,peso:product.peso??0,catalogFilters,attributes};
};
const withMaterials = (form: ProductForm, materials: CatalogMaterialId[]): ProductForm => {
  const attributes = {...form.attributes};
  if (materials.length) attributes.material = materials[0];
  else delete attributes.material;
  return {...form,catalogFilters:{...form.catalogFilters,materials},attributes};
};
const productSlug = (name:string) => name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,120) || `producto-${Date.now()}`;

type IconName = Tab | 'logout' | 'search' | 'print';

function Icon({ name }: { name: IconName }) {
  const paths: Record<IconName, ReactNode> = {
    catalog: <><path d="M4 5.5h16v13H4z"/><path d="M8 9h8M8 13h5"/></>,
    list: <><path d="M8 6h12M8 12h12M8 18h12"/><path d="M4 6h.01M4 12h.01M4 18h.01"/></>,
    orders: <><path d="M6 3.5h12v17H6z"/><path d="M9 8h6M9 12h6M9 16h4"/></>,
    personalized: <><path d="M12 3 14.2 8.8 20 11l-5.8 2.2L12 19l-2.2-5.8L4 11l5.8-2.2z"/></>,
    international_shipping: <><circle cx="12" cy="12" r="10"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/><line x1="2" y1="12" x2="22" y2="12"/></>,
    rates: <><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></>,
    discounts: <><path d="M20 12 12 20 4 12V4h8z"/><path d="M8.5 8.5h.01"/></>,
    settings: <><path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/></>,
    logout: <><path d="M10 5H5v14h5M14 8l4 4-4 4M8 12h10"/></>,
    search: <><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 4 4"/></>,
    print: <><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></>,
  };
  return <svg className="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

const textValue = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const numberValue = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};
const recordValue = (value: unknown): Record<string,unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string,unknown> : {};
const snapshotValue = (snapshot: Record<string, unknown>, ...keys:string[]) => keys.map(key=>textValue(snapshot[key])).find(Boolean) || '';
const orderCustomer = (snapshot: Record<string, unknown>) => snapshotValue(snapshot,'fullName','full_name','name','email') || 'Cliente sin nombre';
export function getItemSku(item: Pick<OrderItem, 'item_type' | 'sku' | 'immutable_snapshot'>): string {
  if (item.item_type !== 'catalog') return '';
  const itemSku = textValue(item.sku);
  if (itemSku) return itemSku;
  const snapshot = recordValue(item.immutable_snapshot);
  const variant = recordValue(snapshot.variant);
  const variantSku = textValue(variant.sku);
  if (variantSku) return variantSku;
  return textValue(snapshot.sku);
}
export function getItemPricing(item: OrderItem): { unitPriceMinor: number; totalMinor: number } {
  const snapshot = recordValue(item.immutable_snapshot);
  const variant = recordValue(snapshot.variant);

  const rawUnitPrice = [
    item.unit_price_minor,
    snapshot.unit_price_minor,
    snapshot.unitPriceMinor,
    snapshot.price_minor,
    snapshot.price,
    variant.price_minor,
    variant.price,
  ].map(numberValue).find((val): val is number => val !== null) ?? null;

  const rawTotal = [
    item.total_minor,
    snapshot.total_minor,
    snapshot.totalMinor,
  ].map(numberValue).find((val): val is number => val !== null) ?? null;

  const quantity = typeof item.quantity === 'number' && item.quantity > 0 ? item.quantity : 1;

  if (rawUnitPrice !== null && rawTotal !== null) {
    return { unitPriceMinor: rawUnitPrice, totalMinor: rawTotal };
  }
  if (rawUnitPrice !== null) {
    return { unitPriceMinor: rawUnitPrice, totalMinor: rawUnitPrice * quantity };
  }
  if (rawTotal !== null) {
    return { unitPriceMinor: Math.round(rawTotal / quantity), totalMinor: rawTotal };
  }
  return { unitPriceMinor: 0, totalMinor: 0 };
}
export function getCatalogOrderOptionDetails(item:Pick<OrderItem,'item_type'|'immutable_snapshot'>,taxonomy:CatalogTaxonomy=defaultCatalogTaxonomy) {
  if (item.item_type !== 'catalog') return [];
  const snapshot = recordValue(item.immutable_snapshot);
  const variant = recordValue(snapshot.variant);
  const product = recordValue(snapshot.product);
  const legacyColor: CatalogValueMap = textValue(variant.color) ? { color: textValue(variant.color) } : {};
  const variantOptions = normalizeCatalogValueMap(variant.option_values);
  const selectedOptions = normalizeCatalogValueMap(snapshot.selectedOptions ?? snapshot.optionValues ?? snapshot.option_values_override);
  const options: CatalogValueMap = {...legacyColor,...variantOptions,...selectedOptions};
  const category = textValue(product.category_code) || textValue(product.category);
  const orderedAttributes = taxonomyRulesForCategory(taxonomy,category,'variant').map(rule=>rule.attribute_code);
  const keys = [...new Set([...orderedAttributes,...Object.keys(options).sort()])].filter(key=>options[key]!==undefined&&options[key]!=="");
  return keys.map(attribute=>({
    attribute,
    label: catalogAttributeLabel(taxonomy,attribute),
    value: catalogValueLabel(taxonomy,attribute,options[attribute]),
  }));
}

export function getOrderItemDisplayName(item: Pick<OrderItem, 'item_type' | 'title' | 'immutable_snapshot'>) {
  if (item.item_type === 'design') return item.title;
  const snapshot = recordValue(item.immutable_snapshot);
  const product = recordValue(snapshot.product);
  return compactOrderItemName({ title: item.title, productName: textValue(product.name) });
}

export const CALLING_CODE_TO_COUNTRY: Record<string, string> = {
  '+598': 'Uruguay',
  '+54': 'Argentina',
  '+55': 'Brasil',
  '+56': 'Chile',
  '+34': 'España',
  '+1': 'EE. UU. / Canadá',
  '+39': 'Italia',
  '+31': 'Países Bajos',
  '+33': 'Francia',
  '+49': 'Alemania',
  '+44': 'Reino Unido',
  '+81': 'Japón',
  '+52': 'México',
  '+595': 'Paraguay',
  '+506': 'Costa Rica',
  '+504': 'Honduras',
  '+61': 'Australia',
  '+971': 'Emiratos Árabes',
  '+63': 'Filipinas',
  '+7': 'Rusia',
  '+65': 'Singapur',
  '+351': 'Portugal',
  '+41': 'Suiza',
  '+43': 'Austria',
  '+32': 'Bélgica',
  '+46': 'Suecia',
  '+47': 'Noruega',
  '+45': 'Dinamarca',
  '+358': 'Finlandia',
  '+48': 'Polonia',
  '+57': 'Colombia',
  '+51': 'Perú',
  '+591': 'Bolivia',
  '+593': 'Ecuador',
  '+58': 'Venezuela',
  '+507': 'Panamá',
};

export type OrderPhoneInfo = {
  prefix: string;
  number: string;
  country: string;
  display: string;
  whatsappDigits: string;
};

export function formatOrderPhone(rawPhone?: unknown): OrderPhoneInfo | null {
  if (rawPhone === null || rawPhone === undefined) return null;
  const raw = typeof rawPhone === 'string'
    ? rawPhone.trim()
    : typeof rawPhone === 'number'
      ? String(rawPhone).trim()
      : '';
  if (!raw) return null;

  const normalized = raw.replace(/^\((\+?\d+)\)\s*/, '$1 ');
  let prefix = '';
  let country = '';
  let number = '';

  const knownEntries = Object.entries(CALLING_CODE_TO_COUNTRY)
    .sort(([a], [b]) => b.length - a.length);

  if (normalized.startsWith('+')) {
    const match = knownEntries.find(([code]) => normalized.startsWith(code));
    if (match) {
      prefix = match[0];
      country = match[1];
      number = normalized.slice(prefix.length).replace(/^[\s.-]+/, '').trim();
    } else {
      const genericMatch = normalized.match(/^(\+\d{1,4})(?:[\s.-]+(.*)|(\d+.*))?$/);
      if (genericMatch) {
        prefix = genericMatch[1];
        country = '';
        number = (genericMatch[2] ?? genericMatch[3] ?? '').trim();
      } else {
        prefix = '+';
        country = '';
        number = normalized.slice(1).trim();
      }
    }
  } else if (normalized.startsWith('00')) {
    return formatOrderPhone('+' + normalized.slice(2).trim());
  } else if (/^09\d/.test(normalized.replace(/\s+/g, '')) || normalized.startsWith('09')) {
    prefix = '+598';
    country = 'Uruguay';
    number = normalized;
  } else {
    let matchedCode = false;
    const allDigits = normalized.replace(/\D/g, '');

    if (allDigits.length === 10 && allDigits.startsWith('39')) {
      // Celulares de Italia (10 dígitos arrancando en 39x, ej. Wind Tre 392xxxxxxx)
      prefix = '+39';
      country = 'Italia';
      number = allDigits;
      matchedCode = true;
    } else if (allDigits.length === 12 && allDigits.startsWith('393')) {
      // Formato internacional sin '+' (prefijo 39 + 10 dígitos de celular nacional)
      prefix = '+39';
      country = 'Italia';
      number = allDigits.slice(2);
      matchedCode = true;
    } else {
      for (const [codeWithPlus, countryName] of knownEntries) {
        const codeDigits = codeWithPlus.slice(1);
        if (normalized.startsWith(codeDigits)) {
          const rest = normalized.slice(codeDigits.length);
          const restDigits = rest.replace(/\D/g, '');
          if (codeDigits.length === 1) {
            if (/^[\s.-]/.test(rest) || restDigits.length === 10) {
              prefix = codeWithPlus;
              country = countryName;
              number = rest.replace(/^[\s.-]+/, '').trim();
              matchedCode = true;
              break;
            }
          } else {
            if (/^[\s.-]/.test(rest) || (codeDigits !== '39' && restDigits.length >= 8)) {
              prefix = codeWithPlus;
              country = countryName;
              number = rest.replace(/^[\s.-]+/, '').trim();
              matchedCode = true;
              break;
            }
          }
        }
      }
    }

    if (!matchedCode) {
      prefix = '';
      country = '';
      number = normalized;
    }
  }

  let display = '';
  if (prefix && number) {
    display = country ? `${prefix} ${number} (${country})` : `${prefix} ${number}`;
  } else if (prefix) {
    display = country ? `${prefix} (${country})` : prefix;
  } else {
    display = country ? `${number} (${country})` : number;
  }

  const nationalDigits = number.replace(/\D/g, '');
  const prefixDigits = prefix.replace(/\D/g, '');
  let whatsappDigits = '';

  if (country === 'Uruguay' || prefix === '+598') {
    const localDigits = nationalDigits.startsWith('0') ? nationalDigits.slice(1) : nationalDigits;
    whatsappDigits = localDigits ? `598${localDigits}` : '';
  } else if (prefixDigits) {
    whatsappDigits = `${prefixDigits}${nationalDigits}`;
  } else if (nationalDigits.length === 9 && nationalDigits.startsWith('0')) {
    whatsappDigits = `598${nationalDigits.slice(1)}`;
  } else if (nationalDigits.length === 8 && nationalDigits.startsWith('9')) {
    whatsappDigits = `598${nationalDigits}`;
  } else {
    whatsappDigits = nationalDigits;
  }

  return {
    prefix,
    number,
    country,
    display,
    whatsappDigits,
  };
}

export function getOrderDeliveryDetails(order:Pick<Order,'shipping_method'|'shipping_snapshot'|'customer_snapshot'>) {
  const customer = order.customer_snapshot || {};
  const shipping = order.shipping_snapshot || {};
  const isPickup = order.shipping_method === 'pickup';
  const isInternational = order.shipping_method === 'international_coordination' || order.shipping_method === 'international_shipping';
  const source = isInternational ? shipping : customer;
  const countryCode = snapshotValue(source,'country','countryCode','country_code');
  const upperCountry = countryCode.toUpperCase();
  const country = upperCountry === 'UY'
    ? 'Uruguay'
    : upperCountry === 'NL'
      ? 'Holanda'
      : countryCode || (!isInternational ? 'Uruguay' : '');
  const rawPhone = snapshotValue(customer, 'phone', 'telephone', 'celular', 'whatsapp');
  const phoneInfo = formatOrderPhone(rawPhone);
  const methodLabel = isPickup
    ? 'Retiro'
    : order.shipping_method === 'international_shipping'
      ? 'Envío internacional (PayPal)'
      : isInternational
        ? 'Envío internacional a coordinar'
        : 'Envío nacional';
  return {
    isPickup,
    contactName: orderCustomer(customer),
    phone: phoneInfo ? phoneInfo.display : rawPhone,
    phoneInfo,
    email: snapshotValue(customer,'email'),
    address: snapshotValue(source,'address','addressLine1','address_line1'),
    city: snapshotValue(source,'city'),
    department: snapshotValue(source,'department','state','province'),
    country,
    zone: snapshotValue(shipping,'name'),
    methodLabel,
  };
}
const orderStatus = (status: string) => ({
  pending_payment: 'Pendiente de pago',
  payment_verification_pending: 'Comprobante por verificar',
  paid_pending_review: 'Requiere revisión',
  ready_for_production: 'En producción',
  ready_for_fulfillment: 'Listo para entregar',
  shipped: 'Enviado',
  delivered: 'Entregado',
  payment_failed: 'Pago fallido',
  cancelled: 'Cancelado',
  refunded: 'Reembolsado',
  manual_review: 'Revisión manual',
}[status] || status.replaceAll('_', ' '));
const normalizeSearch = (value:string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const catalogCategoryLabels: Record<string,string> = {
  mates:'Mate','mates-personalizados':'Personalizados',bombillas:'Bombilla',limpiabombillas:'Limpiabombillas',materas:'Matera',termos:'Termo','kits-materos':'Kit matero',cuchillos:'Cuchillo',cintos:'Cinto',calzado:'Calzado',botas:'Bota',zuecos:'Zueco',zapatos:'Zapato',marroquineria:'Marroquinería',billeteras:'Billetera',tarjeteros:'Tarjetero',carteras:'Cartera',bandolera:'Bandolera','posa-mates':'Posa mates',personalizados:'Personalizados',
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

const footwearCategoryCodes = new Set(['botas', 'zuecos', 'zapatos']);

function TaxonomyValueField({ definition, taxonomy, value, required, onChange, compact = false, allowedOptionCodes }:{ definition:CatalogAttributeDefinition;taxonomy:CatalogTaxonomy;value:CatalogValue|undefined;required:boolean;onChange:(value:CatalogValue|undefined)=>void;compact?:boolean;allowedOptionCodes?:string[] }) {
  const label = <div className={compact ? 'sr-only' : 'field-label'}>{definition.label_es}{definition.unit ? ` (${definition.unit})` : ''}{required&&<div className="field-required" aria-hidden="true">*</div>}</div>;
  if (definition.data_type === 'boolean') return <label className="taxonomy-boolean-field">{label}<input type="checkbox" checked={value===true} onChange={event=>onChange(event.target.checked)}/></label>;
  if (definition.data_type === 'enum') return <label>{label}<select required={required} value={typeof value==='string'?value:''} onChange={event=>onChange(event.target.value||undefined)}><option value="">Sin especificar</option>{taxonomyOptionsFor(taxonomy,definition.code).filter(option=>!allowedOptionCodes || option.code==='todos' && allowedOptionCodes.length>1 || allowedOptionCodes.includes(option.code)).map(option=><option key={option.code} value={option.code}>{definition.code==='interior' && option.code!=='todos' ? `Interior ${option.label_es}` : option.label_es}</option>)}</select></label>;
  return <label>{label}<input required={required} type={definition.data_type==='number'?'number':'text'} min={definition.data_type==='number'?'0':undefined} step={definition.data_type==='number'?'any':undefined} value={value===undefined?'':String(value)} onChange={event=>onChange(event.target.value===''?undefined:definition.data_type==='number'?Number(event.target.value):event.target.value)}/></label>;
}

export function DynamicAttributeFields({taxonomy,category,scope,values,onChange,materials,onMaterialsChange,productName=''}:{taxonomy:CatalogTaxonomy;category:string;scope:'product'|'variant';values:CatalogValueMap;onChange:(values:CatalogValueMap)=>void;materials?:CatalogMaterialId[];onMaterialsChange?:(materials:CatalogMaterialId[])=>void;productName?:string}) {
  const rules = taxonomyRulesForProduct(taxonomy,category,values,scope).filter(rule=>scope==='variant'||rule.attribute_code!=='acabado');
  if (!rules.length) return null;
  const hasSpecificMateMaterial = scope === 'product' && rules.some(rule => rule.attribute_code === 'material-mate');
  const knifeLength=category==='cuchillos'&&typeof values['largo-hoja-mm']==='number'?values['largo-hoja-mm']:null;
  const knifeType=typeof values['tipo-cuchillo']==='string'?values['tipo-cuchillo']:'';
  const orientativeWarning=knifeLength!==null&&((knifeType==='verijero'&&knifeLength>200)||(knifeType==='caronero'&&knifeLength<300));
  const fields = rules.map(rule => {
    const definition = taxonomy.attributes.find(item=>item.code===rule.attribute_code);
    if (!definition || (scope==='product' && definition.code==='forma-gavilan' && values['tiene-gavilan']!==true) || (hasSpecificMateMaterial && definition.code==='material')) return null;
    if (scope==='product' && definition.code==='material' && materials && onMaterialsChange && category!=='personalizados') {
      return <fieldset className="material-field" key="material">
        <legend>Materiales</legend>
        <div className="material-options">{taxonomyOptionsFor(taxonomy,'material')
          .filter(option=>catalogMaterialIds.includes(option.code as CatalogMaterialId) && catalogMaterialCodesForCategory(category).includes(option.code))
          .map(option=><label key={option.code} className="material-option">
            <input type="checkbox" checked={materials.includes(option.code as CatalogMaterialId)} onChange={event=>onMaterialsChange(event.target.checked?[...materials,option.code as CatalogMaterialId]:materials.filter(item=>item!==option.code))}/>
            {option.label_es}
          </label>)}</div>
      </fieldset>;
    }
    if (scope==='product' && definition.code==='tipo-cierre' && footwearCategoryCodes.has(canonicalCategoryCode(category))) {
      const choices = taxonomyOptionsFor(taxonomy,'tipo-cierre');
      const raw = values['tipo-cierre'];
      const selected = Array.isArray(raw) ? raw : typeof raw==='string' ? [raw] : [];
      return <fieldset className="material-field" key="tipo-cierre">
        <legend>Cierre y sujeción</legend>
        <div className="material-options">{choices.map(option=><label key={option.code} className="material-option">
          <input type="checkbox" checked={selected.includes(option.code)} onChange={event=>{
            const next = event.target.checked ? [...selected,option.code] : selected.filter(code=>code!==option.code);
            const attributes = {...values};
            if (next.length) attributes['tipo-cierre'] = next;
            else delete attributes['tipo-cierre'];
            onChange(attributes);
          }}/>{option.label_es}
        </label>)}</div>
      </fieldset>;
    }
    if (scope==='product' && definition.code==='talle' && footwearCategoryCodes.has(canonicalCategoryCode(category))) {
      const sizes = taxonomyOptionsFor(taxonomy,'talle').filter(option=>option.code!=='todos');
      const raw = values.talle;
      const selected = raw==='todos' ? sizes.map(option=>option.code) : Array.isArray(raw) ? raw : typeof raw==='string' ? [raw] : [];
      const setSizes = (next:string[]|undefined) => {
        const attributes={...values};
        if (next?.length) attributes.talle=next;
        else delete attributes.talle;
        onChange(attributes);
      };
      return <fieldset className="material-field" key="talle">
        <legend>{category==='zuecos'?'Números de zueco':category==='zapatos'?'Números de zapato':'Números de bota'} <span className="field-required" aria-hidden="true">*</span></legend>
        <div className="material-options">
          <label className="material-option"><input type="checkbox" checked={raw==='todos'} onChange={event=>event.target.checked?onChange({...values,talle:'todos'}):setSizes(undefined)}/>Todos los talles</label>
          {sizes.map(option=><label key={option.code} className="material-option"><input type="checkbox" checked={selected.includes(option.code)} onChange={event=>setSizes(event.target.checked?[...selected,option.code]:selected.filter(code=>code!==option.code))}/>{option.label_es}</label>)}
        </div>
        <small className="field-help">Elegí uno o varios números para este producto.</small>
      </fieldset>;
    }
    return <TaxonomyValueField key={definition.code} definition={definition} taxonomy={taxonomy} value={values[definition.code]} required={rule.required} allowedOptionCodes={definition.code==='interior'?mateInteriorChoices(category,values,productName):definition.code==='material'? [...catalogMaterialCodesForCategory(category)] :undefined} onChange={value=>{
      const next={...values};
      if(value===undefined) delete next[definition.code];
      else next[definition.code]=value;
      if (definition.code==='tipo-mate' && !allowsFlejeDesign(next)) delete next['diseno-fleje'];
      if (definition.code==='tipo-mate' && mateInteriorChoices(category,next,productName).length===1 && next.interior) next.interior='calabaza';
      if (definition.code==='tipo-personalizado' && value!==values[definition.code]) {
        const oldType=values['tipo-personalizado'];
        const oldRules=taxonomyRulesForCategory(taxonomy,oldType==='mate'?'mates':'materas','product');
        for (const oldRule of oldRules) if (oldRule.attribute_code!=='coleccion') delete next[oldRule.attribute_code];
        delete next['diseno-matera'];
      }
      onChange(next);
    }}/>;
  });
  if (scope === 'variant') {
    return <div className="product-fields">{fields}</div>;
  }
  return <fieldset className="catalog-attributes"><legend>Características del producto</legend><div className="product-fields">{fields}</div>{orientativeWarning&&<div className="warning-inline">El largo no es el habitual para este tipo tradicional. Es una advertencia orientativa: podés guardar la pieza si la clasificación es correcta.</div>}</fieldset>;
}

function hasConfiguredFootwearSizes(taxonomy:CatalogTaxonomy,category:string,attributes:CatalogValueMap) {
  if (!footwearCategoryCodes.has(canonicalCategoryCode(category))) return true;
  return Boolean(catalogPurchaseAxes(taxonomy,category,attributes).find(axis=>axis.code==='talle'&&axis.values.length>0));
}

export function Rates({onNotice,wholesaleRate}:{onNotice:(v:string)=>void;wholesaleRate?:number}) {
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
    if (code === 'ARS') {
      try {
        await saveWholesaleExchangeRate(newRate);
        onNotice('Cotización de ARS guardada para la web y el catálogo mayorista.');
      } catch (error) {
        onNotice(error instanceof Error ? error.message : 'No se pudo guardar ARS.');
      }
      return;
    }
    const { error } = await supabase.from('commerce_exchange_rates').upsert({ currency_code: code, rate_to_uyu: newRate });
    if (error) { onNotice(error.message); return; }
    onNotice(`Cotización de ${code} guardada.`);
    void load();
  };

  return <section className="commerce-section">
    <div className="section-header">
      <h2>Conversión de moneda</h2>
      <div>Establecé cuánto vale cada moneda en pesos uruguayos. ARS se usa en las compras web de Argentina y en el catálogo mayorista.</div>
    </div>
    {busy ? <div className="loading">Cargando cotizaciones…</div> : (
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
            {['USD', 'BRL', 'ARS'].map(code => {
              const current = rates.find(r => r.currency_code === code);
              return <RateRow key={code} code={code} initialRate={code === 'ARS' ? wholesaleRate : current?.rate_to_uyu} onSave={val => updateRate(code, val)} />
            })}
          </tbody>
        </table>
      </div>
    )}
  </section>;
}

function RateRow({ code, initialRate, onSave }: { code: string; initialRate?: number; onSave: (val: number) => Promise<void> }) {
  const [value, setValue] = useState(initialRate?.toString() || '');
  const [saving, setSaving] = useState(false);
  useEffect(() => setValue(initialRate?.toString() || ''), [initialRate]);
  const save = async () => { setSaving(true); try { await onSave(parseFloat(value)); } finally { setSaving(false); } };
  return <tr>
    <td style={{ padding: '0.75rem', borderBottom: '1px solid #ddd' }}><strong>{code}</strong></td>
    <td style={{ padding: '0.75rem', borderBottom: '1px solid #ddd' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <div>$</div>
        <input type="number" aria-label={`Cotización ${code} en UYU`} step={code === 'ARS' ? '0.000001' : '0.01'} min={code === 'ARS' ? '0.000001' : '0.01'} value={value} onChange={e => setValue(e.target.value)} style={{ width: '100px', padding: '0.25rem' }} />
        <div>UYU</div>
      </div>
    </td>
    <td style={{ padding: '0.75rem', borderBottom: '1px solid #ddd' }}>
        <button type="button" onClick={() => void save()} disabled={saving || !Number.isFinite(parseFloat(value)) || parseFloat(value) <= 0 || parseFloat(value) === initialRate}>{saving ? 'Guardando…' : 'Guardar'}</button>
    </td>
  </tr>;
}

async function readEditorProducts(selection: string, excludeSandbox = false) {
  const rows: unknown[] = [];
  for (let offset = 0; ; offset += 100) {
    let query = supabase.from('commerce_products').select(selection, {count:'exact'}).order('name').order('id').range(offset,offset+99);
    if (excludeSandbox) query = query.neq('category','sandbox');
    const result = await query;
    if (result.error) return {data: null, error: result.error};
    rows.push(...(result.data || []));
    if (rows.length >= (result.count ?? rows.length) || !result.data?.length) return {data: rows, error: null};
  }
}

export function Catalog({onNotice,initialProductId,initialVariantId,startNew=false,embedded=false,fixedCategory,onCreated,onCancelNew,onClose,onDirtyChange,onCatalogChange}:{onNotice:(v:string)=>void;initialProductId?:string;initialVariantId?:string|null;startNew?:boolean;embedded?:boolean;fixedCategory?:string;onCreated?:(id:string)=>void;onCancelNew?:()=>void;onClose?:()=>void;onDirtyChange?:(dirty:boolean)=>void;onCatalogChange?:()=>void|Promise<void>}) {
  const [taxonomy,setTaxonomy] = useState<CatalogTaxonomy>(defaultCatalogTaxonomy);
  const [products,setProducts] = useState<Product[]>([]);
  const [selected,setSelected] = useState(initialProductId || '');
  const [search,setSearch] = useState('');
  const [imageBusy,setImageBusy] = useState('');
  const [imageTargets,setImageTargets] = useState<Record<string,string>>({});
  const [coverEditorImage,setCoverEditorImage] = useState<ProductImage|null>(null);
  const [productBusy,setProductBusy] = useState('');
  const [showNewProduct,setShowNewProduct] = useState(startNew);
  const [newProduct,setNewProduct] = useState<ProductForm>(()=>EMPTY_PRODUCT_FORM(fixedCategory));
  const [productDetails,setProductDetails] = useState<ProductForm>(EMPTY_PRODUCT_FORM);
  const [savedProductDetails,setSavedProductDetails] = useState<ProductForm>(EMPTY_PRODUCT_FORM);
  const [variant,setVariant] = useState<VariantForm>(()=>emptyVariantForm(fixedCategory==='servicios'));
  const [editingVariantId, setEditingVariantId] = useState<string | null>(null);
  const [editingVariantForm, setEditingVariantForm] = useState<VariantForm>(emptyVariantForm);
  // Los SKU son numéricos y correlativos desde 100: el próximo es el mayor existente + 1.
  const nextSku = useMemo(() => String(Math.max(99, ...products.flatMap(item => item.commerce_variants.map(entry => /^\d+$/.test(entry.sku) ? Number(entry.sku) : 0))) + 1), [products]);

  const [taxonomyError,setTaxonomyError] = useState('');
  const categoryOptions = useMemo(() => taxonomy.categories
    .filter(item=>item.active&&(!fixedCategory||item.code===fixedCategory))
    .filter(item=>item.code!=='mates-personalizados'&&item.code!=='materas-personalizadas')
    .map(item=>({code:item.code,label:item.code==='personalizados'?'Personalizados':item.label_es}))
    .sort((a,b)=>a.label.localeCompare(b.label,'es')),[taxonomy.categories,fixedCategory]);
  useEffect(()=>{void loadCatalogTaxonomy(false).then(setTaxonomy).catch(error=>setTaxonomyError(error.message))},[]);
  useEffect(()=>{if(initialProductId)setSelected(initialProductId)},[initialProductId]);
  useEffect(()=>{setShowNewProduct(startNew);if(startNew)setNewProduct(EMPTY_PRODUCT_FORM(fixedCategory))},[startNew,fixedCategory]);

  const load = useCallback(async(preferredId?:string) => {
    const selection = 'id,editorial_slug,name,category,category_code,description,sale_mode,published,apply_catalog_price_adjustment,peso,catalog_filters,attributes,commerce_variants(id,sku,name,base_price_minor,price_minor,weight_grams,active,available_local,available_web,available_wholesale,wholesale_price_arg,legacy_product_id,rim_type,leather_type,color,option_values),commerce_product_images(id,storage_path,original_name,alt_text,mime_type,byte_size,sort_order,variant_id,option_values)';
    const legacySelection = 'id,editorial_slug,name,category,description,sale_mode,published,catalog_filters,commerce_variants(id,sku,name,price_minor,active,color),commerce_product_images(id,storage_path,original_name,alt_text,mime_type,byte_size,sort_order,variant_id)';
    let {data,error}:{data:unknown;error:{message:string;code?:string}|null} = await readEditorProducts(selection);
    if (error && (error.code === '42703' || /category_code|attributes|option_values|weight_grams|peso|base_price_minor|apply_catalog_price_adjustment|available_wholesale|wholesale_price_arg|legacy_product_id/i.test(error.message))) {
      ({data,error} = await readEditorProducts(legacySelection));
    }
    if (error) {
      onNotice(error.message);
      return;
    }
    const nextProducts = ((data || []) as Product[]).sort((a, b) => a.name.localeCompare(b.name, 'es'));
    setProducts(nextProducts);
    setSelected(current => {
      const requested = preferredId || current;
      return nextProducts.some(item => item.id === requested) ? requested : nextProducts[0]?.id || '';
    });
  },[onNotice]);

  useEffect(() => { void load(); },[load]);
  const filteredProducts = useMemo(() => {
    const query = normalizeSearch(search);
    const list = !query
      ? products
      : products.filter(item => normalizeSearch(`${item.name} ${item.editorial_slug} ${item.category}`).includes(query));
    return [...list].sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }, [products, search]);
  const product = products.find(item => item.id === selected);
  const isService = (product?.category_code || product?.category) === 'servicios';
  const images = [...(product?.commerce_product_images || [])].sort((a,b) => a.sort_order - b.sort_order || a.original_name.localeCompare(b.original_name));
  const variantRules = product ? taxonomyRulesForCategory(taxonomy,product.category_code||product.category,'variant') : [];
  const variantDefinitions = variantRules.map(rule=>({rule,definition:taxonomy.attributes.find(item=>item.code===rule.attribute_code)})).filter((item):item is typeof item & {definition:CatalogAttributeDefinition}=>Boolean(item.definition));
  const imageColors = [...new Set((product?.commerce_variants||[]).map(item=>String(normalizeCatalogValueMap(item.option_values).color||item.color||'')).filter(Boolean))];

  useEffect(() => {
    if (!product) return;
    const rawCategory = product.category_code || (product.category === 'kit-matero' ? 'kits-materos' : product.category === 'cuchillo' ? 'cuchillos' : product.category);
    const category = taxonomy.categories.some(item=>item.code===canonicalCategoryCode(rawCategory)) ? canonicalCategoryCode(rawCategory) : '';
    const details = productFormFrom(product,category);
    if (category==='personalizados' && !details.attributes['tipo-personalizado']) {
      details.attributes['tipo-personalizado'] = rawCategory==='materas-personalizadas'||/matera/i.test(product.name)?'matera':'mate';
    }
    setProductDetails(details);
    setSavedProductDetails(details);
  },[product,taxonomy.categories]);
  useEffect(() => {
    setEditingVariantId(null);
  }, [selected, initialVariantId]);
  const editingVariant = product?.commerce_variants.find(item => item.id === editingVariantId);
  const savedVariantForm = editingVariant && { sku: editingVariant.sku, price: ((editingVariant.base_price_minor ?? editingVariant.price_minor) / 100).toString(), priceArg:editingVariant.wholesale_price_arg?.toString() || '', options: variantColorValues(editingVariant), local: editingVariant.available_local !== false, web: editingVariant.active && editingVariant.available_web !== false, wholesale: editingVariant.available_wholesale === true, servicePriceMode: isService && (editingVariant.base_price_minor ?? editingVariant.price_minor) === 0 ? 'variable' as const : 'fixed' as const };
  const variantDraftDirty = Boolean(savedVariantForm && JSON.stringify(editingVariantForm) !== JSON.stringify(savedVariantForm));
  const newVariantDirty = Boolean(variant.sku || variant.price || variant.priceArg || Object.keys(variant.options).length || !variant.local || !variant.web || variant.wholesale);
  const showWholesalePriceColumn = !isService && (product?.commerce_variants.some(item => item.available_wholesale || item.legacy_product_id) || variant.wholesale || Boolean(editingVariantId && editingVariantForm.wholesale));
  const hasUnsavedChanges = showNewProduct
    ? JSON.stringify(newProduct) !== JSON.stringify(EMPTY_PRODUCT_FORM(fixedCategory))
    : JSON.stringify(productDetails) !== JSON.stringify(savedProductDetails) || variantDraftDirty || newVariantDirty;
  useEffect(()=>{onDirtyChange?.(hasUnsavedChanges)},[hasUnsavedChanges,onDirtyChange]);

  const createProduct = async(event:React.FormEvent) => {
    event.preventDefault();
    const name = newProduct.name.trim();
    const category = newProduct.category.trim().toLowerCase();
    if (!name || !category) {
      onNotice('Completá el nombre y la categoría del producto.');
      return;
    }

    if (!hasConfiguredFootwearSizes(taxonomy,category,newProduct.attributes)) { onNotice('Elegí al menos un número de calzado.'); return; }

    setProductBusy('create');
    try {
      const payload = {name,category,category_code:category,description:newProduct.description.trim(),sale_mode:newProduct.saleMode,peso:newProduct.peso??0,catalog_filters:newProduct.catalogFilters,attributes:newProduct.attributes,published:false,...(category==='servicios'?{apply_catalog_price_adjustment:false}:{})};
      const baseSlug = productSlug(name);
      let result = await supabase.from('commerce_products').insert({...payload,editorial_slug:baseSlug}).select('id').single();
      if (result.error?.code === '23505') {
        result = await supabase.from('commerce_products').insert({...payload,editorial_slug:`${baseSlug}-${crypto.randomUUID().slice(0,8)}`}).select('id').single();
      }
      if (result.error) throw result.error;
      setNewProduct(EMPTY_PRODUCT_FORM(fixedCategory));
      setShowNewProduct(false);
      onNotice('Producto creado. Ahora podés cargar sus fotos y variantes.');
      await load(result.data.id);
      onCreated?.(result.data.id);
    } catch (reason) {
      onNotice(reason && typeof reason === 'object' && 'message' in reason ? String(reason.message) : 'No se pudo crear el producto.');
    } finally {
      setProductBusy('');
    }
  };

  const saveProduct = async(event:React.FormEvent) => {
    event.preventDefault();
    if (!product) return;
    if (variantDraftDirty || newVariantDirty) { onNotice('Guardá o cancelá los cambios de la variante antes de guardar el producto.'); return; }
    const name = productDetails.name.trim();
    const category = productDetails.category.trim().toLowerCase();
    if (!name || !category) {
      onNotice('Completá el nombre y la categoría del producto.');
      return;
    }

    const attributes = {...productDetails.attributes};
    if (!hasConfiguredFootwearSizes(taxonomy,category,attributes)) { onNotice('Elegí al menos un número de calzado.'); return; }
    if (mateInteriorChoices(category, attributes, name).length===1 && (attributes.interior==='todos' || attributes.interior==='ceramica')) {
      attributes.interior='calabaza';
    }
    const changes:Record<string,unknown> = {};
    if(name !== product.name) changes.name = name;
    if(category !== (product.category_code || product.category)) {changes.category = category;changes.category_code = category}
    if(productDetails.description.trim() !== product.description) changes.description = productDetails.description.trim();
    if(productDetails.saleMode !== product.sale_mode) changes.sale_mode = productDetails.saleMode;
    if(category==='servicios') { changes.published = false; changes.apply_catalog_price_adjustment = false; }
    if((productDetails.peso??0) !== (product.peso??0)) changes.peso = productDetails.peso??0;
    if(JSON.stringify(productDetails.catalogFilters) !== JSON.stringify(savedProductDetails.catalogFilters)) changes.catalog_filters = productDetails.catalogFilters;
    if(JSON.stringify(attributes) !== JSON.stringify(savedProductDetails.attributes)) changes.attributes = attributes;
    if(changes.published === product.published) delete changes.published;
    if(changes.apply_catalog_price_adjustment === product.apply_catalog_price_adjustment) delete changes.apply_catalog_price_adjustment;
    if(!Object.keys(changes).length){onNotice('No hay cambios para guardar.');return}
    setProductBusy('save');
    const {error} = await supabase.from('commerce_products').update(changes).eq('id',product.id).select('id').single();
    onNotice(error ? error.message : 'Datos del producto guardados.');
    if (!error) {
      if(category==='servicios') {
        const {error:channelsError} = await supabase.from('commerce_variants').update({available_local:true,available_web:false,available_wholesale:false,wholesale_price_arg:null}).eq('product_id',product.id);
        if(channelsError) onNotice(`El servicio se guardó, pero no se pudieron ajustar sus canales: ${channelsError.message}`);
      }
      await load(product.id); void onCatalogChange?.();
    }
    setProductBusy('');
  };

  type CatalogUsage = {variants:number;images:number;active_orders:number;historical_orders:number;active_references:string[];storage_paths?:string[]};
  const usageSummary = (usage:CatalogUsage) => usage.historical_orders > 0
    ? `Tiene ${usage.historical_orders} ${usage.historical_orders===1?'pedido histórico':'pedidos históricos'}: se conservan con sus datos, pero quedan sin vínculo a este producto.`
    : 'No tiene pedidos asociados.';
  const activeOrdersMessage = (usage:CatalogUsage,what:string) => `No se puede eliminar ${what}: tiene ${usage.active_orders} ${usage.active_orders===1?'pedido activo':'pedidos activos'} (${usage.active_references.join(', ')}). Terminá o cancelá esos pedidos primero.`;

  const deleteProduct = async() => {
    if (!product) return;
    setProductBusy('delete');
    const usageResult = await supabase.rpc('gestion_catalog_usage',{p_product_id:product.id});
    const usage = usageResult.data as CatalogUsage | null;
    if (usageResult.error || !usage) { onNotice(usageResult.error?.message || 'No se pudo revisar el uso del producto.'); setProductBusy(''); return; }
    if (usage.active_orders > 0) { onNotice(activeOrdersMessage(usage,`“${product.name}”`)); setProductBusy(''); return; }
    const confirmed = window.confirm(`¿Eliminar definitivamente “${product.name}”?

Se eliminarán también ${usage.variants} variantes y ${usage.images} fotos.
${usageSummary(usage)}

Si solo querés sacarlo de la tienda, usá “Ocultar”.`);
    if (!confirmed) { setProductBusy(''); return; }
    const {data,error} = await supabase.rpc('gestion_delete_catalog_product',{p_product_id:product.id});
    const deleted = data as CatalogUsage | null;
    if (error || !deleted) {
      onNotice(error?.code === '23503' ? 'El producto ya tiene pedidos activos y no puede eliminarse.' : error?.message || 'No se pudo eliminar el producto.');
      setProductBusy('');
      return;
    }
    const paths = deleted.storage_paths || [];
    const {error:storageError} = paths.length ? await supabase.storage.from('product-images').remove(paths) : {error:null};
    onNotice(storageError ? 'Producto eliminado. Algunos archivos requieren limpieza manual.' : 'Producto eliminado definitivamente.');
    setProductBusy('');
    await load();
    void onCatalogChange?.();
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
    let newPrincipalImage:ProductImage|null = null;
    try {
      for (const [index,file] of files.entries()) {
        const path = `${product.id}/${crypto.randomUUID()}.${fileExtension(file)}`;
        const {error:uploadError} = await supabase.storage.from('product-images').upload(path,file,{cacheControl:'31536000',contentType:file.type,upsert:false});
        if (uploadError) throw uploadError;

        const {data:row,error:rowError} = await supabase.from('commerce_product_images').insert({
          product_id:product.id,
          storage_path:path,
          original_name:file.name.slice(0,240),
          alt_text:`Foto de ${product.name}`,
          mime_type:file.type,
          byte_size:file.size,
          sort_order:images.length + index,
        }).select('id,storage_path,original_name,alt_text,mime_type,byte_size,sort_order,variant_id,option_values').single();
        if (rowError) {
          await supabase.storage.from('product-images').remove([path]);
          throw rowError;
        }
        if (row && images.length + index === 0) newPrincipalImage = row as ProductImage;
        uploaded += 1;
      }
      onNotice(uploaded === 1 ? 'Imagen subida.' : `${uploaded} imágenes subidas.`);
      await load(product.id);
      void onCatalogChange?.();
      if (newPrincipalImage) setCoverEditorImage(newPrincipalImage);
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
      const {error:modifiedError} = await supabase.from('commerce_products').update({updated_at:new Date().toISOString()}).eq('id',product.id);
      const {error:storageError} = await supabase.storage.from('product-images').remove([image.storage_path]);
      const warnings = [
        modifiedError && 'No se pudo actualizar la fecha del producto.',
        storageError && 'El archivo necesita limpieza manual.',
      ].filter(Boolean);
      onNotice(warnings.length ? `Imagen eliminada del catálogo. ${warnings.join(' ')}` : 'Imagen eliminada.');
      await load();
      void onCatalogChange?.();
    } catch (reason) {
      onNotice(reason && typeof reason === 'object' && 'message' in reason ? String(reason.message) : 'No se pudo eliminar la imagen.');
    } finally {
      setImageBusy('');
    }
  };
  const linkImageColor = async(image:ProductImage, color:string) => {
    if (!product) return;
    setImageBusy(image.id);
    const optionValues = normalizeCatalogValueMap(image.option_values);
    if (color) optionValues.color = color;
    else delete optionValues.color;
    const {error} = await supabase.from('commerce_product_images').update({option_values:optionValues,variant_id:null}).eq('id', image.id);
    onNotice(error ? error.message : color ? 'Color enlazado a la foto.' : 'Foto marcada como general.');
    if (!error) { await load(product.id); void onCatalogChange?.(); }
    setImageBusy('');
  };

  const saveCoverCrop = async(crop:ProductCoverCrop) => {
    if (!product || !coverEditorImage) return;
    setImageBusy(coverEditorImage.id);
    const optionValues = {
      ...normalizeCatalogValueMap(coverEditorImage.option_values),
      cover_x:Math.round(crop.x*100)/100,
      cover_y:Math.round(crop.y*100)/100,
      cover_zoom:Math.round(crop.zoom*100)/100,
    };
    const {error} = await supabase.from('commerce_product_images').update({option_values:optionValues}).eq('id',coverEditorImage.id).eq('product_id',product.id).select('id').single();
    onNotice(error ? error.message : 'Portada ajustada.');
    if (!error) {
      setCoverEditorImage(null);
      await load(product.id);
      void onCatalogChange?.();
    }
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

      const {error:sourceModifiedError} = await supabase.from('commerce_products').update({updated_at:new Date().toISOString()}).eq('id',product.id);
      const {error:cleanupError} = await supabase.storage.from('product-images').remove([image.storage_path]);
      setImageTargets(current => {const next={...current};delete next[image.id];return next});
      const warnings = [
        sourceModifiedError && 'No se pudo actualizar la fecha del producto de origen.',
        cleanupError && 'El archivo anterior requiere limpieza manual.',
      ].filter(Boolean);
      onNotice(`Foto movida a “${target.name}”.${warnings.length ? ` ${warnings.join(' ')}` : ''}`);
      await load(product.id);
      void onCatalogChange?.();
    } catch (reason) {
      const message = reason && typeof reason === 'object' && 'message' in reason ? String(reason.message) : 'No se pudo mover la foto.';
      onNotice(message);
    } finally {
      setImageBusy('');
    }
  };

  const syncWebPublication = async(productId:string, variants:Pick<ProductVariant,'active'|'available_web'>[]) => {
    const published = !isService && Boolean(product && hasConfiguredFootwearSizes(taxonomy,product.category_code||product.category,normalizeCatalogValueMap(product.attributes))) && variants.some(item=>item.active&&item.available_web!==false);
    const {error:updateError} = await supabase.from('commerce_products').update({published}).eq('id',productId);
    if(updateError) throw updateError;
  };

  const createVariant = async(e:React.FormEvent) => {
    e.preventDefault();
    if (!product) return;
    const price = isService && variant.servicePriceMode==='variable' ? 0 : Number(variant.price);
    const category = product.category_code||product.category;
    const productAttributes = normalizeCatalogValueMap(product.attributes);
    if ((variant.web || variant.local) && !hasConfiguredFootwearSizes(taxonomy,category,productAttributes)) { onNotice('Elegí al menos un número de calzado antes de habilitar esta variante.'); return; }
    const missingProduct = (variant.web || variant.local) && taxonomyRulesForProduct(taxonomy,category,productAttributes,'product').find(rule=>rule.required&&(productAttributes[rule.attribute_code]===undefined||productAttributes[rule.attribute_code]===''));
    if(missingProduct){onNotice(`Antes de habilitarlo en Local o Web completá ${catalogAttributeLabel(taxonomy,missingProduct.attribute_code)}.`);return}
    const missing = variantRules.find(rule=>rule.required&&(variant.options[rule.attribute_code]===undefined||variant.options[rule.attribute_code]===''));
    const sku = variant.sku.trim() || nextSku;
    if(!/^\d{3,}$/.test(sku)){onNotice('El SKU debe ser numérico, desde 100.');return}
    if(!Number.isFinite(price)||(!isService && price<=0)||(isService && variant.servicePriceMode==='fixed' && price<=0)||missing){onNotice(missing?`Completá ${catalogAttributeLabel(taxonomy,missing.attribute_code)}.`:'Completá SKU y un precio válido.');return}
    if(!isService && variant.wholesale && (!variant.priceArg.trim() || !Number.isFinite(Number(variant.priceArg)) || Number(variant.priceArg) <= 0)){onNotice('Completá un precio ARS válido para Mayorista.');return}
    const options = colorOnlyVariantValues(variant.options);
    const signature=optionSignature(options);
    if(product.commerce_variants.some(item=>optionSignature(variantColorValues(item))===signature)){onNotice('Ya existe una variante de ese color.');return}
    setProductBusy('variant-create');
    const {error} = await supabase.from('commerce_variants').insert({
      product_id: product.id,
      sku,
      name: formatVariantLabel(taxonomy,product.category_code||product.category,options),
      base_price_minor: Math.round(price*100),
      price_minor: Math.round(price*100),
      wholesale_price_arg: !isService && variant.wholesale ? Number(variant.priceArg) : null,
      option_values: options,
      available_local: isService || variant.local, available_web: !isService && variant.web, available_wholesale: !isService && variant.wholesale,
      color: typeof options.color==='string'?options.color:null,
      active: true,
    });
    onNotice(error?error.message:'Variante creada.');
    if(!error){await syncWebPublication(product.id,[...product.commerce_variants,{active:true,available_web:!isService && variant.web}]);setVariant(emptyVariantForm(isService));await load(product.id);void onCatalogChange?.()}
    setProductBusy('');
  };

  const updateVariant = async (item: ProductVariant, form: typeof editingVariantForm) => {
    if (!product) return;
    const priceNum = isService && form.servicePriceMode==='variable' ? 0 : Number(form.price);
    const category = product.category_code||product.category;
    const productAttributes = normalizeCatalogValueMap(product.attributes);
    if ((form.web || form.local) && !hasConfiguredFootwearSizes(taxonomy,category,productAttributes)) { onNotice('Elegí al menos un número de calzado antes de habilitar esta variante.'); return; }
    const missingProduct = (form.web || form.local) && taxonomyRulesForProduct(taxonomy,category,productAttributes,'product').find(rule=>rule.required&&(productAttributes[rule.attribute_code]===undefined||productAttributes[rule.attribute_code]===''));
    if(missingProduct){onNotice(`Antes de habilitarlo en Local o Web completá ${catalogAttributeLabel(taxonomy,missingProduct.attribute_code)}.`);return}
    const missing = variantRules.find(rule=>rule.required&&(form.options[rule.attribute_code]===undefined||form.options[rule.attribute_code]===''));
    if (!form.sku.trim() || (!isService || form.servicePriceMode==='fixed') && !form.price.trim() || !Number.isFinite(priceNum) || ((!isService || form.servicePriceMode==='fixed') && priceNum <= 0) || missing) {
      onNotice(missing?`Completá ${catalogAttributeLabel(taxonomy,missing.attribute_code)}.`:'Completá SKU y un precio válido mayor a 0.');
      return;
    }
    if(!isService && form.wholesale && (!form.priceArg.trim() || !Number.isFinite(Number(form.priceArg)) || Number(form.priceArg) <= 0)){onNotice('Completá un precio ARS válido para Mayorista.');return}
    const options = colorOnlyVariantValues(form.options);
    const signature=optionSignature(options);
    const originalSignature = optionSignature(variantColorValues(item));
    if(signature!==originalSignature&&product.commerce_variants.some(candidate=>candidate.id!==item.id&&optionSignature(variantColorValues(candidate))===signature)){onNotice('Ya existe una variante de ese color.');return}
    setProductBusy(`variant-${item.id}`);
    const { error } = await supabase.from('commerce_variants').update({
      sku: form.sku.trim(),
      name: formatVariantLabel(taxonomy,product.category_code||product.category,options),
      color: typeof options.color==='string'?options.color:null,
      option_values: options,
      available_local: isService || form.local, available_web: !isService && form.web, available_wholesale: !isService && form.wholesale,
      active: form.web ? true : item.active,
      wholesale_price_arg: !isService && form.wholesale ? Number(form.priceArg) : null,
      ...(Math.round(priceNum * 100) !== (item.base_price_minor ?? item.price_minor)
        ? { base_price_minor: Math.round(priceNum * 100) }
        : {}),
    }).eq('id', item.id).eq('product_id', product.id).select('id').single();

    if (error) {
      onNotice(error.message);
    } else {
      onNotice('Variante actualizada.');
      setEditingVariantId(null);
      await syncWebPublication(product.id,product.commerce_variants.map(candidate=>candidate.id===item.id?{...candidate,active:form.web ? true : candidate.active,available_web:!isService && form.web}:candidate));
      await load(product.id);
      void onCatalogChange?.();
    }
    setProductBusy('');
  };

  const toggleVariant = async(item:ProductVariant) => {
    if (!product) return;
    if (hasUnsavedChanges) { onNotice('Guardá o cancelá los cambios pendientes antes de cambiar el estado de la variante.'); return; }
    const publishWeb = !(item.active && item.available_web !== false);
    const active = publishWeb ? true : item.active;
    setProductBusy(`variant-${item.id}`);
    const {error} = await supabase.from('commerce_variants').update({active,available_web:publishWeb}).eq('id',item.id).eq('product_id',product.id);
    onNotice(error ? error.message : `${publishWeb ? 'Variante habilitada en la web.' : 'Variante quitada de la web.'}${item.available_local === false ? '' : ' Sigue disponible en el local.'}`);
    if (!error) { await syncWebPublication(product.id,product.commerce_variants.map(candidate=>candidate.id===item.id?{...candidate,active,available_web:publishWeb}:candidate)); await load(product.id); void onCatalogChange?.(); }
    setProductBusy('');
  };

  const toggleProductAdjustment = async() => {
    if (!product || hasUnsavedChanges) return;
    const enabled = product.apply_catalog_price_adjustment === false;
    setProductBusy('adjustment');
    const {error} = await supabase.from('commerce_products')
      .update({apply_catalog_price_adjustment:enabled})
      .eq('id',product.id).select('id').single();
    onNotice(error ? error.message : enabled ? 'Ajuste activado; precios publicados recalculados.' : 'Ajuste desactivado; se muestran los precios base.');
    if (!error) { await load(product.id); void onCatalogChange?.(); }
    setProductBusy('');
  };

  const removeVariant = async(item:ProductVariant) => {
    if (hasUnsavedChanges) { onNotice('Guardá o cancelá los cambios pendientes antes de eliminar la variante.'); return; }
    if (!product) return;
    setProductBusy(`variant-${item.id}`);
    const usageResult = await supabase.rpc('gestion_catalog_usage',{p_product_id:product.id,p_variant_id:item.id});
    const usage = usageResult.data as CatalogUsage | null;
    if (usageResult.error || !usage) { onNotice(usageResult.error?.message || 'No se pudo revisar el uso de la variante.'); setProductBusy(''); return; }
    if (usage.active_orders > 0) { onNotice(activeOrdersMessage(usage,`la variante “${item.name}” (${item.sku})`)); setProductBusy(''); return; }
    if (!window.confirm(`¿Eliminar la variante “${item.name}” (${item.sku})?

${usageSummary(usage)}`)) { setProductBusy(''); return; }
    const {error} = await supabase.rpc('gestion_delete_catalog_variant',{p_variant_id:item.id});
    onNotice(error?.code === '23503' ? 'La variante ya tiene pedidos activos y no puede eliminarse.' : error?.message || 'Variante eliminada.');
    if (!error) { await syncWebPublication(product.id,product.commerce_variants.filter(candidate=>candidate.id!==item.id)); await load(product.id); void onCatalogChange?.(); }
    setProductBusy('');
  };

  if(taxonomyError) return <div role="alert">No se pudieron cargar las categorías: {taxonomyError}</div>;
  return (
    <section className={`catalog-workspace ${embedded ? 'catalog-workspace-embedded' : ''}`}>
      {showNewProduct && (
        <form className="new-product-panel" onSubmit={event=>void createProduct(event)}>
          <div className="new-product-heading">
            <div><h3>Nuevo producto</h3></div>
            <button type="button" className="secondary-button" onClick={()=>{if(embedded && onCancelNew){onCancelNew();return}setShowNewProduct(false);setNewProduct(EMPTY_PRODUCT_FORM(fixedCategory))}}>Cancelar</button>
          </div>
          <div className="catalog-rule">Un producto tiene una ficha propia. Las variantes solo representan colores; cualquier otro cambio crea otro producto.</div>
          <div className="product-fields">
            <label><div className="field-label">Nombre <div className="field-required" aria-hidden="true">*</div></div><input required autoFocus value={newProduct.name} onChange={event=>setNewProduct({...newProduct,name:event.target.value})} placeholder="Ej.: Imperial clásico"/></label>
            <CatalogProductCoreFields category={newProduct.category} categoryRequired categories={categoryOptions} saleMode={newProduct.saleMode} weight={newProduct.peso} description={newProduct.description} onCategoryChange={category=>setNewProduct({...newProduct,category,attributes:{}})} onSaleModeChange={saleMode=>setNewProduct({...newProduct,saleMode:saleMode as SaleMode})} onWeightChange={value=>setNewProduct({...newProduct,peso:Math.max(0,parseInt(value,10)||0)})} onDescriptionChange={description=>setNewProduct({...newProduct,description})} />
          </div>
          <DynamicAttributeFields taxonomy={taxonomy} category={newProduct.category} scope="product" values={newProduct.attributes} productName={newProduct.name} onChange={attributes=>setNewProduct({...newProduct,attributes})} materials={newProduct.catalogFilters.materials} onMaterialsChange={materials=>setNewProduct(current=>withMaterials(current,materials))}/>
          <div className="form-actions"><button type="submit" disabled={Boolean(productBusy)}>{productBusy === 'create' ? 'Creando…' : 'Crear producto'}</button></div>
        </form>
      )}
      {!embedded && <div className="catalog-index">
        <button className="new-product-button" type="button" onClick={()=>setShowNewProduct(value=>!value)}>{showNewProduct ? 'Cerrar formulario' : '+ Nuevo producto'}</button>
        <label className="catalog-search">
          <div className="sr-only">Buscar en el catálogo</div>
          <Icon name="search"/>
          <input type="search" value={search} onChange={event=>setSearch(event.target.value)} placeholder="Buscar producto, categoría o código" />
        </label>
        <div className="list" aria-label="Productos del catálogo">
        {filteredProducts.map(item => (
          <button key={item.id} className={item.id===selected?'selected':''} onClick={()=>{if (hasUnsavedChanges && !window.confirm('Hay cambios sin guardar. ¿Abrir otro producto?')) return; setSelected(item.id); setEditingVariantId(null); setVariant(emptyVariantForm((item.category_code||item.category)==='servicios'));}}>
            <strong>{item.name}</strong>
            <small>{item.commerce_variants.length} variantes · {item.commerce_product_images?.length || 0} fotos</small>
          </button>
        ))}
        {!filteredProducts.length && <div className="catalog-no-results"><strong>Sin resultados</strong><small>Probá con otra palabra.</small></div>}
        </div>
      </div>}
      {product && (!embedded || !showNewProduct) && (
        <div className="panel">
          <div className="panel-head">
            <div><h3>{product.name}</h3></div>
            <div className="product-actions">
              <button className="danger-button" disabled={Boolean(productBusy)} onClick={()=>void deleteProduct()}>{productBusy === 'delete' ? 'Eliminando…' : 'Eliminar producto'}</button>
              {embedded && <button type="button" className="catalog-close-button" onClick={onClose} aria-label="Cerrar ficha" title="Cerrar ficha"><X size={20} weight="regular" aria-hidden="true"/></button>}
            </div>
          </div>

          <details className="catalog-editor-section" open>
          <summary>Datos del producto</summary>
          <form className="product-details" onSubmit={event=>void saveProduct(event)}>
            <div className="product-fields">
              <label><div className="field-label">Nombre <div className="field-required" aria-hidden="true">*</div></div><input required value={productDetails.name} onChange={event=>setProductDetails({...productDetails,name:event.target.value})}/></label>
              <CatalogProductCoreFields category={productDetails.category} categoryRequired categories={categoryOptions} saleMode={productDetails.saleMode} weight={productDetails.peso} description={productDetails.description} onCategoryChange={category=>setProductDetails({...productDetails,category,attributes:{}})} onSaleModeChange={saleMode=>setProductDetails({...productDetails,saleMode:saleMode as SaleMode})} onWeightChange={value=>setProductDetails({...productDetails,peso:Math.max(0,parseInt(value,10)||0)})} onDescriptionChange={description=>setProductDetails({...productDetails,description})} />
            </div>
            <DynamicAttributeFields taxonomy={taxonomy} category={productDetails.category} scope="product" values={productDetails.attributes} productName={productDetails.name} onChange={attributes=>setProductDetails({...productDetails,attributes})} materials={productDetails.catalogFilters.materials} onMaterialsChange={materials=>setProductDetails(current=>withMaterials(current,materials))}/>
            <div className="form-actions"><button type="submit" disabled={Boolean(productBusy)}>{productBusy === 'save' ? 'Guardando…' : 'Guardar cambios'}</button></div>
          </form>
          </details>

          <details className="catalog-editor-section" open>
          <summary>Imágenes del producto</summary>
          <section className="image-manager">
            <input id={`product-images-${product.id}`} className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" multiple disabled={Boolean(imageBusy)} onChange={event=>void uploadImages(event)}/>
            <div className="image-manager-head">
              <div>
                <div>PNG, JPEG o WebP · Hasta 10 MB.</div>
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
                    <div className="product-image-preview"><img src={productImageUrl(image.storage_path)} alt={image.alt_text || `Foto de ${product.name}`} loading="lazy" style={productCoverStyle(image)}/></div>
                    <figcaption>
                      <div className="image-meta"><strong>{index === 0 ? 'Principal' : `Imagen ${index + 1}`}</strong><div title={image.original_name}>{image.original_name}</div></div>
                      <div className="image-card-actions">
                        <button className="image-cover" type="button" disabled={Boolean(imageBusy)} onClick={()=>setCoverEditorImage(image)}>Ajustar encuadre</button>
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
                <label className={`upload-button ${imageBusy ? 'disabled' : ''}`} htmlFor={`product-images-${product.id}`} aria-disabled={Boolean(imageBusy)}>
                  {imageBusy === 'upload' ? 'Subiendo…' : 'Subir imágenes'}
                </label>
              </div>
            )}
          </section>
          </details>

          {coverEditorImage && (
            <ProductCoverEditor
              key={coverEditorImage.id}
              imageUrl={productImageUrl(coverEditorImage.storage_path)}
              imageAlt={coverEditorImage.alt_text || `Foto de ${product.name}`}
              initialCrop={productCoverCrop(coverEditorImage)}
              busy={imageBusy === coverEditorImage.id}
              onCancel={()=>setCoverEditorImage(null)}
              onSave={crop=>void saveCoverCrop(crop)}
            />
          )}

          <details className="catalog-editor-section" open>
          <summary>Variantes comprables</summary>
          <section className="variants-section">
            {!isService && <div className="variant-intro">
              <label className="variant-adjustment-control" title={hasUnsavedChanges ? 'Guardá primero los cambios del producto' : undefined}>
                <div><strong>Sumar ajuste de Mercado Pago</strong><small>{hasUnsavedChanges ? 'Guardá primero los cambios del producto.' : 'Se aplica al precio publicado de todas las variantes.'}</small></div>
                <input type="checkbox" role="switch" checked={product.apply_catalog_price_adjustment !== false} disabled={Boolean(productBusy) || hasUnsavedChanges} onChange={()=>void toggleProductAdjustment()} />
              </label>
            </div>}
            {isService && <div className="variant-intro">Los servicios se cobran únicamente en el local. El precio puede ser fijo o definirse al registrar la venta.</div>}
            <div className="table-scroll">
              <table className={`catalog-variants-table${showWholesalePriceColumn ? ' catalog-variants-table--with-ars' : ''}`}>
                <colgroup><col className="variant-col-sku" />{variantDefinitions.map(({definition})=><col className="variant-col-option" key={definition.code} />)}<col className="variant-col-price" />{!isService && <col className="variant-col-published" />}{showWholesalePriceColumn && <col className="variant-col-ars" />}<col className="variant-col-status" /><col className="variant-col-actions" /></colgroup>
                <thead><tr><th>SKU</th>{variantDefinitions.map(({definition})=><th key={definition.code}>{definition.label_es}</th>)}<th>{isService ? 'Precio local' : 'Precio UYU'}</th>{!isService && <th>Precio publicado</th>}{showWholesalePriceColumn && <th>Precio ARS</th>}<th>{isService ? 'Estado' : 'Web'}</th><th>Acciones</th></tr></thead><tbody>
                {product.commerce_variants.map(item => {
                  const itemOptions = variantColorValues(item);
                  const webEnabled = item.active && item.available_web !== false;
                  if (editingVariantId !== item.id) {
                    return (
                      <tr key={item.id}>
                        <td data-label="SKU">{item.sku}</td>
                        {variantDefinitions.map(({definition})=><td data-label={definition.label_es} key={definition.code}>{itemOptions[definition.code]!==undefined?catalogValueLabel(taxonomy,definition.code,itemOptions[definition.code] as CatalogValue):'—'}</td>)}
                        <td data-label={isService ? 'Precio local' : 'Precio UYU'}>{isService && (item.base_price_minor ?? item.price_minor) === 0 ? 'A definir en la venta' : money(item.base_price_minor ?? item.price_minor)}</td>
                        {!isService && <td data-label="Precio publicado"><strong>{money(item.price_minor)}</strong></td>}
                        {showWholesalePriceColumn && <td data-label="Precio ARS">{item.available_wholesale && item.wholesale_price_arg ? new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:2}).format(item.wholesale_price_arg) : '—'}</td>}
                        <td data-label={isService ? 'Estado' : 'Web'}><div className={`status-badge ${(isService ? item.active : webEnabled) ? 'status-ready_for_production' : 'status-cancelled'}`}>{isService ? (item.active ? 'Activo' : 'Inactivo') : (webEnabled ? 'En web' : 'Fuera de web')}</div></td>
                        <td data-label="Acciones">
                          <div className="row-actions variant-row-actions">
                            <button className="variant-icon-button secondary-button" type="button" aria-label="Editar" title="Editar variante" disabled={Boolean(productBusy)} onClick={() => { setEditingVariantId(item.id); setEditingVariantForm({ sku: item.sku, price: ((item.base_price_minor ?? item.price_minor) / 100).toString(), priceArg:item.wholesale_price_arg?.toString() || '', options: colorOnlyVariantValues(itemOptions), local: item.available_local !== false, web: webEnabled, wholesale: item.available_wholesale === true, servicePriceMode:isService && (item.base_price_minor ?? item.price_minor)===0?'variable':'fixed' }); }}><PencilSimple size={19} aria-hidden="true" /></button>
                            {!isService && <button className="variant-icon-button secondary-button" type="button" aria-label={webEnabled ? 'Quitar de la web' : 'Publicar en web'} title={webEnabled ? 'Quitar variante de la web' : 'Publicar variante en la web'} disabled={Boolean(productBusy)} onClick={()=>void toggleVariant(item)}><Power size={19} aria-hidden="true" /></button>}
                            <button className="variant-icon-button danger-button" type="button" aria-label="Eliminar" title="Eliminar variante" disabled={Boolean(productBusy)} onClick={()=>void removeVariant(item)}><Trash size={19} aria-hidden="true" /></button>
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
                    <tr className="variant-edit-row" key={item.id}>
                      <td data-label="SKU">
                        <input type="text" placeholder="SKU" value={editingVariantForm.sku} disabled={Boolean(productBusy)} onChange={e => setEditingVariantForm({ ...editingVariantForm, sku: e.target.value })} onKeyDown={handleKeyDown} aria-label="SKU" autoFocus />
                      </td>
                      {variantDefinitions.map(({rule,definition})=><td data-label={definition.label_es} key={definition.code}><TaxonomyValueField compact definition={definition} taxonomy={taxonomy} value={editingVariantForm.options[definition.code]} required={rule.required} onChange={value=>{const options={...editingVariantForm.options};if(value===undefined)delete options[definition.code];else options[definition.code]=value;setEditingVariantForm({...editingVariantForm,options})}}/></td>)}
                      <td data-label={isService ? 'Precio local' : 'Precio UYU'}>
                        {isService && <label>Tipo de precio<select value={editingVariantForm.servicePriceMode} disabled={Boolean(productBusy)} onChange={event=>setEditingVariantForm({...editingVariantForm,servicePriceMode:event.target.value as VariantForm['servicePriceMode']})}><option value="fixed">Fijo</option><option value="variable">A definir en la venta</option></select></label>}
                        {(!isService || editingVariantForm.servicePriceMode==='fixed') &&
                        <div className="variant-edit-price">
                          <span>$</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            value={editingVariantForm.price}
                            disabled={Boolean(productBusy)}
                            onChange={e => setEditingVariantForm({ ...editingVariantForm, price: e.target.value })}
                            onKeyDown={handleKeyDown}
                            aria-label="Precio"
                          />
                        </div>}
                      </td>
                      {!isService && <td data-label="Precio publicado"><div className="field-help">Se recalcula al guardar</div></td>}
                      {showWholesalePriceColumn && <td data-label="Precio ARS">{editingVariantForm.wholesale ? <div className="variant-edit-price"><span>$</span><input type="number" step="0.01" min="0.01" required value={editingVariantForm.priceArg} disabled={Boolean(productBusy)} onChange={e => setEditingVariantForm({...editingVariantForm,priceArg:e.target.value})} onKeyDown={handleKeyDown} aria-label="Precio ARS" /></div> : '—'}</td>}
                      <td data-label={isService ? 'Estado' : 'Web'}>
                        <div className={`status-badge ${(isService ? item.active : webEnabled) ? 'status-ready_for_production' : 'status-cancelled'}`}>
                          {isService ? (item.active ? 'Activo' : 'Inactivo') : (webEnabled ? 'En web' : 'Fuera de web')}
                        </div>
                      </td>
                      <td data-label="Acciones">
                        <div className="row-actions variant-row-actions variant-edit-actions">
                          <button
                            className="variant-icon-button"
                            type="button"
                            aria-label={productBusy === `variant-${item.id}` ? 'Guardando…' : 'Guardar'}
                            title="Guardar variante"
                            disabled={Boolean(productBusy)}
                            onClick={() => void updateVariant(item, editingVariantForm)}
                          >
                            <FloppyDisk size={19} aria-hidden="true" />
                          </button>
                          <button
                            className="variant-icon-button secondary-button"
                            type="button"
                            aria-label="Cancelar"
                            title="Cancelar edición"
                            disabled={Boolean(productBusy)}
                            onClick={() => setEditingVariantId(null)}
                          >
                            <X size={19} aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!product.commerce_variants.length&&<tr><td className="empty-table" colSpan={variantDefinitions.length+4+(!isService ? 1 : 0)+(showWholesalePriceColumn ? 1 : 0)}>Este producto todavía no tiene variantes.</td></tr>}
              </tbody></table>
            </div>
            {editingVariantId && !isService && <CatalogVariantDetails channels={{ Local: editingVariantForm.local, Web: editingVariantForm.web, Mayorista: editingVariantForm.wholesale }} onChannelChange={(channel, checked) => setEditingVariantForm(current => ({ ...current, [channel === 'Local' ? 'local' : channel === 'Web' ? 'web' : 'wholesale']: checked }))} disabled={Boolean(productBusy)} />}
          </section>
          <form className="variant-create" onSubmit={event=>void createVariant(event)}>
            <h4>Nueva variante</h4>
            <div className="variant-create-fields">
              <label><div className="field-label">SKU</div><input inputMode="numeric" placeholder={nextSku} value={variant.sku} onChange={e=>setVariant({...variant,sku:e.target.value})}/></label>
              <DynamicAttributeFields taxonomy={taxonomy} category={product.category_code||product.category} scope="variant" values={variant.options} onChange={options=>setVariant({...variant,options})}/>
              {isService && <label>Tipo de precio<select value={variant.servicePriceMode} onChange={e=>setVariant({...variant,servicePriceMode:e.target.value as VariantForm['servicePriceMode']})}><option value="fixed">Fijo</option><option value="variable">A definir en la venta</option></select></label>}
              {(!isService || variant.servicePriceMode==='fixed') && <label><div className="field-label">{isService ? 'Precio local UYU' : 'Precio base UYU'} <div className="field-required" aria-hidden="true">*</div></div><input required type="number" min="1" step="0.01" value={variant.price} onChange={e=>setVariant({...variant,price:e.target.value})}/></label>}
              {!isService && variant.wholesale && <label><div className="field-label">Precio ARS <div className="field-required" aria-hidden="true">*</div></div><input required type="number" min="0.01" step="0.01" value={variant.priceArg} onChange={e=>setVariant({...variant,priceArg:e.target.value})}/></label>}
            </div>
            {!isService && <CatalogVariantDetails channels={{ Local: variant.local, Web: variant.web, Mayorista: variant.wholesale }} onChannelChange={(channel, checked) => setVariant(current => ({ ...current, [channel === 'Local' ? 'local' : channel === 'Web' ? 'web' : 'wholesale']: checked }))} disabled={Boolean(productBusy)} />}
            <div className="variant-create-footer"><button disabled={Boolean(productBusy)}>{productBusy === 'variant-create' ? 'Creando…' : 'Crear variante'}</button></div>
          </form>
          </details>
        </div>
      )}
    </section>
  );
}

type CatalogListProduct = Pick<Product, 'id' | 'name' | 'category' | 'category_code' | 'attributes' | 'catalog_filters' | 'commerce_variants'>;
type CatalogListRow = CatalogListProduct & { material:string; color:string; variant:ProductVariant|null };

export function CatalogList({onNotice,onEdit}:{onNotice:(v:string)=>void;onEdit?:(id:string)=>void}) {
  const [products,setProducts] = useState<CatalogListProduct[]>([]);
  const [sortColumn, setSortColumn] = useState<'sku' | 'price' | null>('sku');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const load = useCallback(async() => {
    const selection = 'id,name,category,category_code,attributes,catalog_filters,commerce_variants(id,sku,name,price_minor,active,color,weight_grams,option_values)';
    const legacySelection = 'id,name,category,commerce_variants(id,sku,name,price_minor,active,color)';
    let {data,error}:{data:unknown;error:{message:string;code?:string}|null} = await readEditorProducts(selection,true);
    if (error && (error.code === '42703' || /category_code|attributes|option_values|catalog_filters/i.test(error.message))) {
      ({data,error} = await readEditorProducts(legacySelection,true));
    }
    if (error) {
      onNotice(`No se pudo cargar la lista: ${error.message}`);
      return;
    }
    setProducts(((data || []) as CatalogListProduct[]).sort((a, b) => a.name.localeCompare(b.name, 'es')));
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
          <img src="/matearte-icon.png" alt="MateArte" className="print-logo" />
          <div>
            <h2>MateArte</h2>
            <div className="print-subtitle">Lista de Precios</div>
          </div>
        </div>
        <div className="print-meta">
          <div><div>Fecha:</div> <strong>{formatDate(new Date())}</strong></div>
          {categoryFilter !== 'all' && (
            <div><div>Categoría:</div> <strong>{catalogCategoryLabels[categoryFilter] || categoryFilter}</strong></div>
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
          <div>Imprimir</div>
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
                <div>SKU</div>
                <div className="no-print" style={{ fontSize: '0.85rem', color: sortColumn === 'sku' ? 'var(--green-800)' : '#8a9990' }}>
                  {sortColumn === 'sku' ? (sortDirection === 'asc' ? 'Ascendente' : 'Descendente') : ''}
                </div>
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
                <div>Precio</div>
                <div className="no-print" style={{ fontSize: '0.85rem', color: sortColumn === 'price' ? 'var(--green-800)' : '#8a9990' }}>
                  {sortColumn === 'price' ? (sortDirection === 'asc' ? 'Ascendente' : 'Descendente') : ''}
                </div>
              </div>
            </th>
            {onEdit && <th>Acciones</th>}
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
            {onEdit && <td><button type="button" className="secondary-button compact-button" onClick={()=>onEdit(row.id)}>Editar</button></td>}
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
  { value: 'Copay', label: 'Copay', group: 'national' },
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
  return isLocalhost ? '/commerce-api' : 'https://www.matearteuruguay.com';
}

function OrderDeliverySummary({order,compact=false}:{order:Order;compact?:boolean}) {
  const details = getOrderDeliveryDetails(order);
  const locality = [details.city,details.department].filter((value,index,all)=>value&&all.indexOf(value)===index).join(', ');
  return <section className={`order-delivery-summary${compact?' order-delivery-summary--compact':''}`} aria-label="Datos de entrega">
    <div className="order-delivery-summary__heading">
      <div><small>Entrega</small><strong>{details.methodLabel}</strong></div>
      {details.zone&&<div>{details.zone}</div>}
    </div>
    <div className="order-delivery-grid">
      <div>
        <small>Cliente</small>
        <strong>{details.contactName}</strong>
        {details.phoneInfo ? <OrderContactPhone prefix={details.phoneInfo.prefix} number={details.phoneInfo.number || details.phone} country={details.phoneInfo.country} whatsappDigits={details.phoneInfo.whatsappDigits} /> : details.phone ? <div>{details.phone}</div> : null}
        {details.email&&<div>{details.email}</div>}
      </div>
      <div>
        <small>{details.isPickup?'Modalidad':'Enviar a'}</small>
        {details.isPickup
          ? <strong>Retiro: no requiere despacho</strong>
          : <address>
              <strong className={details.address?'':'missing-delivery-data'}>{details.address||'Dirección no disponible'}</strong>
              {locality&&<div>{locality}</div>}
              {details.country&&<div>{details.country}</div>}
            </address>}
      </div>
    </div>
  </section>;
}

export function Orders({session,onNotice,orderId,onClose,onCustomer,catalogProducts=[],onProduct,paymentProvider}:{session:Session;onNotice:(v:string)=>void;orderId?:string;onClose?:()=>void;onCustomer?:()=>void;catalogProducts?:Pick<CatalogProduct,'id'|'sku'|'sourceProductId'|'wholesaleProductId'>[];onProduct?:(productId:string,variantId:string)=>void;paymentProvider?:string}) {
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
  const [receiptPreview,setReceiptPreview] = useState<{url:string;mimeType:string;name:string}|null>(null);
  const [receiptLoading,setReceiptLoading] = useState(false);
  const [receiptError,setReceiptError] = useState('');
  const detailTriggerRef = useRef<HTMLElement|null>(null);
  const [search,setSearch] = useState(() => {
    if (typeof window === 'undefined') return '';
    const params = new URLSearchParams(window.location.search);
    return params.get('q') || params.get('search') || params.get('order') || '';
  });
  const load = useCallback(async() => {
    let {data,error}:{data:unknown;error:{message:string;code?:string}|null} = await supabase
      .from('orders')
      .select('id,order_number,reference_code,status,peso,shipping_method,shipping_snapshot,shipping_carrier,tracking_code,shipped_at,items_subtotal_minor,shipping_minor,payment_fee_minor,payment_method,discount_code,discount_minor,total_minor,currency,paypal_amount_usd_minor,created_at,customer_snapshot,commerce_bank_transfer_receipts(id,original_name,mime_type,byte_size,status,rejection_reason,submitted_at,reviewed_at),order_items(id,item_type,sku,title,quantity,unit_price_minor,total_minor,source_variant_id,requires_review,review_status,immutable_snapshot,source_variant:commerce_variants(product:commerce_products(peso)))')
      .not('channel','in',INTERNAL_ORDER_CHANNELS)
      .order('created_at',{ascending:false})
      .limit(orderId ? 1 : 100).match(orderId ? { id: orderId } : {});
    if (error && (error.code === '42703' || /peso|source_variant/i.test(error.message))) {
      ({data,error} = await supabase
        .from('orders')
        .select('id,order_number,reference_code,status,shipping_method,shipping_snapshot,shipping_carrier,tracking_code,shipped_at,items_subtotal_minor,shipping_minor,payment_fee_minor,payment_method,discount_code,discount_minor,total_minor,currency,paypal_amount_usd_minor,created_at,customer_snapshot,commerce_bank_transfer_receipts(id,original_name,mime_type,byte_size,status,rejection_reason,submitted_at,reviewed_at),order_items(id,item_type,sku,title,quantity,unit_price_minor,total_minor,source_variant_id,requires_review,review_status,immutable_snapshot)')
        .not('channel','in',INTERNAL_ORDER_CHANNELS)
        .order('created_at',{ascending:false})
        .limit(orderId ? 1 : 100).match(orderId ? { id: orderId } : {}));
    }
    if (error) onNotice(`No se pudieron cargar los pedidos: ${error.message}`);
    const normalizedOrders = ((data || []) as SupabaseOrder[]).map((order):Order=>({
      ...order,
      commerce_bank_transfer_receipts:normalizeBankTransferReceipts(order.commerce_bank_transfer_receipts),
    }));
    const confirmedOrders = normalizedOrders.filter((order) => {
      const isPayPalCheckout = textValue(order.customer_snapshot.purchaseFlow) === 'international_paypal';
      return !isPayPalCheckout || !['pending_payment', 'payment_failed', 'cancelled'].includes(order.status);
    });
    setOrders(confirmedOrders);
  },[onNotice]);
  useEffect(()=>{void load()},[load]);
  useEffect(()=>{let active=true;void loadCatalogTaxonomy().then(value=>{if(active)setTaxonomy(value)}).catch(error=>onNotice(`No se pudieron cargar los atributos: ${error.message}`));return()=>{active=false}},[]);

  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase().replace(/^#/, '');
    return orders.filter(o => {
      if (!q) return true;
      const orderNum = String(o.order_number);
      const customer = orderCustomer(o.customer_snapshot).toLowerCase();
      const email = textValue(o.customer_snapshot.email).toLowerCase();
      const status = orderStatus(o.status).toLowerCase();
      const tracking = (o.tracking_code || '').toLowerCase();
      const id = o.id.toLowerCase();
      return orderNum.includes(q) || (o.reference_code || '').toLowerCase().includes(search.trim().toLowerCase()) || customer.includes(q) || email.includes(q) || status.includes(q) || tracking.includes(q) || id.includes(q);
    });
  }, [orders, search]);

  const review = async(id:string,decision:'approve'|'reject') => {
    const reason = decision === 'reject' ? window.prompt('Indicá el motivo del rechazo y reembolso:')?.trim() || '' : '';
    if (decision === 'reject' && !reason) return;
    setBusy(id);
    try {
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
        onNotice(response.ok ? value.message || 'Pedido actualizado.' : value.error || 'No se pudo actualizar.');
        if (response.ok) await load();
    } catch (err) {
      onNotice(decision === 'approve'
        ? (err instanceof Error ? `No se pudo aprobar el pedido: ${err.message}` : 'No se pudo aprobar el pedido.')
        : (err instanceof Error ? err.message : 'No se pudo conectar con el servicio de pedidos.'));
    } finally {
      setBusy('');
    }
  };

  const loadReceiptPreview = async(order:Order) => {
    if (!order.commerce_bank_transfer_receipts?.length) return;
    setReceiptPreview(null);
    setReceiptError('');
    setReceiptLoading(true);
    try {
      const response = await fetch(`${getStoreApiUrl()}/api/admin/orders/${order.id}/bank-transfer`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const value = await response.json();
      if (!response.ok) throw new Error(value.error || 'No se pudo abrir el comprobante.');
      setReceiptPreview({
        url: String(value.signedUrl),
        mimeType: String(value.receipt?.mime_type || ''),
        name: String(value.receipt?.original_name || 'Comprobante'),
      });
    } catch (error) {
      setReceiptError(error instanceof Error ? error.message : 'No se pudo abrir el comprobante.');
    } finally {
      setReceiptLoading(false);
    }
  };

  const reviewBankTransfer = async(order:Order,decision:'approve'|'reject') => {
    const reason = decision === 'reject' ? window.prompt('Indicá el motivo del rechazo:')?.trim() || '' : '';
    if (decision === 'reject' && reason.length < 5) {
      if (reason) onNotice('El motivo debe tener al menos 5 caracteres.');
      return;
    }
    const argentinaTransfer = order.customer_snapshot.purchaseFlow === 'argentina_retail_transfer';
    const confirmation = argentinaTransfer ? (decision === 'approve' ? '¿Confirmás que recibiste la transferencia en ARS? El pedido quedará pagado.' : '¿Rechazar el comprobante? El cliente podrá adjuntar otro en el mismo pedido.') : decision === 'approve'
      ? '¿Confirmás que la transferencia fue recibida? El pedido quedará pagado y pasará a producción.'
      : '¿Confirmás el rechazo? El pedido se cancelará y el cliente deberá crear uno nuevo.';
    if (!window.confirm(confirmation)) return;
    setBusy(order.id);
    try {
      const response = await fetch(`${getStoreApiUrl()}/api/admin/orders/${order.id}/bank-transfer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({decision,reason}),
      });
      const value = await response.json();
      if (!response.ok) throw new Error(value.error || 'No se pudo revisar el comprobante.');
      onNotice(argentinaTransfer ? (decision === 'approve' ? 'Transferencia en ARS aprobada.' : 'Comprobante rechazado; el cliente puede adjuntar otro.') : decision === 'approve' ? 'Transferencia aprobada; el pedido pasó a producción.' : 'Comprobante rechazado y pedido cancelado.');
      setDetailOrder(null);
      setReceiptPreview(null);
      await load();
    } catch (error) {
      onNotice(error instanceof Error ? error.message : 'No se pudo revisar el comprobante.');
    } finally {
      setBusy('');
    }
  };

  const deliverPickup = async(order:Order) => {
    if (!window.confirm('¿Confirmás que el cliente retiró este pedido? También quedará terminado en Producción.')) return;
    setBusy(order.id);
    try {
      if (textValue(order.customer_snapshot.purchaseFlow) === 'wholesale_bank_transfer') {
        const { data, error } = await supabase.from('orders')
          .update({ status: 'delivered', delivered_at: new Date().toISOString() })
          .eq('id', order.id).eq('status', order.status).select('id').maybeSingle();
        if (error) throw error;
        if (!data) throw new Error('El pedido cambió mientras lo actualizabas. Recargá e intentá de nuevo.');
      } else {
        const response = await fetch(`${getStoreApiUrl()}/api/admin/orders/${order.id}/fulfillment`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ action: 'deliver' }),
        });
        const value = await response.json();
        if (!response.ok) throw new Error(value.error || 'No se pudo marcar el pedido como entregado.');
      }
      onNotice('Pedido marcado como entregado y producción terminada.');
      setDetailOrder(null);
      await load();
    } catch (error) {
      onNotice(error instanceof Error ? error.message : 'No se pudo marcar el pedido como entregado.');
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

        const isWholesaleBankTransfer = textValue(order.customer_snapshot.purchaseFlow) === 'wholesale_bank_transfer';
        if (isWholesaleBankTransfer) {
          const shippedAt = order.status === 'shipped' && order.shipped_at ? order.shipped_at : new Date().toISOString();
          const { error } = await supabase
            .from('orders')
            .update({ status: 'shipped', shipping_carrier: carrier, tracking_code: tracking, shipped_at: shippedAt })
            .eq('id', order.id).select('id').single();
          if (error) {
            setShipmentError(`No se pudo actualizar el envío: ${error.message}`);
            return false;
          }
        } else {
          const response = await fetch(`${getStoreApiUrl()}/api/admin/orders/${order.id}/fulfillment`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
            body: JSON.stringify({ action: 'ship', shippingCarrier: carrier, trackingCode: tracking }),
          });
          const value = await response.json();
          if (!response.ok) {
            setShipmentError(value.error || 'No se pudo actualizar el envío.');
            return false;
          }
        }

        onNotice(order.status === 'shipped' ? 'Datos de envío actualizados.' : isWholesaleBankTransfer ? 'Pedido marcado como enviado.' : 'Pedido marcado como enviado. Aviso por correo en proceso.');
        await load();
        return true;
      }

      if (action === 'restore') {
        const hasCustomItem = order.order_items?.some(item => item.requires_review) ?? false;
        const hasRejectedItem = order.order_items?.some(item => item.requires_review && item.review_status === 'rejected') ?? false;
        const hasPendingReview = order.order_items?.some(item => item.requires_review && item.review_status !== 'approved') ?? false;
        const restoredStatus = order.shipping_method === 'international_coordination'
          ? 'manual_review'
          : hasRejectedItem ? 'manual_review'
          : hasPendingReview ? 'paid_pending_review'
          : hasCustomItem
            ? 'ready_for_production'
            : 'ready_for_fulfillment';

        const { error } = await supabase
          .from('orders')
          .update({
            status: restoredStatus,
            shipped_at: null,
            delivered_at: null,
          })
          .eq('id', order.id).select('id').single();

        if (error) {
          onNotice(`No se pudo restaurar el pedido: ${error.message}`);
          return false;
        }

        onNotice('Pedido devuelto a preparación.');
        setDetailOrder(null);
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
    setSelectedCarrier(!order.shipping_carrier && order.customer_snapshot.purchaseFlow === "argentina_retail_transfer" ? "__other__" : resolved.selectedCarrier);
    setCustomCarrier(resolved.customCarrier);
    setShippingCarrier(resolved.shippingCarrier);
    setTrackingCode(order.tracking_code||'');
    setShipmentError('');
  };

  const openDetails = (order:Order) => {
    detailTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setDetailOrder(order);
    setReceiptPreview(null);
    setReceiptError('');
    if (order.commerce_bank_transfer_receipts?.length) void loadReceiptPreview(order);
  };

  useEffect(() => {
    if (!orderId) return;
    const target = orders.find(order => order.id === orderId);
    if (target) openDetails(target);
  }, [orders, orderId]);

  const closeDetails = () => {
    onClose?.();
    setDetailOrder(null);
    setReceiptPreview(null);
    setReceiptError('');
    window.requestAnimationFrame(()=>detailTriggerRef.current?.focus());
  };

  const closeShipment = () => {
    if (shipmentOrder && busy === shipmentOrder.id) return;
    setShipmentOrder(null);
    setShipmentError('');
    onClose?.();
  };

  useEffect(() => {
    if (!shipmentOrder) return;
    const onKeyDown = (event:KeyboardEvent) => { if (event.key === 'Escape') closeShipment(); };
    window.addEventListener('keydown',onKeyDown);
    return () => window.removeEventListener('keydown',onKeyDown);
  },[shipmentOrder,busy]);

  const detailCategories = detailOrder ? Array.from(new Set(detailOrder.order_items.map(item => {
    const snapshot = recordValue(item.immutable_snapshot);
    const product = recordValue(snapshot.product);
    const category = snapshotValue(product,'category_code','categoryCode','category') || snapshotValue(snapshot,'category_code','categoryCode','category');
    if (category) return purchaseCategoryLabel(category,item.title);
    const name = getOrderItemDisplayName(item).toLocaleLowerCase('es');
    if (item.item_type === 'design') return 'Personalizados';
    if (name.includes('matera')) return 'Materas';
    if (name.includes('mate')) return 'Mates';
    return '';
  }).filter(Boolean))).join(', ') || 'Sin categoría' : '';
  const detailPayment = detailOrder?.status === 'pending_payment' ? 'Pendiente de pago'
    : detailOrder?.status === 'payment_verification_pending' ? 'Por verificar'
    : detailOrder?.status === 'payment_failed' ? 'Pago fallido'
    : detailOrder?.status === 'cancelled' ? 'Cancelado'
    : detailOrder?.status === 'refunded' ? 'Reembolsado' : 'Pagado';
  const detailProduction = detailOrder?.order_items.some(item => item.requires_review)
    ? detailOrder.status === 'ready_for_production' ? 'En producción'
      : ['ready_for_fulfillment','shipped','delivered'].includes(detailOrder.status) ? 'Completada'
      : 'Requiere revisión'
    : 'No aplica';
  const detailItemsSubtotal = detailOrder
    ? Number(detailOrder.items_subtotal_minor ?? detailOrder.order_items.reduce((sum,item) => sum + getItemPricing(item).totalMinor,0))
    : 0;
  const detailItemRows: OrderDetailRow[] = detailOrder?.order_items.map(item => {
    const isDesign = item.item_type === 'design';
    const isCustom = isDesign || Boolean(item.requires_review);
    const options = !isDesign ? getCatalogOrderOptionDetails(item, taxonomy) : [];
    const size = orderSizeLabel(options.find(option => ['tamano', 'talle'].includes(option.attribute))?.value || '');
    const extra = options.filter(option => !['color', 'tamano', 'talle', 'peso', 'weight', 'weight_grams'].includes(option.attribute));
    const weight = isDesign ? 0 : getOrderItemWeight(item);
    const sku = isDesign ? '' : getItemSku(item);
    const catalogProduct = !isDesign && onProduct ? catalogProducts.find(product => !product.wholesaleProductId && product.id === item.source_variant_id)
      || catalogProducts.find(product => !product.wholesaleProductId && product.sku === sku && Boolean(sku)) : undefined;
    return {
      id: item.id,
      name: getOrderItemDisplayName(item),
      sku,
      onOpen: catalogProduct ? () => onProduct?.(catalogProduct.sourceProductId || catalogProduct.id, catalogProduct.id) : undefined,
      color: orderColorLabel(options.find(option => option.attribute === 'color')?.value || ''),
      size,
      weight: weight > 0 ? formatWeight(weight) : undefined,
      quantity: item.quantity,
      amount: money(getItemPricing(item).totalMinor,detailOrder?.currency),
      extra: [isCustom ? 'Personalizado' : '', ...extra.map(option => `${option.label}: ${option.value}`)].filter(Boolean).join(' · '),
    };
  }) || [];

  const detailDelivery = detailOrder ? getOrderDeliveryDetails(detailOrder) : null;
  const detailView: OrderDetailView | null = detailOrder && detailDelivery ? {
    reference: detailOrder.reference_code || `#${detailOrder.order_number}`,
    date: formatDate(detailOrder.created_at), channel: 'Web',
    shipping: detailOrder.status === 'delivered' ? 'Entregado' : detailOrder.shipping_method === 'pickup' ? 'Retiro' : detailOrder.status === 'shipped' ? 'Enviado' : 'No enviado',
    customer: orderCustomer(detailOrder.customer_snapshot), products: detailCategories,
    payment: detailPayment, paymentNote: orderStatus(detailOrder.status), production: detailProduction,
    delivery: {
      method: detailDelivery.methodLabel,
      paymentMethod: detailOrder.payment_method && detailOrder.payment_method !== 'Seña' ? detailOrder.payment_method
        : ['mercadopago', 'mercado_pago'].includes(paymentProvider || '') ? 'Mercado Pago'
        : paymentProvider === 'paypal' || detailOrder.paypal_amount_usd_minor != null ? 'PayPal'
        : detailOrder.commerce_bank_transfer_receipts?.length ? 'Transferencia' : 'No registrado',
      customer: detailDelivery.contactName,
      phone: detailDelivery.phoneInfo
        ? <OrderContactPhone prefix={detailDelivery.phoneInfo.prefix} number={detailDelivery.phoneInfo.number || detailDelivery.phone} country={detailDelivery.phoneInfo.country} whatsappDigits={detailDelivery.phoneInfo.whatsappDigits} />
        : detailDelivery.phone || undefined,
      email: detailDelivery.email, address: detailDelivery.address,
      locality: [detailDelivery.city, detailDelivery.department].filter((value,index,all) => value && all.indexOf(value) === index).join(', '),
      country: detailDelivery.country, zone: detailDelivery.zone, pickup: detailDelivery.isPickup,
    },
    rows: detailItemRows,
    receipt: detailOrder.commerce_bank_transfer_receipts?.[0] ? <section className="bank-receipt-card" aria-labelledby="bank-receipt-title">
      <div className="order-detail-section-heading">
        <div><h3 id="bank-receipt-title">Comprobante de pago</h3></div>
        <div className={`receipt-status receipt-status--${detailOrder.commerce_bank_transfer_receipts[0].status}`}>{detailOrder.commerce_bank_transfer_receipts[0].status==='pending'?'Pendiente':detailOrder.commerce_bank_transfer_receipts[0].status==='approved'?'Aprobado':'Rechazado'}</div>
      </div>
      <div>{detailOrder.commerce_bank_transfer_receipts[0].original_name} · {(detailOrder.commerce_bank_transfer_receipts[0].byte_size/1024/1024).toFixed(2)} MB</div>
      {receiptLoading && <div className="receipt-loading" role="status">Cargando comprobante…</div>}
      {receiptError && <div className="modal-error" role="alert">{receiptError}</div>}
      {receiptPreview && (receiptPreview.mimeType === 'application/pdf'
        ? <iframe className="receipt-preview receipt-preview--pdf" src={receiptPreview.url} title={`Comprobante ${receiptPreview.name}`}/>
        : <img className="receipt-preview receipt-preview--image" src={receiptPreview.url} alt={`Comprobante ${receiptPreview.name}`}/>)}
      {detailOrder.commerce_bank_transfer_receipts[0].rejection_reason && <div className="receipt-rejection"><strong>Motivo del rechazo:</strong> {detailOrder.commerce_bank_transfer_receipts[0].rejection_reason}</div>}
      {!receiptLoading && <button type="button" className="secondary-button receipt-refresh" onClick={() => void loadReceiptPreview(detailOrder)}>{receiptPreview?'Renovar acceso':'Abrir comprobante'}</button>}
    </section> : undefined,
    totals: <>
      {detailOrder.currency === "ARS" && <div className="data-note">Envío dentro de Argentina a cargo del destinatario. No incluido en el total.</div>}
      {(Number(detailOrder.discount_minor) > 0 || Number(detailOrder.shipping_minor) > 0 || Number(detailOrder.payment_fee_minor) > 0) && <div className="line-item"><div>Subtotal</div><strong>{money(detailItemsSubtotal,detailOrder.currency)}</strong></div>}
      {Number(detailOrder.discount_minor) > 0 && <div className="line-item"><div>Descuento{detailOrder.discount_code ? ` · ${detailOrder.discount_code}` : ''}</div><strong>−{money(Number(detailOrder.discount_minor),detailOrder.currency)}</strong></div>}
      {Number(detailOrder.shipping_minor) > 0 && <div className="line-item"><div>Envío</div><strong>{money(Number(detailOrder.shipping_minor),detailOrder.currency)}</strong></div>}
      {Number(detailOrder.payment_fee_minor) > 0 && <div className="line-item"><div>Cargos</div><strong>{money(Number(detailOrder.payment_fee_minor),detailOrder.currency)}</strong></div>}
      <div className="line-item"><div>Total {detailOrder.currency || "UYU"}</div><strong>{money(detailOrder.total_minor,detailOrder.currency)}</strong></div>
      {detailOrder.paypal_amount_usd_minor != null && <div className="line-item"><div>Importe de compra PayPal</div><strong>{usdMoney(detailOrder.paypal_amount_usd_minor / 100)}</strong></div>}
      {detailOrder.status === 'manual_review' && detailOrder.order_items.some(item => item.review_status === 'rejected') && <div className="data-note">Reembolso pendiente de confirmación. Si pagó por transferencia, requiere devolución manual.</div>}
    </>,
    tracking: detailOrder.status === 'shipped' ? { carrier: detailOrder.shipping_carrier || '', code: detailOrder.tracking_code || '' } : undefined,
  } : null;

  return (
    <>
      <section className="data-panel" aria-label="Listado de pedidos">
        <div className="orders-toolbar">
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
            <thead><tr><th>Pedido</th><th>Fecha</th><th>Cliente</th><th>Detalle</th><th>Entrega</th><th>Estado</th><th className="numeric">Peso</th><th className="numeric">Total</th><th>Acciones</th></tr></thead>
            <tbody>
              {filteredOrders.map(order => {
                const destination = order.shipping_method==='international_coordination'
                  ? [textValue(order.shipping_snapshot.city),textValue(order.shipping_snapshot.country)].filter(Boolean).join(', ') || 'Exterior'
                  : order.shipping_method === 'pickup' ? 'Retiro' : 'Envío';
                const canFulfill = ['paid_pending_review', 'ready_for_fulfillment', 'ready_for_production', 'manual_review'].includes(order.status);
                const canShip = order.shipping_method !== 'pickup' && canFulfill;
                const canDeliver = order.shipping_method === 'pickup' && canFulfill;
                return <tr key={order.id} id={`order-${order.order_number}`} className={order.status==='payment_verification_pending'?'bank-transfer-pending-row':undefined}>
                  <td><button type="button" className="order-detail-trigger" onClick={()=>openDetails(order)} aria-label={`Ver detalle del pedido ${order.reference_code || `#${order.order_number}`}`}>{order.reference_code || `#${order.order_number}`}</button></td>
                  <td>{formatDate(order.created_at)}</td>
                  <td>{orderCustomer(order.customer_snapshot)}</td>
                  <td className="order-items-cell">{order.order_items.length?<div className="order-items-summary">{order.order_items.map(item=>{const options=getCatalogOrderOptionDetails(item,taxonomy);const name=getOrderItemDisplayName(item);return options.length?<details className="commerce-order-item-disclosure" key={item.id}><summary>{name} <span>×{item.quantity}</span></summary><small>{options.map(option=>`${option.label}: ${option.value}`).join(' · ')}</small></details>:<div key={item.id}><strong>{name} <span>×{item.quantity}</span></strong></div>})}</div>:'Sin artículos'}</td>
                  <td><strong>{destination}</strong>{order.status==='shipped'&&<small className="tracking-summary">{order.shipping_carrier} · {order.tracking_code}</small>}</td>
                  <td><div className={`status-badge status-${order.status}`}>{orderStatus(order.status)}</div></td>
                  <td className="numeric"><div>{formatWeight(getOrderTotalWeight(order))}</div></td>
                  <td className="numeric"><strong>{money(order.total_minor,order.currency)}{order.paypal_amount_usd_minor != null && <small> · {usdMoney(order.paypal_amount_usd_minor / 100)}</small>}</strong></td>
                  <td><div className="row-actions">
                    <button className="compact-button secondary-button" type="button" onClick={()=>openDetails(order)}>Ver detalle</button>
                    {order.status==='payment_verification_pending'&&<button className="compact-button" type="button" onClick={()=>openDetails(order)}>Revisar comprobante</button>}
                    {order.status==='paid_pending_review'&&<><button className="compact-button" disabled={busy===order.id} onClick={()=>void review(order.id,'approve')}>{busy===order.id?'Procesando…':'Aprobar'}</button><button className="compact-button danger" disabled={busy===order.id} onClick={()=>void review(order.id,'reject')}>Rechazar</button></>}
                    {canShip&&<button className="compact-button" disabled={busy===order.id} onClick={()=>openShipment(order)}>Marcar enviado</button>}
                    {canDeliver&&<button className="compact-button" disabled={busy===order.id} onClick={()=>void deliverPickup(order)}>Marcar entregado</button>}
                    {order.status==='shipped'&&<><button className="compact-button secondary-button" disabled={busy===order.id} onClick={()=>openShipment(order)}>Editar envío</button><button className="compact-button secondary-button" disabled={busy===order.id} onClick={()=>{if(window.confirm('¿Querés volver este pedido a preparación? El cliente dejará de verlo como enviado.'))void updateFulfillment(order,'restore')}}>{busy===order.id?'Procesando…':order.shipping_method==='international_coordination'||order.order_items.some(item=>item.requires_review&&item.review_status!=='approved')?'Volver a revisión':order.order_items.some(item=>item.requires_review)?'Volver a producción':'Volver a preparación'}</button></>}
                    {order.status==='delivered'&&<button className="compact-button secondary-button" disabled={busy===order.id} onClick={()=>{if(window.confirm('¿Querés volver este pedido a preparación? El cliente dejará de verlo como entregado.'))void updateFulfillment(order,'restore')}}>Volver a preparación</button>}
                  </div></td>
                </tr>;
              })}
              {!filteredOrders.length && <tr><td className="empty-table" colSpan={9}>{search ? `No se encontraron pedidos con "${search}".` : 'Todavía no hay pedidos.'}</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {detailOrder && detailView && <Modal title="Detalle del pedido" className="order-detail-modal unified-order-modal" onClose={closeDetails}>
          <OrderDetailContent detail={detailView}/>
            <div className="form-actions unified-order-actions">
              <button type="button" className="unified-order-action" autoFocus onClick={closeDetails}>Cerrar</button>
              {onCustomer && <button type="button" className="unified-order-action" onClick={onCustomer}>Ver ficha del cliente</button>}
              {detailOrder.status==='payment_verification_pending'&&<><button type="button" className="unified-order-action unified-order-action--danger" disabled={busy===detailOrder.id||!receiptPreview} onClick={()=>void reviewBankTransfer(detailOrder,'reject')}>{detailOrder.currency === "ARS" ? "Rechazar comprobante" : "Rechazar y cancelar"}</button><button type="button" className="unified-order-action unified-order-action--primary" disabled={busy===detailOrder.id||!receiptPreview} onClick={()=>void reviewBankTransfer(detailOrder,'approve')}>{busy===detailOrder.id?'Procesando…':'Aprobar pago'}</button></>}
              {detailOrder.shipping_method!=='pickup'&&['paid_pending_review','ready_for_fulfillment','ready_for_production','manual_review'].includes(detailOrder.status)&&<button type="button" className="unified-order-action unified-order-action--primary" onClick={()=>{const order=detailOrder;setDetailOrder(null);openShipment(order)}}>Marcar enviado</button>}
              {detailOrder.shipping_method==='pickup'&&['paid_pending_review','ready_for_fulfillment','ready_for_production','manual_review'].includes(detailOrder.status)&&<button type="button" className="unified-order-action unified-order-action--primary" disabled={busy===detailOrder.id} onClick={()=>void deliverPickup(detailOrder)}>Marcar entregado</button>}
              {['shipped','delivered'].includes(detailOrder.status)&&<button type="button" className="unified-order-action" disabled={busy===detailOrder.id} onClick={()=>{if(window.confirm('¿Volver este pedido a preparación?'))void updateFulfillment(detailOrder,'restore')}}>Volver a preparación</button>}
              {detailOrder.status==='shipped'&&<button type="button" className="unified-order-action unified-order-action--primary" onClick={()=>{const order=detailOrder;setDetailOrder(null);openShipment(order)}}>Editar envío</button>}
            </div>
      </Modal>}

      {shipmentOrder&&<div className="modal-backdrop">
        <section className="shipment-modal" role="dialog" aria-modal="true" aria-labelledby="shipment-modal-title" aria-describedby="shipment-modal-description">
          <form onSubmit={async event=>{event.preventDefault();const saved=await updateFulfillment(shipmentOrder,'ship',{shippingCarrier,trackingCode});if(saved){setShipmentOrder(null);onClose?.();}}}>
            <header>
              
              <h2 id="shipment-modal-title">{shipmentOrder.status==='shipped'?'Editar datos de envío':'Marcar como enviado'}</h2>
              <div id="shipment-modal-description">Guardá la empresa y el código que el cliente necesita para seguir el paquete.</div>
            </header>
            <OrderDeliverySummary order={shipmentOrder} compact/>
            <label htmlFor="shipping-carrier-select">Empresa de envío <div aria-hidden="true">*</div></label>
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
                <label htmlFor="custom-shipping-carrier">Nombre de la empresa <div aria-hidden="true">*</div></label>
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
            <label htmlFor="tracking-code">Código de seguimiento <div aria-hidden="true">*</div></label>
            <input id="tracking-code" required minLength={3} maxLength={160} autoComplete="off" value={trackingCode} onChange={event=>setTrackingCode(event.target.value)} />
            <div className="field-help">{shipmentOrder.status==='shipped'
              ? 'Los cambios se verán en el detalle del pedido del cliente.'
              : textValue(shipmentOrder.customer_snapshot.purchaseFlow)==='wholesale_bank_transfer'
                ? 'Al confirmar, el pedido cambia a Enviado y el cliente ve estos datos dentro de la web.'
                : 'Al confirmar, el pedido cambia a Enviado y el cliente recibe estos datos por correo.'}</div>
            {shipmentError&&<div className="modal-error" role="alert">{shipmentError}</div>}
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

type CommerceSettings = {
  commerce_enabled:boolean;
  mercado_pago_enabled:boolean;
  paypal_enabled:boolean;
  ars_use_base_price:boolean;
  catalog_price_adjustment_enabled:boolean;
  catalog_price_adjustment_percent:number;
  wholesale_mate_discount_enabled:boolean;
  wholesale_mate_quantity_threshold:number;
  wholesale_mate_discount_percent:number;
  wholesale_discount_categories:string[];
};
type BankTransferSettings = {
  account_holder:string;
  transfer_account:string;
  cash_deposit_account:string;
  cash_deposit_label:string;
};

export function Settings({onNotice,section="all"}:{onNotice:(v:string)=>void;section?:"all"|"pricing"|"payments"}) {
  const [value,setValue]=useState<CommerceSettings|null>(null);
  const [bank,setBank]=useState<BankTransferSettings|null>(null);
  const [percent,setPercent]=useState('');
  const [wholesaleThreshold,setWholesaleThreshold]=useState('');
  const [wholesalePercent,setWholesalePercent]=useState('');
  const [wholesaleCategories,setWholesaleCategories]=useState<string[]>([]);
  const [discountCategoryOptions,setDiscountCategoryOptions]=useState<{code:string;label_es:string}[]>([]);
  const [saving,setSaving]=useState(false);
  const [bankSaving,setBankSaving]=useState(false);
  const load=useCallback(async()=>{
    const [settingsResult,bankResult,categoriesResult]=await Promise.all([
      supabase.from('commerce_settings').select('commerce_enabled,mercado_pago_enabled,paypal_enabled,ars_use_base_price,catalog_price_adjustment_enabled,catalog_price_adjustment_percent,wholesale_mate_discount_enabled,wholesale_mate_quantity_threshold,wholesale_mate_discount_percent,wholesale_discount_categories').eq('singleton',true).single(),
      supabase.from('commerce_bank_transfer_settings').select('account_holder,transfer_account,cash_deposit_account,cash_deposit_label').eq('singleton',true).single(),
      supabase.from('commerce_categories').select('code,label_es').eq('active',true).order('label_es'),
    ]);
    if(settingsResult.error){onNotice(settingsResult.error.message);return}
    if(bankResult.error){onNotice(`No se pudo cargar la cuenta bancaria: ${bankResult.error.message}`);return}
    if(categoriesResult.error){onNotice(`No se pudieron cargar las categorías: ${categoriesResult.error.message}`);return}
    const next=settingsResult.data as CommerceSettings;
    setValue(next);
    setBank(bankResult.data as BankTransferSettings);
    setPercent(String(next.catalog_price_adjustment_percent));
    setWholesaleThreshold(String(next.wholesale_mate_quantity_threshold));
    setWholesalePercent(String(next.wholesale_mate_discount_percent));
    setWholesaleCategories(next.wholesale_discount_categories || ['mates']);
    setDiscountCategoryOptions(categoriesResult.data || []);
  },[onNotice]);
  useEffect(()=>{void load()},[load]);

  if(!value)return <div>Cargando…</div>;

  const save=async(next:Partial<CommerceSettings>,message='Configuración guardada.')=>{
    setSaving(true);
    const previous=value;
    setValue({...value,...next});
    const {error}=await supabase.from('commerce_settings').update(next).eq('singleton',true).select('singleton').single();
    setSaving(false);
    onNotice(error?error.message:message);
    if(error)setValue(previous);
    return !error;
  };
  const saveAdjustment=async(event:React.FormEvent)=>{
    event.preventDefault();
    const parsed=Number(percent.replace(',','.'));
    if(!Number.isFinite(parsed)||parsed<0||parsed>100){onNotice('Ingresá un porcentaje entre 0 y 100.');return}
    const normalized=Math.round(parsed*100)/100;
    if(await save({catalog_price_adjustment_percent:normalized},'Ajuste actualizado y precios recalculados.'))setPercent(String(normalized));
  };
  const saveWholesale=async(event:React.FormEvent)=>{
    event.preventDefault();
    const threshold=Number(wholesaleThreshold);
    const discount=Number(wholesalePercent.replace(',','.'));
    if(!Number.isInteger(threshold)||threshold<1||threshold>999){onNotice('Ingresá una cantidad entera entre 1 y 999.');return}
    if(!Number.isFinite(discount)||discount<0||discount>100){onNotice('Ingresá un descuento entre 0 y 100.');return}
    if(!wholesaleCategories.length){onNotice('Elegí al menos una categoría para el descuento.');return}
    const normalizedDiscount=Math.round(discount*100)/100;
    if(await save({wholesale_mate_quantity_threshold:threshold,wholesale_mate_discount_percent:normalizedDiscount,wholesale_discount_categories:wholesaleCategories},'Regla de mayoreo guardada.')){
      setWholesaleThreshold(String(threshold));
      setWholesalePercent(String(normalizedDiscount));
    }
  };
  const saveBank=async(event:React.FormEvent)=>{
    event.preventDefault();
    if(!bank)return;
    const next:BankTransferSettings={
      account_holder:bank.account_holder.trim(),
      transfer_account:bank.transfer_account.trim(),
      cash_deposit_account:bank.cash_deposit_account.trim(),
      cash_deposit_label:bank.cash_deposit_label.trim(),
    };
    if(next.account_holder.length<2||next.transfer_account.length<3||next.cash_deposit_account.length<3||next.cash_deposit_label.length<3){
      onNotice('Completá todos los datos bancarios.');
      return;
    }
    setBankSaving(true);
    const {error}=await supabase.from('commerce_bank_transfer_settings').update(next).eq('singleton',true).select('singleton').single();
    setBankSaving(false);
    onNotice(error?error.message:'Datos bancarios guardados.');
    if(!error)setBank(next);
  };

  return <>
    {section !== "pricing" && <ArgentinaSettings onNotice={onNotice} />}
    {section !== "pricing" && <section className="panel settings settings-section">
      <header className="settings-heading"><h2>Canales de venta</h2><div>Controles generales para habilitar la tienda y sus proveedores de pago.</div></header>
      <div className="channel-switches">
        {([
          ['commerce_enabled','Comercio web','Activa la tienda online y su checkout.'],
          ['mercado_pago_enabled','Mercado Pago','Cobro de pedidos con Mercado Pago.'],
          ['paypal_enabled','PayPal','Cobro de pedidos con PayPal.'],
        ] as const).map(([key,label,description])=><label className={`channel-switch${value[key]?' is-on':''}`} key={key}>
          <div className="channel-switch-text"><strong>{label}</strong><small>{description}</small></div>
          <span className="channel-switch-state">{value[key]?'Activo':'Apagado'}</span>
          <input type="checkbox" role="switch" disabled={saving} checked={value[key]} aria-label={`Habilitar ${label}`} onChange={event=>void save({[key]:event.target.checked})}/>
        </label>)}
      </div>
    </section>}
    {section !== "payments" && <>
    <section className="panel settings settings-section">
      <header className="settings-heading"><h2>Ajuste del catálogo</h2></header>
      <label className="toggle adjustment-toggle"><input type="checkbox" disabled={saving} checked={value.catalog_price_adjustment_enabled} onChange={event=>void save({catalog_price_adjustment_enabled:event.target.checked},event.target.checked?'Ajuste activado y precios recalculados.':'Ajuste desactivado; se restauraron los precios base.')}/><strong>Aplicar ajuste</strong></label>
      <label className="toggle adjustment-toggle"><input type="checkbox" role="switch" disabled={saving} checked={value.ars_use_base_price} onChange={event=>void save({ars_use_base_price:event.target.checked})}/><strong>No aplicar el ajuste del {value.catalog_price_adjustment_percent.toLocaleString('es-UY')}% a precios en ARS</strong></label>
      <p>Al activar esta opción, los precios en ARS se calculan desde el precio base. Se redondean al múltiplo de 50 más cercano. Los pedidos ya creados conservan su importe.</p>
      <form className="adjustment-form" onSubmit={event=>void saveAdjustment(event)}>
        <label><div className="field-label">Porcentaje</div><div className="percent-input"><input type="number" min="0" max="100" step="0.01" value={percent} disabled={saving} onChange={event=>setPercent(event.target.value)}/><div>%</div></div></label>
        <button type="submit" disabled={saving}>{saving?'Guardando…':'Guardar'}</button>
      </form>
    </section>
    <section className="panel settings settings-section">
      <header className="settings-heading"><h2>Descuento mayorista</h2></header>
      <label className="toggle adjustment-toggle"><input type="checkbox" disabled={saving} checked={value.wholesale_mate_discount_enabled} onChange={event=>void save({wholesale_mate_discount_enabled:event.target.checked},event.target.checked?'Descuento de mayoreo activado.':'Descuento de mayoreo desactivado.')}/><strong>Aplicar descuento</strong></label>
      <form className="adjustment-form" onSubmit={event=>void saveWholesale(event)}>
        <label><div className="field-label">Desde</div><div className="percent-input"><input type="number" min="1" max="999" step="1" value={wholesaleThreshold} disabled={saving} onChange={event=>setWholesaleThreshold(event.target.value)}/><div>artículos</div></div></label>
        <label><div className="field-label">Descuento</div><div className="percent-input"><input type="number" min="0" max="100" step="0.01" value={wholesalePercent} disabled={saving} onChange={event=>setWholesalePercent(event.target.value)}/><div>%</div></div></label>
        <fieldset className="wholesale-category-fieldset" disabled={saving}>
          <legend>Categorías con descuento al alcanzar el mínimo de artículos</legend>
          <div className="wholesale-category-options">{discountCategoryOptions.map(category=><label key={category.code}><input type="checkbox" checked={wholesaleCategories.includes(category.code)} onChange={event=>setWholesaleCategories(current=>event.target.checked?[...current,category.code]:current.filter(code=>code!==category.code))}/><span>{category.code==='bombillas'?'Bombillas/Bombillones':category.label_es}</span></label>)}</div>
        </fieldset>
        <button type="submit" disabled={saving}>{saving?'Guardando…':'Guardar'}</button>
      </form>
    </section>
    </>}
    {section !== "pricing" && bank&&<section className="panel settings settings-section">
      <header className="settings-heading"><h2>Datos para transferencia</h2><div>Se muestran solamente en el checkout mayorista. Guardalos acá para no exponerlos en la configuración pública de la tienda.</div></header>
      <form className="bank-settings-form" onSubmit={event=>void saveBank(event)}>
        <fieldset className="bank-group"><legend>Transferencia bancaria</legend>
          <label><div className="field-label">Titular</div><input required minLength={2} maxLength={120} value={bank.account_holder} disabled={bankSaving} onChange={event=>setBank({...bank,account_holder:event.target.value})}/></label>
          <label><div className="field-label">Cuenta para transferencias</div><input required minLength={3} maxLength={160} value={bank.transfer_account} disabled={bankSaving} onChange={event=>setBank({...bank,transfer_account:event.target.value})}/></label>
        </fieldset>
        <fieldset className="bank-group"><legend>Depósitos RedPagos / Abitab</legend>
          <label><div className="field-label">Texto para depósitos</div><input required minLength={3} maxLength={240} value={bank.cash_deposit_label} disabled={bankSaving} onChange={event=>setBank({...bank,cash_deposit_label:event.target.value})}/></label>
          <label><div className="field-label">Cuenta anterior RedPagos/Abitab</div><input required minLength={3} maxLength={160} value={bank.cash_deposit_account} disabled={bankSaving} onChange={event=>setBank({...bank,cash_deposit_account:event.target.value})}/></label>
        </fieldset>
        <button type="submit" disabled={bankSaving}>{bankSaving?'Guardando…':'Guardar datos bancarios'}</button>
      </form>
    </section>}

  </>;
}
