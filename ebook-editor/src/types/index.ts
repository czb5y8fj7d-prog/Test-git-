export type PageFormat = 'A4' | 'A5';

export interface Margins {
  top: number; // mm
  right: number;
  bottom: number;
  left: number;
}

export interface StyleSettings {
  fontFamily: string;
  fontSize: number; // pt
  lineHeight: number; // unitless multiplier
}

export interface BookMeta {
  title: string;
  subtitle: string;
  author: string;
}

export interface PageSettings {
  format: PageFormat;
  margins: Margins;
}

export interface Section {
  id: string;
  title: string;
  styleOverride?: Partial<StyleSettings>;
  content: unknown; // Tiptap JSON document
}

export interface Chapter {
  id: string;
  title: string;
  styleOverride?: Partial<StyleSettings>;
  sections: Section[];
}

export interface Book {
  meta: BookMeta;
  globalStyle: StyleSettings;
  pageSettings: PageSettings;
  chapters: Chapter[];
}

export interface Selection {
  chapterId: string | null;
  sectionId: string | null;
}

export const FONT_OPTIONS: { label: string; value: string; category: 'serif' | 'sans' }[] = [
  { label: 'Georgia (serif)', value: 'Georgia, "Times New Roman", serif', category: 'serif' },
  { label: 'EB Garamond (serif)', value: '"EB Garamond", Georgia, serif', category: 'serif' },
  { label: 'Merriweather (serif)', value: '"Merriweather", Georgia, serif', category: 'serif' },
  { label: 'Lato (sans-serif)', value: '"Lato", Arial, sans-serif', category: 'sans' },
  { label: 'Open Sans (sans-serif)', value: '"Open Sans", Arial, sans-serif', category: 'sans' },
  { label: 'Source Sans Pro (sans-serif)', value: '"Source Sans Pro", Arial, sans-serif', category: 'sans' },
];

export const PAGE_DIMENSIONS_MM: Record<PageFormat, { width: number; height: number }> = {
  A4: { width: 210, height: 297 },
  A5: { width: 148, height: 210 },
};

export function createEmptyBook(): Book {
  return {
    meta: { title: 'Mon livre', subtitle: '', author: '' },
    globalStyle: { fontFamily: FONT_OPTIONS[0].value, fontSize: 12, lineHeight: 1.5 },
    pageSettings: {
      format: 'A5',
      margins: { top: 20, right: 18, bottom: 20, left: 18 },
    },
    chapters: [],
  };
}
