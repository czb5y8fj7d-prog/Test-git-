import { openDB, type IDBPDatabase } from 'idb';
import type { Book } from '../types';

const DB_NAME = 'ebook-editor';
const DB_VERSION = 1;
const STORE_NAME = 'project';
const BOOK_KEY = 'current-book';

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      },
    });
  }
  return dbPromise;
}

export async function loadBook(): Promise<Book | null> {
  const db = await getDb();
  const value = await db.get(STORE_NAME, BOOK_KEY);
  return value ?? null;
}

export async function saveBook(book: Book): Promise<void> {
  const db = await getDb();
  await db.put(STORE_NAME, book, BOOK_KEY);
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;

export function scheduleAutosave(book: Book, delayMs = 800): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveBook(book).catch((err) => console.error('Échec de la sauvegarde automatique', err));
  }, delayMs);
}
