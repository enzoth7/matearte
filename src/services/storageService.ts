import { supabase } from '../lib/supabase';

const BUCKET_NAME = 'order-previews';

/**
 * Sube un Blob (PNG del preview) al bucket de Supabase Storage
 * y devuelve la URL pública.
 */
export async function uploadOrderPreview(blob: Blob, designId: string): Promise<string | null> {
  try {
    const fileName = `${designId}-${Date.now()}.png`;
    const filePath = `orders/${fileName}`;

    console.log(`Subiendo preview a Supabase Storage: ${filePath} (${blob.size} bytes)...`);

    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, blob, {
        contentType: 'image/png',
        upsert: true,
        cacheControl: '3600',
      });

    if (uploadError) {
      console.error('Error uploading preview to Supabase Storage:', uploadError.message, uploadError);
      return null;
    }

    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(filePath);

    console.log('Imagen subida con éxito a Supabase Storage:', urlData?.publicUrl);
    return urlData?.publicUrl ?? null;
  } catch (err) {
    console.error('Unexpected error in uploadOrderPreview:', err);
    return null;
  }
}
