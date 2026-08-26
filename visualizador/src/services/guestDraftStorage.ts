const DB_NAME = 'matearte-guest-designs';
const DB_VERSION = 1;
const DRAFT_STORE = 'drafts';
const ASSET_STORE = 'assets';

function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(DRAFT_STORE)) db.createObjectStore(DRAFT_STORE);
      if (!db.objectStoreNames.contains(ASSET_STORE)) db.createObjectStore(ASSET_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function put(storeName: string, key: string, value: unknown) {
  const db = await database();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).put(value, key);
    tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function get<T>(storeName: string, key: string): Promise<T | null> {
  const db = await database();
  const value = await new Promise<T | null>((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const request = tx.objectStore(storeName).get(key);
    request.onsuccess = () => resolve((request.result as T | undefined) ?? null);
    request.onerror = () => reject(request.error);
  });
  db.close(); return value;
}

export const saveGuestDraft = (configuration: unknown, flejeConfiguration: unknown) => put(DRAFT_STORE, 'current', { configuration, flejeConfiguration, updatedAt: new Date().toISOString() });
export const loadGuestDraft = () => get<{ configuration: unknown; flejeConfiguration: unknown }>(DRAFT_STORE, 'current');
export const saveGuestDraftIdentity = (clientDraftId: string) => put(DRAFT_STORE, 'current-identity', clientDraftId);
export const loadGuestDraftIdentity = () => get<string>(DRAFT_STORE, 'current-identity');
export const storeGuestAsset = (assetId: string, file: File) => put(ASSET_STORE, assetId, file);
export const loadGuestAsset = (assetId: string) => get<File>(ASSET_STORE, assetId);

export async function syncDesignAssets<TConfiguration, TFleje>(configuration: TConfiguration, flejeConfiguration: TFleje, designId: string, accessToken: string) {
  const configurationCopy = structuredClone(configuration);
  const flejeCopy = structuredClone(flejeConfiguration);
  const candidates: Array<Record<string, unknown>> = [];
  const visit = (value: unknown) => {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) { value.forEach(visit); return; }
    const item = value as Record<string, unknown>;
    if (typeof item.id === 'string' && item.id.startsWith('upload-') && typeof item.originalUrl === 'string' && item.originalUrl === `indexeddb:${item.id}`) candidates.push(item);
    Object.values(item).forEach(visit);
  };
  visit(configurationCopy); visit(flejeCopy);
  if (!candidates.length) return { configuration: configurationCopy, flejeConfiguration: flejeCopy, changed: false };
  const mainSite = (import.meta.env.VITE_MAIN_SITE_URL || 'http://localhost:3000').trim().replace(/\/$/, '');
  for (const item of candidates) {
    const assetId = String(item.id);
    const file = await loadGuestAsset(assetId);
    if (!file) throw new Error(`No se encontró el archivo original ${String(item.name || assetId)}.`);
    const form = new FormData(); form.set('file', file); form.set('designId', designId); form.set('assetId', assetId);
    const response = await fetch(`${mainSite}/api/design-assets`, { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` }, body: form });
    const value = await response.json();
    if (!response.ok || !value.storageRef) throw new Error(value.error || `No se pudo subir ${file.name}.`);
    item.originalUrl = value.storageRef;
  }
  return { configuration: configurationCopy, flejeConfiguration: flejeCopy, changed: true };
}
