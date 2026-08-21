import { getRimOption } from '../catalog/rimCatalog';
import { getRimFinish } from '../catalog/rimFinishCatalog';
import { getFlejeFinish } from '../catalog/flejeFinishCatalog';
import { rimIconCatalog } from '../catalog/rimIconCatalog';
import { getModelDefinition, getVariantDefinition, mateSizeLabels } from '../catalog/mateCatalog';
import type { FlejeCustomization, MateConfiguration } from '../types/customizer';

// Enzo: reemplazar con la URL del Apps Script desplegado
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzdCaERgL5UmKltFAKt5WoG0Ct1Eszsc-jK1phlbqUcJC18fRwNC-5D65nVSIB-g7mU3A/exec';

interface OrderPayload {
  userData: {
    name: string;
    email: string;
    phone?: string;
    company?: string;
  };
  configuration: MateConfiguration;
  flejeConfig: FlejeCustomization;
  previewImageUrl: string | null;
  designId: string | null;
}

/**
 * Transforma la configuración técnica en datos legibles
 * y envía una fila al Google Sheet vía Apps Script.
 */
export async function sendOrderToGoogleSheet(payload: OrderPayload): Promise<boolean> {
  try {
    const modelDef = getModelDefinition(payload.configuration.modelId);
    const variantDef = getVariantDefinition(payload.configuration.variantId);
    const rimMaterial = getRimOption(payload.configuration.rim.rimId);
    const rimFinish = getRimFinish(payload.configuration.rim.finishId);
    const flejeFinish = getFlejeFinish(payload.flejeConfig.finishId);

    const rimIcons = payload.configuration.rim.icons.map(icon => 
      icon.customImage?.id === icon.selectedImageId 
        ? icon.customImage.name 
        : rimIconCatalog.find(i => i.id === icon.selectedImageId)?.name || ''
    ).filter(Boolean).join(", ");
    
    const rimOriginalUrls = payload.configuration.rim.icons.map(icon => 
      icon.customImage?.originalUrl
    ).filter(Boolean).join(", ");
    const flejeSides = payload.flejeConfig.sides;
    const getSideIconName = (side: "front" | "back") => {
      const sideConfig = flejeSides[side];
      if (sideConfig.customImage?.id === sideConfig.selectedImageId) return sideConfig.customImage.name;
      return rimIconCatalog.find((item) => item.id === sideConfig.selectedImageId)?.name || '';
    };

    const now = new Date();
    const fecha = now.toLocaleString('es-UY', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });

    const rimTexts = payload.configuration.rim.texts
      ? payload.configuration.rim.texts.filter((t) => t.text.trim()).map((t, idx) => `T${idx + 1}: ${t.text}`).join(" | ")
      : payload.configuration.rim.text || '';

    const body = {
      fecha,
      nombre: payload.userData.name,
      email: payload.userData.email,
      whatsapp: payload.userData.phone || '',
      empresa: payload.userData.company || '',
      modelo: payload.configuration.selectionLabels.family || modelDef.name,
      variante: payload.configuration.selectionLabels.texture || variantDef?.name || payload.configuration.variantId,
      color: payload.configuration.selectionLabels.color || payload.configuration.colorId,
      tamano: payload.configuration.selectionLabels.size || mateSizeLabels[payload.configuration.size],
      materialVirola: payload.configuration.selectionLabels.metal || rimMaterial?.name || 'Original',
      catalogVersion: payload.configuration.schemaVersion,
      pricingVersion: payload.configuration.pricingSnapshot?.catalogVersion ?? '',
      pricingSubtotalUYU: payload.configuration.pricingSnapshot?.subtotalUYU ?? payload.configuration.pricingSnapshot?.totalUYU ?? '',
      paymentMethod: payload.configuration.pricingSnapshot?.paymentMethod ?? '',
      paymentCommissionPercent: payload.configuration.pricingSnapshot?.mercadoPagoCommissionPercent ?? '',
      paymentCommissionUYU: payload.configuration.pricingSnapshot?.mercadoPagoCommissionUYU ?? '',
      pricingTotalUYU: payload.configuration.pricingSnapshot?.totalUYU ?? '',
      productId: payload.configuration.productId || '',
      skuId: payload.configuration.skuId || '',
      familyId: payload.configuration.selection.familyId || '',
      textureId: payload.configuration.selection.textureId || '',
      colorId: payload.configuration.selection.colorId || '',
      metalId: payload.configuration.selection.metalId || '',
      sizeId: payload.configuration.selection.sizeId || '',
      tipoGrabado: payload.configuration.selectionLabels.engraving || '',
      engravingTypeId: payload.configuration.engravingTypeId || '',
      cinceladoVirola: rimFinish?.name || 'Liso',
      textoVirola: rimTexts,
      iconoVirola: rimIcons,
      archivoOriginalVirola: rimOriginalUrls,
      acabadoFleje: payload.configuration.capabilities.hasFleje ? (flejeFinish?.name || 'Liso') : 'N/A (sin fleje)',
      textoFlejeFrente: payload.configuration.capabilities.hasFleje ? flejeSides.front.text : '',
      textoFlejeDorso: payload.configuration.capabilities.hasFleje ? flejeSides.back.text : '',
      iconoFlejeFrente: payload.configuration.capabilities.hasFleje ? getSideIconName('front') : '',
      iconoFlejeDorso: payload.configuration.capabilities.hasFleje ? getSideIconName('back') : '',
      archivoOriginalFlejeFrente: flejeSides.front.customImage?.originalUrl || '',
      archivoOriginalFlejeDorso: flejeSides.back.customImage?.originalUrl || '',
      urlImagen: payload.previewImageUrl || '',
      idSupabase: payload.designId || '',
      estado: 'submitted',
    };

    const response = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' }, // Apps Script no acepta application/json en mode: 'no-cors'
      body: JSON.stringify(body),
      mode: 'no-cors', // Apps Script requiere no-cors desde el browser
    });

    // En modo no-cors no podemos leer la response, pero si no tiró error, fue bien
    console.log('Order sent to Google Sheet. Status:', response.status, response.type);
    return true;
  } catch (err) {
    console.error('Error sending order to Google Sheet:', err);
    return false;
  }
}
