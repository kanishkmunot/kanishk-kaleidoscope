export type Video = { url: string; title: string };

export interface Draft {
  id: string;
  changed: number;
  path?: string;
  sha?: string;
  published: boolean;
  title: string;
  subtitle: string;
  description: string;
  date: string;
  body: string;
  cover: string;
  coverAlt: string;
  coverCaption: string;
  featured: boolean;
  videos: Video[];
  files: Record<string, Blob>;
  frontMatter: Record<string, unknown>;
}

export function freshDraft(): Draft {
  return {
    id: crypto.randomUUID(), changed: Date.now(), published: false, title: '', subtitle: '',
    description: '', date: '', body: '', cover: '', coverAlt: '', coverCaption: '',
    featured: false, videos: [], files: {}, frontMatter: {},
  };
}

let database: Promise<IDBDatabase> | undefined;

function openDatabase() {
  return database ??= new Promise((resolve, reject) => {
    const request = indexedDB.open('kaleidoscope-writing-studio', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('drafts', { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function transaction<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>) {
  const db = await openDatabase();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction('drafts', mode);
    const request = action(tx.objectStore('drafts'));
    tx.oncomplete = () => resolve(request.result);
    tx.onabort = () => reject(tx.error);
    tx.onerror = () => reject(tx.error);
  });
}

export async function getDrafts() {
  const drafts = await transaction<Draft[]>('readonly', store => store.getAll());
  return drafts.sort((a, b) => b.changed - a.changed);
}

export function saveDraft(draft: Draft) {
  return transaction('readwrite', store => store.put(draft));
}

export function removeDraft(id: string) {
  return transaction('readwrite', store => store.delete(id));
}
