import { generateHTML } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import { FontFamily } from '../components/editor/extensions/FontFamily';
import { FontSize } from '../components/editor/extensions/FontSize';
import { ImageBlock } from '../components/editor/extensions/ImageBlock';
import type { Book, StyleSettings } from '../types';
import { PAGE_DIMENSIONS_MM } from '../types';
import { getEffectiveStyle } from '../store/book';

const CONTENT_EXTENSIONS = [
  StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
  TextStyle,
  FontFamily,
  FontSize,
  TextAlign.configure({ types: ['heading', 'paragraph'] }),
  ImageBlock,
];

function sectionContentToHtml(content: unknown): string {
  try {
    return generateHTML(content as object, CONTENT_EXTENSIONS);
  } catch {
    return '';
  }
}

function styleToCss(style: StyleSettings): string {
  return `font-family: ${style.fontFamily}; font-size: ${style.fontSize}pt; line-height: ${style.lineHeight};`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildBookBodyHtml(book: Book): string {
  const parts: string[] = [];

  parts.push(`
    <section class="cover-page">
      <div class="cover-inner">
        <h1 class="cover-title">${escapeHtml(book.meta.title || 'Sans titre')}</h1>
        ${book.meta.subtitle ? `<p class="cover-subtitle">${escapeHtml(book.meta.subtitle)}</p>` : ''}
        ${book.meta.author ? `<p class="cover-author">${escapeHtml(book.meta.author)}</p>` : ''}
      </div>
    </section>
  `);

  parts.push(`
    <section class="toc-page">
      <h2 class="toc-title">Table des matières</h2>
      <ul class="toc-list">
        ${book.chapters
          .map((chapter) => `<li class="toc-entry toc-chapter"><a href="#chapter-${chapter.id}">${escapeHtml(chapter.title)}</a></li>`)
          .join('\n')}
      </ul>
    </section>
  `);

  for (const chapter of book.chapters) {
    const chapterStyle = getEffectiveStyle(book, chapter);
    const sectionsHtml = chapter.sections
      .map((section) => {
        const sectionStyle = getEffectiveStyle(book, chapter, section);
        return `
          <div class="section" id="section-${section.id}" style="${styleToCss(sectionStyle)}">
            <h3 class="section-title">${escapeHtml(section.title)}</h3>
            <div class="section-content">${sectionContentToHtml(section.content)}</div>
          </div>
        `;
      })
      .join('\n');

    parts.push(`
      <section class="chapter" id="chapter-${chapter.id}" style="${styleToCss(chapterStyle)}">
        <h1 class="chapter-title">${escapeHtml(chapter.title)}</h1>
        ${sectionsHtml}
      </section>
    `);
  }

  return parts.join('\n');
}

export function buildPrintCss(book: Book): string {
  const { width, height } = PAGE_DIMENSIONS_MM[book.pageSettings.format];
  const { top, right, bottom, left } = book.pageSettings.margins;
  const global = book.globalStyle;

  return `
    @page {
      size: ${width}mm ${height}mm;
      margin: ${top}mm ${right}mm ${bottom}mm ${left}mm;
      @bottom-center {
        content: counter(page);
        font-family: ${global.fontFamily};
        font-size: 9pt;
        color: #666;
      }
    }

    @page :first {
      @bottom-center { content: ""; }
    }

    html, body {
      font-family: ${global.fontFamily};
      font-size: ${global.fontSize}pt;
      line-height: ${global.lineHeight};
      color: #1a1a1a;
    }

    .cover-page {
      break-after: page;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      text-align: center;
    }
    .cover-inner { width: 100%; }
    .cover-title { font-size: 2.4em; margin-bottom: 0.4em; }
    .cover-subtitle { font-size: 1.3em; font-weight: normal; color: #444; margin-bottom: 2em; }
    .cover-author { font-size: 1.1em; margin-top: 4em; }

    .toc-page { break-after: page; }
    .toc-title { font-size: 1.6em; margin-bottom: 1em; }
    .toc-list { list-style: none; padding: 0; margin: 0; }
    .toc-entry { margin-bottom: 0.6em; }
    .toc-entry a { text-decoration: none; color: inherit; display: flex; }
    .toc-entry a::after {
      content: target-counter(attr(href), page);
      margin-left: auto;
      padding-left: 1em;
    }
    .toc-entry a::before {
      content: target-text(attr(href));
    }
    .toc-chapter { font-weight: bold; }

    .chapter { break-before: page; }
    .chapter-title {
      font-size: 1.8em;
      margin-bottom: 1em;
      border-bottom: 1px solid #ccc;
      padding-bottom: 0.3em;
    }
    .section { margin-bottom: 1.5em; }
    .section-title { font-size: 1.2em; margin-bottom: 0.5em; }

    .section-content p { margin: 0 0 0.9em 0; }
    .section-content h1 { font-size: 1.6em; break-after: avoid; }
    .section-content h2 { font-size: 1.35em; break-after: avoid; }
    .section-content h3 { font-size: 1.15em; break-after: avoid; }
    .section-content ul, .section-content ol { margin: 0 0 0.9em 1.4em; }
    .section-content blockquote {
      border-left: 3px solid #ccc;
      margin: 0 0 0.9em 0;
      padding-left: 1em;
      color: #444;
      font-style: italic;
    }
    .section-content hr { border: none; border-top: 1px solid #ccc; margin: 1.5em 0; }

    figure[data-type="image-block"] {
      margin: 1em 0;
      break-inside: avoid;
    }
    figure[data-type="image-block"] img { max-width: 100%; display: block; }
    figure[data-type="image-block"] figcaption {
      font-size: 0.85em;
      color: #555;
      text-align: center;
      margin-top: 0.4em;
      font-style: italic;
    }
  `;
}
