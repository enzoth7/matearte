import { useEffect, useRef, useState } from "react";

export type SavedDraft<T> = { id: string; version: 1; updatedAt: number; value: T };
type DraftState<T> = { status: "loading" | "available" | "editing" | "finished"; saved: SavedDraft<T>[]; error: string };

const databaseName = "matearte-gestion-order-drafts";
const storeName = "drafts";
let database: Promise<IDBDatabase> | undefined;
let pending: Promise<unknown> = Promise.resolve();

function openDatabase() {
  if (!database) database = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(storeName);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  }).catch((error) => { database = undefined; throw error; });
  return database;
}

async function transact<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const request = action(transaction.objectStore(storeName));
    transaction.oncomplete = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

function enqueue<T>(operation: () => Promise<T>): Promise<T> {
  const result = pending.then(operation, operation);
  pending = result.catch(() => undefined);
  return result;
}

async function readDrafts<T>(scope: string): Promise<SavedDraft<T>[]> {
  const prefix = `${scope}:`;
  const entries = await enqueue(() => transact<SavedDraft<T>[]>("readonly", store => store.getAll(IDBKeyRange.bound(prefix, `${prefix}\uffff`))));
  // Borradores anteriores pasan a la lista sin perder sus datos.
  const legacy = await enqueue(() => transact<Omit<SavedDraft<T>, "id"> | undefined>("readonly", store => store.get(scope)));
  if (legacy?.version === 1) {
    const migrated: SavedDraft<T> = { ...legacy, id: crypto.randomUUID() };
    await enqueue(() => transact("readwrite", store => {
      store.delete(scope);
      return store.put(migrated, `${prefix}${migrated.id}`);
    }));
    entries.push(migrated);
  }
  return entries.filter(entry => entry?.version === 1).sort((a, b) => b.updatedAt - a.updatedAt);
}

export function useOrderDraft<T>(scope: string, value: T, hasContent: boolean, restore: (value: T, isNew: boolean) => void) {
  const [state, setState] = useState<DraftState<T>>({ status: "loading", saved: [], error: "" });
  const valueRef = useRef(value);
  const initialRef = useRef(value);
  const restoreRef = useRef(restore);
  const statusRef = useRef<DraftState<T>["status"]>("loading");
  const activeIdRef = useRef<string | null>(null);
  const contentRef = useRef(hasContent);
  valueRef.current = value;
  restoreRef.current = restore;
  contentRef.current = hasContent;

  const write = () => {
    const id = activeIdRef.current;
    if (!id) return Promise.reject(new Error("No hay un borrador activo."));
    const snapshot: SavedDraft<T> = { id, version: 1, updatedAt: Date.now(), value: valueRef.current };
    return enqueue(() => transact("readwrite", store => store.put(snapshot, `${scope}:${id}`)));
  };

  useEffect(() => {
    let active = true;
    statusRef.current = "loading";
    void readDrafts<T>(scope).then(saved => {
      if (!active) return;
      if (!saved.length) activeIdRef.current = crypto.randomUUID();
      statusRef.current = saved.length ? "available" : "editing";
      setState({ status: statusRef.current, saved, error: "" });
    }).catch(() => {
      if (!active) return;
      activeIdRef.current = crypto.randomUUID();
      statusRef.current = "editing";
      setState({ status: "editing", saved: [], error: "No se pudo abrir el almacenamiento de borradores en este navegador." });
    });
    return () => { active = false; };
  }, [scope]);

  useEffect(() => {
    if (state.status !== "editing" || !hasContent) return;
    void write().catch(() => setState(current => ({ ...current, error: "No se pudo guardar el borrador en este navegador." })));
  }, [scope, value, hasContent, state.status]);

  useEffect(() => {
    const id = activeIdRef.current;
    if (state.status !== "editing" || hasContent || !id) return;
    void enqueue(() => transact("readwrite", store => store.delete(`${scope}:${id}`)));
  }, [scope, hasContent, state.status]);

  useEffect(() => () => {
    if (statusRef.current === "editing" && contentRef.current) void write();
  }, [scope]);

  const resume = (id: string) => {
    const saved = state.saved.find(entry => entry.id === id);
    if (!saved) return;
    activeIdRef.current = id;
    restoreRef.current(saved.value, false);
    statusRef.current = "editing";
    setState(current => ({ ...current, status: "editing", error: "" }));
  };
  const startNew = () => {
    activeIdRef.current = crypto.randomUUID();
    restoreRef.current(initialRef.current, true);
    statusRef.current = "editing";
    setState(current => ({ ...current, status: "editing", error: "" }));
  };
  const discard = async (id: string) => {
    try {
      await enqueue(() => transact("readwrite", store => store.delete(`${scope}:${id}`)));
      const saved = await readDrafts<T>(scope);
      if (saved.length) setState({ status: "available", saved, error: "" });
      else {
        activeIdRef.current = crypto.randomUUID();
        restoreRef.current(initialRef.current, true);
        statusRef.current = "editing";
        setState({ status: "editing", saved: [], error: "" });
      }
    } catch { setState(current => ({ ...current, error: "No se pudo descartar el borrador. Intentá nuevamente." })); }
  };
  const saveNow = async () => {
    try {
      await write();
      setState(current => ({ ...current, error: "" }));
      return true;
    } catch {
      setState(current => ({ ...current, error: "No se pudo guardar el borrador en este navegador." }));
      return false;
    }
  };
  const showList = async () => {
    if (contentRef.current && !(await saveNow())) return;
    try {
      const saved = await readDrafts<T>(scope);
      activeIdRef.current = null;
      statusRef.current = "available";
      setState({ status: "available", saved, error: "" });
    } catch { setState(current => ({ ...current, error: "No se pudieron cargar los borradores." })); }
  };
  const finish = async () => {
    statusRef.current = "finished";
    const id = activeIdRef.current;
    if (id) await enqueue(() => transact("readwrite", store => store.delete(`${scope}:${id}`)));
    setState({ status: "finished", saved: [], error: "" });
  };
  return { ...state, resume, startNew, discard, saveNow, showList, finish };
}
