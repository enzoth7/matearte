export type JsonRecord = Record<string, unknown>;

export type PersonalizedOrderItem = {
  id: string;
  item_type: string;
  title: string;
  quantity: number;
  total_minor: number;
  requires_review: boolean;
  review_status: string | null;
  review_reason: string | null;
  immutable_snapshot: JsonRecord;
};

export type PersonalizedOrder = {
  id: string;
  order_number: number;
  status: string;
  total_minor: number;
  created_at: string;
  paid_at: string | null;
  customer_snapshot: JsonRecord;
  order_items: PersonalizedOrderItem[];
};

export type PrivateAsset = {
  key: string;
  bucket: 'design-assets' | 'design-previews' | 'order-assets';
  path: string;
  name: string;
  mimeType: string;
  byteSize: number | null;
  kind: 'preview' | 'upload';
  role?: 'mate' | 'virola' | 'fleje_front' | 'fleje_back';
};

export type SurfaceSideSummary = {
  text: string;
  images: string[];
};

export type PersonalizationSummary = {
  mate: {
    model: string;
    size: string;
    color: string;
    texture: string;
    metal: string;
  };
  rim: {
    technique: string;
    finish: string;
    texts: string[];
    images: string[];
    personalized: boolean;
  };
  fleje: {
    available: boolean;
    technique: string;
    finish: string;
    front: SurfaceSideSummary;
    back: SurfaceSideSummary;
    personalized: boolean;
  };
  previews: PrivateAsset[];
  uploads: PrivateAsset[];
  files: PrivateAsset[];
};

const STORAGE_BUCKETS = new Set<PrivateAsset['bucket']>(['design-assets', 'design-previews', 'order-assets']);

export function asRecord(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function asBoolean(value: unknown): boolean {
  return value === true;
}

const friendlyIds: Record<string, string> = {
  laser: 'Láser',
  aplique_bronce: 'Aplique de bronce',
  'aplique-bronce': 'Aplique de bronce',
  aplique_alpaca: 'Aplique de alpaca',
  'aplique-alpaca': 'Aplique de alpaca',
  'finish-1': 'Laureles',
  'frame-1': 'Sol',
  'frame-5': 'Azteca',
  'frame-25': 'Hojas',
  'pattern-1': 'Laurel',
  'frame-26': 'Sol',
  'frame-27': 'Abstracta',
  'frame-28': 'Griego',
  'frame-29': 'Floral',
  'frame-30': 'Guarda pampa',
};

export function humanizeId(value: unknown, fallback = 'No especificado'): string {
  const id = asString(value);
  if (!id) return fallback;
  if (friendlyIds[id]) return friendlyIds[id];
  if (/^\d+$/.test(id)) return `Diseño ${id}`;
  const text = id.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : fallback;
}

function customImageName(value: unknown): string {
  const image = asRecord(value);
  return asString(image.name) || 'Logo personalizado';
}

function collectIconNames(value: unknown): string[] {
  return asArray(value).flatMap((entry) => {
    const icon = asRecord(entry);
    const customName = customImageName(icon.customImage);
    if (Object.keys(asRecord(icon.customImage)).length) return [customName];
    const selected = asString(icon.selectedImageId);
    return selected ? [humanizeId(selected)] : [];
  });
}

function readSurfaceSide(value: unknown): SurfaceSideSummary {
  const side = asRecord(value);
  const images: string[] = [];
  if (asString(side.imageMode) === 'image') {
    if (Object.keys(asRecord(side.customImage)).length) images.push(customImageName(side.customImage));
    const selected = asString(side.selectedImageId);
    if (selected) images.push(humanizeId(selected));
    images.push(...collectIconNames(side.icons));
  }
  return {
    text: asString(side.textMode) === 'text' ? asString(side.text) : '',
    images: [...new Set(images)],
  };
}

function parseStorageReference(reference: unknown): Pick<PrivateAsset, 'bucket' | 'path'> | null {
  const value = asString(reference);
  if (!value.startsWith('storage:')) return null;
  const separator = value.indexOf(':', 'storage:'.length);
  if (separator < 0) return null;
  const bucket = value.slice('storage:'.length, separator) as PrivateAsset['bucket'];
  const path = value.slice(separator + 1);
  return STORAGE_BUCKETS.has(bucket) && path ? { bucket, path } : null;
}

function collectCustomImageAssets(value: unknown): PrivateAsset[] {
  const result: PrivateAsset[] = [];
  const visit = (current: unknown) => {
    if (Array.isArray(current)) {
      current.forEach(visit);
      return;
    }
    const record = asRecord(current);
    if (!Object.keys(record).length) return;
    const ref = parseStorageReference(record.storageRef) || parseStorageReference(record.originalUrl);
    if (ref) {
      result.push({
        key: `${ref.bucket}:${ref.path}`,
        bucket: ref.bucket,
        path: ref.path,
        name: asString(record.name) || 'Logo personalizado',
        mimeType: asString(record.mimeType) || 'application/octet-stream',
        byteSize: typeof record.size === 'number' ? record.size : null,
        kind: 'upload',
      });
    }
    Object.values(record).forEach(visit);
  };
  visit(value);
  return result;
}

export function collectPrivateAssets(snapshotValue: unknown): PrivateAsset[] {
  const snapshot = asRecord(snapshotValue);
  const metadataAssets = asArray(snapshot.assets).flatMap((entry): PrivateAsset[] => {
    const asset = asRecord(entry);
    const bucket = asString(asset.bucket_id) as PrivateAsset['bucket'];
    const path = asString(asset.object_path);
    if (!STORAGE_BUCKETS.has(bucket) || !path) return [];
    return [{
      key: `${bucket}:${path}`,
      bucket,
      path,
      name: asString(asset.original_name) || 'Archivo del cliente',
      mimeType: asString(asset.mime_type) || 'application/octet-stream',
      byteSize: typeof asset.byte_size === 'number' ? asset.byte_size : null,
      kind: bucket === 'design-previews' ? 'preview' : 'upload',
    }];
  });

  const previewNames: Record<string, string> = {
    mate: 'Mate completo.png',
    virola: 'Virola.png',
    fleje_front: 'Fleje - frente.png',
    fleje_back: 'Fleje - reverso.png',
  };
  const manifestPreviews = asArray(snapshot.previews).flatMap((entry): PrivateAsset[] => {
    const preview = asRecord(entry);
    const role = asString(preview.role) as PrivateAsset['role'];
    const bucket = asString(preview.bucket_id) as PrivateAsset['bucket'];
    const path = asString(preview.object_path);
    if (!role || !previewNames[role] || bucket !== 'design-previews' || !path) return [];
    return [{
      key: `${bucket}:${path}`,
      bucket,
      path,
      name: previewNames[role],
      mimeType: asString(preview.mime_type) || 'image/png',
      byteSize: typeof preview.byte_size === 'number' ? preview.byte_size : null,
      kind: 'preview',
      role,
    }];
  });

  const rawPreviewPath = asString(snapshot.previewPath);
  const previewReference = parseStorageReference(rawPreviewPath)
    || (rawPreviewPath ? { bucket: 'design-previews' as const, path: rawPreviewPath } : null);
  const legacyPreview = !manifestPreviews.length && previewReference ? [{
    key: `${previewReference.bucket}:${previewReference.path}`,
    bucket: previewReference.bucket,
    path: previewReference.path,
    name: 'Vista previa del diseño.png',
    mimeType: 'image/png',
    byteSize: null,
    kind: 'preview' as const,
  } satisfies PrivateAsset] : [];

  const activeUploads = [...collectCustomImageAssets(snapshot.configuration), ...collectCustomImageAssets(snapshot.flejeConfiguration)];
  const fallbackUploads = activeUploads.length ? [] : metadataAssets.filter((asset) => asset.kind === 'upload');
  const found = [...manifestPreviews, ...legacyPreview, ...activeUploads, ...fallbackUploads];
  return [...new Map(found.map((asset) => [asset.key, asset])).values()];
}

export function summarizePersonalization(item: PersonalizedOrderItem): PersonalizationSummary {
  const snapshot = asRecord(item.immutable_snapshot);
  const configuration = asRecord(snapshot.configuration);
  const labels = asRecord(configuration.selectionLabels);
  const rim = asRecord(configuration.rim);
  const capabilities = asRecord(configuration.capabilities);
  const fleje = asRecord(snapshot.flejeConfiguration);
  const sides = asRecord(fleje.sides);
  const front = readSurfaceSide(sides.front);
  const back = readSurfaceSide(sides.back);

  const rimTexts = asString(rim.textMode) === 'text'
    ? asArray(rim.texts).map((entry) => asString(asRecord(entry).text)).filter(Boolean)
    : [];
  if (!rimTexts.length && asString(rim.textMode) === 'text' && asString(rim.text)) rimTexts.push(asString(rim.text));
  const rimImages = asString(rim.imageMode) === 'image' ? collectIconNames(rim.icons) : [];
  const rimFinishActive = asString(rim.finishMode) === 'finish';
  const flejeFinishActive = asString(fleje.finishMode) === 'finish';
  const flejeAvailable = asBoolean(capabilities.hasFleje);
  const rimTechnique = asString(labels.engraving) || humanizeId(configuration.engravingTypeId);
  const flejeTechnique = humanizeId(configuration.flejeEngravingTypeId || configuration.engravingTypeId);

  const files = collectPrivateAssets(snapshot);
  return {
    mate: {
      model: asString(labels.family) || humanizeId(configuration.modelId) || item.title,
      size: asString(labels.size) || humanizeId(configuration.size),
      color: asString(labels.color) || humanizeId(configuration.colorId),
      texture: asString(labels.texture) || 'No especificada',
      metal: asString(labels.metal) || humanizeId(rim.rimId),
    },
    rim: {
      technique: rimTechnique,
      finish: rimFinishActive ? humanizeId(rim.finishId, 'Terminación seleccionada') : 'Lisa (sin personalizar)',
      texts: rimTexts,
      images: rimImages,
      personalized: rimFinishActive || rimTexts.length > 0 || rimImages.length > 0,
    },
    fleje: {
      available: flejeAvailable,
      technique: flejeTechnique,
      finish: flejeFinishActive ? humanizeId(fleje.finishId, 'Terminación seleccionada') : 'Liso (sin personalizar)',
      front,
      back,
      personalized: flejeAvailable && (flejeFinishActive || Boolean(front.text) || front.images.length > 0 || Boolean(back.text) || back.images.length > 0),
    },
    previews: files.filter((file) => file.kind === 'preview'),
    uploads: files.filter((file) => file.kind === 'upload'),
    files,
  };
}

export function getPersonalizedItems(order: PersonalizedOrder): PersonalizedOrderItem[] {
  return (order.order_items || []).filter((item) => item.requires_review || item.item_type === 'design');
}

export function customerName(snapshotValue: unknown): string {
  const snapshot = asRecord(snapshotValue);
  return asString(snapshot.fullName) || asString(snapshot.name) || 'Cliente sin nombre';
}

export function customerPhone(snapshotValue: unknown): string {
  const snapshot = asRecord(snapshotValue);
  return asString(snapshot.phone) || asString(snapshot.whatsapp) || asString(snapshot.telephone);
}

export function normalizeWhatsappPhone(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('598')) return digits;
  if (digits.length === 9 && digits.startsWith('0')) return `598${digits.slice(1)}`;
  if (digits.length === 8) return `598${digits}`;
  return digits;
}

export function whatsappContactUrl(snapshotValue: unknown, orderNumber: number): string {
  const phone = normalizeWhatsappPhone(customerPhone(snapshotValue));
  if (!phone) return '';
  const firstName = customerName(snapshotValue).split(/\s+/)[0];
  const message = `Hola ${firstName}, te escribimos de MateArte por tu pedido #${orderNumber}. Necesitamos confirmar un detalle de tu mate personalizado. ¿Podés ayudarnos con la virola o el fleje?`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

export function orderStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending_payment: 'Pendiente de pago',
    paid_pending_review: 'Pagado · requiere revisión',
    ready_for_production: 'Listo para producción',
    ready_for_fulfillment: 'Listo para preparar',
    payment_failed: 'Pago fallido',
    cancelled: 'Cancelado',
    refunded: 'Reembolsado',
    manual_review: 'Revisión manual',
  };
  return labels[status] || humanizeId(status);
}

export function paymentStatusLabel(order: Pick<PersonalizedOrder, 'paid_at' | 'status'>): string {
  if (order.status === 'refunded') return 'Reembolsado';
  if (order.status === 'cancelled') return 'Cancelado';
  if (order.status === 'payment_failed') return 'Pago fallido';
  return order.paid_at ? 'Pagado' : 'Pendiente';
}

export function formatFileSize(bytes: number | null): string {
  if (!bytes || bytes < 1) return '';
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
