import { getRimOption } from '../catalog/rimCatalog';
import { getRimFinish } from '../catalog/rimFinishCatalog';
import { getFlejeFinish } from '../catalog/flejeFinishCatalog';
import { rimIconCatalog } from '../catalog/rimIconCatalog';
import { getModelDefinition, mateVariants, type MateModel } from '../catalog/mateCatalog';
import type { RimCustomization } from '../catalog/rimCatalog';
import type { FlejeCustomization } from '../components/FlatFlejePreview';

// Enzo: reemplazar con la URL del Apps Script desplegado
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzdCaERgL5UmKltFAKt5WoG0Ct1Eszsc-jK1phlbqUcJC18fRwNC-5D65nVSIB-g7mU3A/exec';

interface OrderPayload {
  userData: {
    name: string;
    email: string;
    phone?: string;
    company?: string;
  };
  configuration: {
    modelId: MateModel;
    variantId: string;
    rim: RimCustomization;
  };
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
    const variantDef = mateVariants.find((v) => v.id === payload.configuration.variantId);
    const rimMaterial = getRimOption(payload.configuration.rim.rimId);
    const rimFinish = getRimFinish(payload.configuration.rim.finishId);
    const flejeFinish = getFlejeFinish(payload.flejeConfig.finishId);

    const rimIcon = payload.configuration.rim.selectedImageId
      ? rimIconCatalog.find((i) => i.id === payload.configuration.rim.selectedImageId)
      : null;

    const flejeIcon = payload.flejeConfig.selectedImageId
      ? rimIconCatalog.find((i) => i.id === payload.flejeConfig.selectedImageId)
      : null;

    const now = new Date();
    const fecha = now.toLocaleString('es-UY', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });

    const body = {
      fecha,
      nombre: payload.userData.name,
      email: payload.userData.email,
      whatsapp: payload.userData.phone || '',
      empresa: payload.userData.company || '',
      modelo: modelDef.name,
      variante: variantDef?.name || payload.configuration.variantId,
      materialVirola: rimMaterial?.name || 'Original',
      cinceladoVirola: rimFinish?.name || 'Liso',
      textoVirola: payload.configuration.rim.text || '',
      iconoVirola: rimIcon?.name || '',
      acabadoFleje: modelDef.hasFleje ? (flejeFinish?.name || 'Liso') : 'N/A (sin fleje)',
      textoFleje: modelDef.hasFleje ? (payload.flejeConfig.text || '') : '',
      iconoFleje: modelDef.hasFleje ? (flejeIcon?.name || '') : '',
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
