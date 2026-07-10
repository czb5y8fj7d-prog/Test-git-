import type { Book } from '../types';

export function exportBookToJsonFile(book: Book): void {
  const json = JSON.stringify(book, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const filename = `${slugify(book.meta.title || 'livre')}.json`;
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function importBookFromJsonFile(file: File): Promise<Book> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string) as Book;
        if (!parsed || !Array.isArray(parsed.chapters)) {
          throw new Error('Format de fichier invalide');
        }
        resolve(parsed);
      } catch (err) {
        reject(err instanceof Error ? err : new Error('Fichier JSON invalide'));
      }
    };
    reader.onerror = () => reject(reader.error ?? new Error('Erreur de lecture du fichier'));
    reader.readAsText(file);
  });
}

const DIACRITICS_REGEX = /[̀-ͯ]/g;

function slugify(text: string): string {
  const normalized = text.toLowerCase().normalize('NFD').replace(DIACRITICS_REGEX, '');
  const slug = normalized.replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  return slug || 'livre';
}
