import type { DesignExportTargets, DesignPreviewRole } from "../components/DesignExportRenderer";
import { supabase } from "../lib/supabase";
import { captureElementAsBlob } from "./capturePreview";

export const MAX_DESIGN_PREVIEW_SIZE = 5 * 1024 * 1024;

export const requiredDesignPreviewRoles = (hasFleje: boolean): DesignPreviewRole[] => hasFleje
  ? ["mate", "virola", "fleje_front", "fleje_back"]
  : ["mate", "virola"];

export async function saveDesignPreviews(params: {
  designId: string;
  userId: string;
  hasFleje: boolean;
  targets: DesignExportTargets;
}) {
  const roles = requiredDesignPreviewRoles(params.hasFleje);
  const revision = crypto.randomUUID();
  const uploadedPaths: string[] = [];
  const previews: Array<{ role: DesignPreviewRole; object_path: string; byte_size: number }> = [];

  try {
    for (const role of roles) {
      const target = params.targets[role];
      if (!target) throw new Error(`No se encontró la vista ${role} para exportar.`);
      const blob = await captureElementAsBlob(target);
      if (!blob || blob.type !== "image/png" || blob.size < 1) throw new Error(`No se pudo generar la vista ${role}.`);
      if (blob.size > MAX_DESIGN_PREVIEW_SIZE) throw new Error(`La vista ${role} supera el máximo de 5 MB.`);
      const objectPath = `${params.userId}/${params.designId}/${revision}/${role}.png`;
      const { error } = await supabase.storage.from("design-previews").upload(objectPath, blob, {
        contentType: "image/png",
        cacheControl: "31536000",
        upsert: false,
      });
      if (error) throw new Error(`No se pudo guardar la vista ${role}: ${error.message}`);
      uploadedPaths.push(objectPath);
      previews.push({ role, object_path: objectPath, byte_size: blob.size });
    }

    const { data, error } = await supabase.rpc("replace_design_previews", {
      p_design_id: params.designId,
      p_previews: previews,
    });
    if (error) throw new Error(`No se pudieron registrar las vistas del diseño: ${error.message}`);
    return data;
  } catch (error) {
    // La limpieza nunca debe reemplazar el error que impidió generar o guardar la vista.
    if (uploadedPaths.length) {
      await supabase.storage.from("design-previews").remove(uploadedPaths).catch((cleanupError) => {
        console.warn("No se pudieron limpiar vistas parciales del diseño:", cleanupError);
      });
    }
    throw error;
  }
}
