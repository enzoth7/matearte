import { supabase } from "./supabase";
import { convertRasterToWebp } from "./convertRasterToWebp";
import type { CatalogImageCrop } from "../../../personalizador/src/catalog/catalogImageCrop";

export type CatalogSection =
  | "families"
  | "textures"
  | "colors"
  | "metals"
  | "techniques"
  | "sizes";
export type CatalogPatch = {
  label?: string;
  description?: string;
  image?: string;
  imageCrop?: CatalogImageCrop;
  flejeImage?: string;
  flejeImageCrop?: CatalogImageCrop;
  torpedoImage?: string;
  torpedoImageCrop?: CatalogImageCrop;
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
      ? "Tu cuenta no tiene permiso para configurar el Personalizador."
      : value.message,
  );
}

export async function loadPersonalizerCatalog(): Promise<CatalogAdminState> {
  const { data, error } = await supabase.rpc(
    "get_visualizer_catalog_admin_state",
  );
  if (error) throw requestError(error);
  return parseState(data);
}

export async function savePersonalizerCatalogDraft(
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

export async function publishPersonalizerCatalogDraft(state: CatalogAdminState) {
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

export async function uploadPersonalizerCatalogImage(
  file: File,
): Promise<string> {
  if (
    !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
    file.size > 10 * 1024 * 1024
  ) {
    throw new Error("Elegí una imagen PNG, JPG o WebP de hasta 10 MB.");
  }
  const prepared = await convertRasterToWebp(file, 0.88, 10 * 1024 * 1024);
  const path = `catalog/${crypto.randomUUID()}.webp`;
  const bucket = supabase.storage.from("visualizer-catalog");
  const { error } = await bucket.upload(path, prepared, {
    contentType: prepared.type,
    cacheControl: "31536000",
    upsert: false,
  });
  if (error) throw requestError(error);
  return bucket.getPublicUrl(path).data.publicUrl;
}
