/**
 * IndexedDB storage for custom authors.
 * Stores author metadata + uploaded images as data URLs.
 */

export interface CustomAuthor {
  id: string; // slug
  name: { zh: string; original: string; en?: string };
  location: {
    birthplace: string;
    coordinates: { lat: number; lng: number };
    country: string;
  };
  categories: string[];
  era: string;
  years: { birth: number; death: number | null };
  portrait: string | null; // data URL or external URL
  color: string;
  audio: {
    file: string; // data URL or external URL
    quote: { zh: string; original?: string };
    duration: number;
  } | null;
  works: {
    title: { zh: string; original?: string };
    year?: number;
    description: string;
  }[];
  biography: string; // markdown content
  featured: boolean;
  createdAt: number;
  updatedAt: number;
}

const DB_NAME = 'lesley-literary';
const DB_VERSION = 1;
const STORE_NAME = 'authors';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getAllCustomAuthors(): Promise<CustomAuthor[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getCustomAuthor(id: string): Promise<CustomAuthor | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveCustomAuthor(author: CustomAuthor): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    author.updatedAt = Date.now();
    store.put(author);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteCustomAuthor(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Create a URL-safe slug from a name */
export function nameToSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-')
    .replace(/^-|-$/g, '')
    || `author-${Date.now()}`;
}

/** Generate a random accent color */
export function randomColor(): string {
  const colors = [
    '#E07A5F', '#81B29A', '#F2CC8F', '#3D405B', '#E8A87C',
    '#6B7B8D', '#C17850', '#D4534B', '#8FB996', '#7B9E89',
    '#C4856A', '#C75B3A', '#6A8E7F', '#4A6670', '#D4A017',
    '#7B8B9A', '#6B6B8D', '#8B7355', '#8B6B5B', '#7A8B6F',
    '#A0785A', '#4A4A4A', '#6B8E7B', '#9B7B8E', '#B87333',
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

/** Create a blank author template from a name */
export function createAuthorTemplate(nameZh: string, nameOriginal?: string): CustomAuthor {
  const slug = nameToSlug(nameOriginal || nameZh);
  return {
    id: slug,
    name: { zh: nameZh, original: nameOriginal || nameZh },
    location: {
      birthplace: '',
      coordinates: { lat: 0, lng: 0 },
      country: '',
    },
    categories: ['fiction'],
    era: '20世纪',
    years: { birth: 1900, death: null },
    portrait: null,
    color: randomColor(),
    audio: null,
    works: [],
    biography: '',
    featured: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/**
 * Convert a File to a data URL string for storage.
 */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
