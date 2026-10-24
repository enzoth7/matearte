import type { DesignExportTargets, DesignPreviewRole } from "../components/DesignExportRenderer";
import { supabase } from "../lib/supabase";
import { captureElementAsBlob } from "./capturePreview";

export const MAX_DESIGN_PREVIEW_SIZE = 10 * 1024 * 1024;

const MAX_UPLOAD_ATTEMPTS = 3;

function isTransientUploadError(error: { message?: string; status?: number | string; statusCode?: number | string }) {
  const status = Number(error.statusCode ?? error.status);
  return status === 408 || status === 429 || status >= 500
    || /load failed|failed to fetch|network|timeout|timed out|connection/i.test(error.message ?? "");
}

async function uploadPreview(objectPath: string, blob: Blob) {
  for (let attempt = 1; attempt <= MAX_UPLOAD_ATTEMPTS; attempt++) {
    const { error } = await supabase.storage.from("design-previews").upload(objectPath, blob, {
      contentType: "image/png",
      cacheControl: "31536000",
      // Each revision has a unique path. A retry may follow a successful upload
      // whose response was lost, so repeating it must be safe.
      upsert: true,
    });
    if (!error) return;
    if (attempt === MAX_UPLOAD_ATTEMPTS || !isTransientUploadError(error)) throw error;
    await new Promise((resolve) => setTimeout(resolve, 350 * attempt));
  }
}

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
      if (blob.size > MAX_DESIGN_PREVIEW_SIZE) throw new Error(`La vista ${role} supera el máximo de 10 MB.`);
      const objectPath = `${params.userId}/${params.designId}/${revision}/${role}.png`;
      uploadedPaths.push(objectPath);
      try {
        await uploadPreview(objectPath, blob);
      } catch (error) {
        const message = error && typeof error === "object" && "message" in error
          ? String(error.message)
          : String(error);
        throw new Error(`No se pudo guardar la vista ${role}: ${message}`);
      }
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
