import { supabase } from "./supabase";

export type CatalogSection =
  | "families"
  | "textures"
  | "colors"
  | "metals"
  | "techniques";
export type CatalogPatch = {
  label?: string;
  description?: string;
  image?: string;
  flejeImage?: string;
  torpedoImage?: string;
  swatch?: string;
  enabled?: boolean;
  virola?: string[];
  fleje?: string[];
};
export type CatalogDocument = Partial<
  Record<CatalogSection, Record<string, CatalogPatch>>
>;
export type CatalogVersion = {
  id: string;
  version: number;
  updatedAt: string;
  document: CatalogDocument;
};
export type CatalogAdminState = {
  draft: CatalogVersion;
  published: CatalogVersion;
};

function parseVersion(value: unknown): CatalogVersion {
  if (!value || typeof value !== "object")
    throw new Error("No se encontró la versión del catálogo.");
  const record = value as Record<string, unknown>;
  if (
    typeof record.id !== "string" ||
    typeof record.updatedAt !== "string" ||
    !record.document ||
    typeof record.document !== "object"
  ) {
    throw new Error("La versión del catálogo tiene un formato inválido.");
  }
  return {
    id: record.id,
    version: Number(record.version),
    updatedAt: record.updatedAt,
    document: record.document as CatalogDocument,
  };
}

function parseState(value: unknown): CatalogAdminState {
  if (!value || typeof value !== "object")
    throw new Error("No se encontró la configuración del catálogo.");
  const record = value as Record<string, unknown>;
  return {
    draft: parseVersion(record.draft),
    published: parseVersion(record.published),
  };
}

function requestError(value: { message: string; code?: string }) {
  return new Error(
    value.code === "42501"
      ? "Tu cuenta no tiene permiso para configurar el Visualizador."
      : value.message,
  );
}

export async function loadVisualizerCatalog(): Promise<CatalogAdminState> {
  const { data, error } = await supabase.rpc(
    "get_visualizer_catalog_admin_state",
  );
  if (error) throw requestError(error);
  return parseState(data);
}

export async function saveVisualizerCatalogDraft(
  state: CatalogAdminState,
  document: CatalogDocument,
) {
  const { data, error } = await supabase.rpc("save_visualizer_catalog_draft", {
    p_version_id: state.draft.id,
    p_expected_updated_at: state.draft.updatedAt,
    p_document: document,
  });
  if (error) throw requestError(error);
  return parseState(data);
}

export async function publishVisualizerCatalogDraft(state: CatalogAdminState) {
  const { data, error } = await supabase.rpc(
    "publish_visualizer_catalog_draft",
    {
      p_version_id: state.draft.id,
      p_expected_updated_at: state.draft.updatedAt,
    },
  );
  if (error) throw requestError(error);
  return parseState(data);
}

export async function uploadVisualizerCatalogImage(
  file: File,
): Promise<string> {
  if (
    !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
    file.size > 10 * 1024 * 1024
  ) {
    throw new Error("Elegí una imagen PNG, JPG o WebP de hasta 10 MB.");
  }
  const extension =
    file.type === "image/png"
      ? "png"
      : file.type === "image/webp"
        ? "webp"
        : "jpg";
  const path = `catalog/${crypto.randomUUID()}.${extension}`;
  const bucket = supabase.storage.from("visualizer-catalog");
  const { error } = await bucket.upload(path, file, {
    contentType: file.type,
    cacheControl: "31536000",
    upsert: false,
  });
  if (error) throw requestError(error);
  return bucket.getPublicUrl(path).data.publicUrl;
}
