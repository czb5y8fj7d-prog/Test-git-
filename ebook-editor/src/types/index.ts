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
  coverImage: string | null; // base64 data URL, full-bleed background on the title page
}

export interface PageSettings {
  format: PageFormat;
  margins: Margins;
}

export type ChapterNumbering = 'none' | 'numeric';
export type SeparatorStyle = 'line' | 'dots' | 'ornament';

export interface ThemeSettings {
  accentColor: string; // headings, TOC, dividers, page numbers
  pageBackgroundColor: string;
  dropCapEnabled: boolean;
  chapterNumbering: ChapterNumbering;
}

export interface ImageBlockStyle {
  rounded: boolean;
  shadow: boolean;
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
  theme: ThemeSettings;
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
  { label: 'Crimson Text (serif)', value: '"Crimson Text", Georgia, serif', category: 'serif' },
  { label: 'PT Serif (serif)', value: '"PT Serif", Georgia, serif', category: 'serif' },
  { label: 'Playfair Display (serif élégant)', value: '"Playfair Display", Georgia, serif', category: 'serif' },
  { label: 'Lato (sans-serif)', value: '"Lato", Arial, sans-serif', category: 'sans' },
  { label: 'Open Sans (sans-serif)', value: '"Open Sans", Arial, sans-serif', category: 'sans' },
  { label: 'Source Sans Pro (sans-serif)', value: '"Source Sans Pro", Arial, sans-serif', category: 'sans' },
  { label: 'Montserrat (sans-serif moderne)', value: '"Montserrat", Arial, sans-serif', category: 'sans' },
];

export const ACCENT_COLOR_SWATCHES = [
  '#7a5c3e', // brun (défaut)
  '#8b2e2e', // bordeaux
  '#2e5f4e', // vert forêt
  '#2e4a6b', // bleu marine
  '#6b4a8b', // prune
  '#b5651d', // ambre
  '#3a3a3a', // anthracite
];

export const PAGE_BACKGROUND_SWATCHES = ['#ffffff', '#fdf6e8', '#f7f3ee', '#f2f2ea', '#faf5f0'];

export const TEXT_COLOR_SWATCHES = [
  '#232323',
  '#8b2e2e',
  '#2e5f4e',
  '#2e4a6b',
  '#6b4a8b',
  '#b5651d',
  '#7a5c3e',
];

export const HIGHLIGHT_COLOR_SWATCHES = ['#fff2a8', '#c8f2c8', '#c8e6f2', '#f2c8e6', '#f2ddc8'];

export interface StylePreset {
  id: string;
  label: string;
  description: string;
  pageFormat: PageFormat;
  style: StyleSettings;
  accentColor: string;
}

export const STYLE_PRESETS: StylePreset[] = [
  {
    id: 'roman',
    label: 'Roman',
    description: 'Serif classique, interligne confortable, format A5.',
    pageFormat: 'A5',
    style: { fontFamily: FONT_OPTIONS[0].value, fontSize: 12, lineHeight: 1.5 },
    accentColor: '#7a5c3e',
  },
  {
    id: 'recueil',
    label: 'Recueil de poésie',
    description: 'Serif élégant, texte aéré, format A5.',
    pageFormat: 'A5',
    style: { fontFamily: '"Playfair Display", Georgia, serif', fontSize: 13, lineHeight: 1.75 },
    accentColor: '#6b4a8b',
  },
  {
    id: 'essai',
    label: 'Essai / Non-fiction',
    description: 'Sans-serif moderne et lisible, format A4.',
    pageFormat: 'A4',
    style: { fontFamily: '"Source Sans Pro", Arial, sans-serif', fontSize: 11, lineHeight: 1.4 },
    accentColor: '#2e4a6b',
  },
];

export const PAGE_DIMENSIONS_MM: Record<PageFormat, { width: number; height: number }> = {
  A4: { width: 210, height: 297 },
  A5: { width: 148, height: 210 },
};

/** Fills in defaults for fields absent from books saved by older versions of the app. */
export function normalizeBook(partial: Partial<Book> | null | undefined): Book {
  const empty = createEmptyBook();
  if (!partial) return empty;
  return {
    meta: { ...empty.meta, ...partial.meta },
    globalStyle: { ...empty.globalStyle, ...partial.globalStyle },
    theme: { ...empty.theme, ...partial.theme },
    pageSettings: {
      ...empty.pageSettings,
      ...partial.pageSettings,
      margins: { ...empty.pageSettings.margins, ...partial.pageSettings?.margins },
    },
    chapters: partial.chapters ?? [],
  };
}

export function createEmptyBook(): Book {
  return {
    meta: { title: 'Mon livre', subtitle: '', author: '', coverImage: null },
    globalStyle: { fontFamily: FONT_OPTIONS[0].value, fontSize: 12, lineHeight: 1.5 },
    theme: {
      accentColor: '#7a5c3e',
      pageBackgroundColor: '#ffffff',
      dropCapEnabled: false,
      chapterNumbering: 'none',
    },
    pageSettings: {
      format: 'A5',
      margins: { top: 20, right: 18, bottom: 20, left: 18 },
    },
    chapters: [],
  };
}
