import type { Book, Chapter } from '../types';

interface TiptapNode {
  type?: string;
  text?: string;
  content?: TiptapNode[];
}

function collectText(node: TiptapNode | null | undefined, out: string[]): void {
  if (!node) return;
  if (node.type === 'text' && typeof node.text === 'string') out.push(node.text);
  node.content?.forEach((child) => collectText(child, out));
}

export function extractPlainText(content: unknown): string {
  const parts: string[] = [];
  collectText(content as TiptapNode, parts);
  return parts.join(' ');
}

export function countWords(content: unknown): number {
  const words = extractPlainText(content).trim().split(/\s+/).filter(Boolean);
  return words.length;
}

export function countWordsInChapter(chapter: Chapter): number {
  return chapter.sections.reduce((sum, section) => sum + countWords(section.content), 0);
}

export function countWordsInBook(book: Book): number {
  return book.chapters.reduce((sum, chapter) => sum + countWordsInChapter(chapter), 0);
}
