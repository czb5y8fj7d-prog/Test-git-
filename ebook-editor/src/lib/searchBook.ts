import type { Book } from '../types';
import { extractPlainText } from './wordCount';

export interface SearchResult {
  chapterId: string;
  chapterTitle: string;
  sectionId: string;
  sectionTitle: string;
  excerpt: string;
}

const EXCERPT_RADIUS = 40;

export function searchBook(book: Book, query: string): SearchResult[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const results: SearchResult[] = [];

  for (const chapter of book.chapters) {
    for (const section of chapter.sections) {
      const text = extractPlainText(section.content);
      const lowerText = text.toLowerCase();
      const titleMatches = section.title.toLowerCase().includes(q) || chapter.title.toLowerCase().includes(q);
      const idx = lowerText.indexOf(q);

      if (idx !== -1 || titleMatches) {
        results.push({
          chapterId: chapter.id,
          chapterTitle: chapter.title,
          sectionId: section.id,
          sectionTitle: section.title,
          excerpt: idx !== -1 ? buildExcerpt(text, idx, q.length) : text.slice(0, 90).trim(),
        });
      }
    }
  }

  return results.slice(0, 40);
}

function buildExcerpt(text: string, index: number, matchLength: number): string {
  const start = Math.max(0, index - EXCERPT_RADIUS);
  const end = Math.min(text.length, index + matchLength + EXCERPT_RADIUS);
  const prefix = start > 0 ? '…' : '';
  const suffix = end < text.length ? '…' : '';
  return `${prefix}${text.slice(start, end).trim()}${suffix}`;
}
