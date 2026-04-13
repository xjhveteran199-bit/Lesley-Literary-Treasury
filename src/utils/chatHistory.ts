/**
 * IndexedDB-based chat history storage for author conversations.
 */

export interface StoredMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

const DB_NAME = 'lesley-literary';
const DB_VERSION = 2; // Bumped from 1 to add conversations store
const AUTHORS_STORE = 'authors';
const CHAT_STORE = 'conversations';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = request.result;
      // Keep existing authors store
      if (!db.objectStoreNames.contains(AUTHORS_STORE)) {
        db.createObjectStore(AUTHORS_STORE, { keyPath: 'id' });
      }
      // Add conversations store keyed by author slug
      if (!db.objectStoreNames.contains(CHAT_STORE)) {
        db.createObjectStore(CHAT_STORE, { keyPath: 'slug' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getChatHistory(slug: string): Promise<StoredMessage[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CHAT_STORE, 'readonly');
    const store = tx.objectStore(CHAT_STORE);
    const request = store.get(slug);
    request.onsuccess = () => {
      resolve(request.result?.messages || []);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function saveChatMessage(slug: string, message: StoredMessage): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CHAT_STORE, 'readwrite');
    const store = tx.objectStore(CHAT_STORE);
    const getReq = store.get(slug);
    getReq.onsuccess = () => {
      const existing = getReq.result || { slug, messages: [] };
      existing.messages.push(message);
      store.put(existing);
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function clearChatHistory(slug: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CHAT_STORE, 'readwrite');
    const store = tx.objectStore(CHAT_STORE);
    store.delete(slug);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
