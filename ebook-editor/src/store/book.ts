import { create } from 'zustand';
import { nanoid } from 'nanoid';
import type { Book, BookMeta, Chapter, PageSettings, Section, StyleSettings } from '../types';
import { createEmptyBook } from '../types';
import { loadBook, scheduleAutosave } from '../lib/storage';
import { useUiStore } from './ui';

interface BookState {
  book: Book;
  selectedChapterId: string | null;
  selectedSectionId: string | null;
  hydrated: boolean;

  hydrate: () => Promise<void>;
  replaceBook: (book: Book) => void;

  updateMeta: (meta: Partial<BookMeta>) => void;
  updateGlobalStyle: (style: Partial<StyleSettings>) => void;
  updatePageSettings: (settings: Partial<PageSettings>) => void;

  addChapter: () => void;
  renameChapter: (chapterId: string, title: string) => void;
  removeChapter: (chapterId: string) => void;
  reorderChapters: (fromIndex: number, toIndex: number) => void;
  updateChapterStyle: (chapterId: string, style: Partial<StyleSettings> | undefined) => void;

  addSection: (chapterId: string) => void;
  renameSection: (chapterId: string, sectionId: string, title: string) => void;
  removeSection: (chapterId: string, sectionId: string) => void;
  reorderSections: (chapterId: string, fromIndex: number, toIndex: number) => void;
  moveSection: (fromChapterId: string, sectionId: string, toChapterId: string, toIndex: number) => void;
  updateSectionContent: (chapterId: string, sectionId: string, content: unknown) => void;
  updateSectionStyle: (chapterId: string, sectionId: string, style: Partial<StyleSettings> | undefined) => void;

  select: (chapterId: string | null, sectionId: string | null) => void;
}

function persist(book: Book) {
  scheduleAutosave(book);
}

export const useBookStore = create<BookState>((set, get) => ({
  book: createEmptyBook(),
  selectedChapterId: null,
  selectedSectionId: null,
  hydrated: false,

  hydrate: async () => {
    const stored = await loadBook();
    if (stored) {
      const firstChapter = stored.chapters[0];
      set({
        book: stored,
        hydrated: true,
        selectedChapterId: firstChapter?.id ?? null,
        selectedSectionId: firstChapter?.sections[0]?.id ?? null,
      });
    } else {
      set({ hydrated: true });
    }
  },

  replaceBook: (book) => {
    const firstChapter = book.chapters[0];
    set({
      book,
      selectedChapterId: firstChapter?.id ?? null,
      selectedSectionId: firstChapter?.sections[0]?.id ?? null,
    });
    persist(book);
  },

  updateMeta: (meta) => {
    const book = { ...get().book, meta: { ...get().book.meta, ...meta } };
    set({ book });
    persist(book);
  },

  updateGlobalStyle: (style) => {
    const book = { ...get().book, globalStyle: { ...get().book.globalStyle, ...style } };
    set({ book });
    persist(book);
  },

  updatePageSettings: (settings) => {
    const current = get().book.pageSettings;
    const book = {
      ...get().book,
      pageSettings: {
        ...current,
        ...settings,
        margins: { ...current.margins, ...settings.margins },
      },
    };
    set({ book });
    persist(book);
  },

  addChapter: () => {
    const newChapter: Chapter = { id: nanoid(), title: 'Nouveau chapitre', sections: [] };
    const book = { ...get().book, chapters: [...get().book.chapters, newChapter] };
    set({ book, selectedChapterId: newChapter.id, selectedSectionId: null });
    persist(book);
  },

  renameChapter: (chapterId, title) => {
    const book = {
      ...get().book,
      chapters: get().book.chapters.map((c) => (c.id === chapterId ? { ...c, title } : c)),
    };
    set({ book });
    persist(book);
  },

  removeChapter: (chapterId) => {
    const chapters = get().book.chapters.filter((c) => c.id !== chapterId);
    const book = { ...get().book, chapters };
    const stillSelected = get().selectedChapterId === chapterId;
    set({
      book,
      selectedChapterId: stillSelected ? null : get().selectedChapterId,
      selectedSectionId: stillSelected ? null : get().selectedSectionId,
    });
    persist(book);
  },

  reorderChapters: (fromIndex, toIndex) => {
    const chapters = [...get().book.chapters];
    const [moved] = chapters.splice(fromIndex, 1);
    chapters.splice(toIndex, 0, moved);
    const book = { ...get().book, chapters };
    set({ book });
    persist(book);
  },

  updateChapterStyle: (chapterId, style) => {
    const book = {
      ...get().book,
      chapters: get().book.chapters.map((c) => (c.id === chapterId ? { ...c, styleOverride: style } : c)),
    };
    set({ book });
    persist(book);
  },

  addSection: (chapterId) => {
    const newSection: Section = {
      id: nanoid(),
      title: 'Nouvelle section',
      content: { type: 'doc', content: [{ type: 'paragraph' }] },
    };
    const book = {
      ...get().book,
      chapters: get().book.chapters.map((c) =>
        c.id === chapterId ? { ...c, sections: [...c.sections, newSection] } : c
      ),
    };
    set({ book, selectedChapterId: chapterId, selectedSectionId: newSection.id });
    useUiStore.getState().setMobilePanel('editeur');
    persist(book);
  },

  renameSection: (chapterId, sectionId, title) => {
    const book = {
      ...get().book,
      chapters: get().book.chapters.map((c) =>
        c.id === chapterId
          ? { ...c, sections: c.sections.map((s) => (s.id === sectionId ? { ...s, title } : s)) }
          : c
      ),
    };
    set({ book });
    persist(book);
  },

  removeSection: (chapterId, sectionId) => {
    const book = {
      ...get().book,
      chapters: get().book.chapters.map((c) =>
        c.id === chapterId ? { ...c, sections: c.sections.filter((s) => s.id !== sectionId) } : c
      ),
    };
    const stillSelected = get().selectedSectionId === sectionId;
    set({ book, selectedSectionId: stillSelected ? null : get().selectedSectionId });
    persist(book);
  },

  reorderSections: (chapterId, fromIndex, toIndex) => {
    const book = {
      ...get().book,
      chapters: get().book.chapters.map((c) => {
        if (c.id !== chapterId) return c;
        const sections = [...c.sections];
        const [moved] = sections.splice(fromIndex, 1);
        sections.splice(toIndex, 0, moved);
        return { ...c, sections };
      }),
    };
    set({ book });
    persist(book);
  },

  moveSection: (fromChapterId, sectionId, toChapterId, toIndex) => {
    const chapters = get().book.chapters;
    const fromChapter = chapters.find((c) => c.id === fromChapterId);
    const section = fromChapter?.sections.find((s) => s.id === sectionId);
    if (!section) return;
    const newChapters = chapters.map((c) => {
      if (c.id === fromChapterId && c.id === toChapterId) {
        const sections = c.sections.filter((s) => s.id !== sectionId);
        sections.splice(toIndex, 0, section);
        return { ...c, sections };
      }
      if (c.id === fromChapterId) {
        return { ...c, sections: c.sections.filter((s) => s.id !== sectionId) };
      }
      if (c.id === toChapterId) {
        const sections = [...c.sections];
        sections.splice(toIndex, 0, section);
        return { ...c, sections };
      }
      return c;
    });
    const book = { ...get().book, chapters: newChapters };
    set({ book });
    persist(book);
  },

  updateSectionContent: (chapterId, sectionId, content) => {
    const book = {
      ...get().book,
      chapters: get().book.chapters.map((c) =>
        c.id === chapterId
          ? { ...c, sections: c.sections.map((s) => (s.id === sectionId ? { ...s, content } : s)) }
          : c
      ),
    };
    set({ book });
    persist(book);
  },

  updateSectionStyle: (chapterId, sectionId, style) => {
    const book = {
      ...get().book,
      chapters: get().book.chapters.map((c) =>
        c.id === chapterId
          ? {
              ...c,
              sections: c.sections.map((s) => (s.id === sectionId ? { ...s, styleOverride: style } : s)),
            }
          : c
      ),
    };
    set({ book });
    persist(book);
  },

  select: (chapterId, sectionId) => {
    set({ selectedChapterId: chapterId, selectedSectionId: sectionId });
    useUiStore.getState().setMobilePanel('editeur');
  },
}));

export function getEffectiveStyle(book: Book, chapter?: Chapter, section?: Section): StyleSettings {
  return {
    ...book.globalStyle,
    ...chapter?.styleOverride,
    ...section?.styleOverride,
  };
}
