import { useBookStore, getEffectiveStyle } from '../../store/book';
import { countWords } from '../../lib/wordCount';
import { CoverEditor } from './CoverEditor';
import { TiptapEditor } from './TiptapEditor';

export function EditorArea() {
  const book = useBookStore((s) => s.book);
  const selectedChapterId = useBookStore((s) => s.selectedChapterId);
  const selectedSectionId = useBookStore((s) => s.selectedSectionId);

  if (selectedChapterId === null) {
    return (
      <main className="editor-area">
        <CoverEditor />
      </main>
    );
  }

  const chapter = book.chapters.find((c) => c.id === selectedChapterId);
  if (!chapter) {
    return (
      <main className="editor-area">
        <div className="empty-state">Sélectionnez un chapitre ou une section dans l'arborescence.</div>
      </main>
    );
  }

  const section = chapter.sections.find((s) => s.id === selectedSectionId);
  if (!section) {
    return (
      <main className="editor-area">
        <div className="empty-state">
          <p>
            Chapitre : <strong>{chapter.title}</strong>
          </p>
          <p>Sélectionnez une section dans l'arborescence, ou ajoutez-en une nouvelle.</p>
        </div>
      </main>
    );
  }

  const style = getEffectiveStyle(book, chapter, section);
  const wordCount = countWords(section.content);

  return (
    <main className="editor-area">
      <div className="editor-breadcrumb">
        <span>
          {chapter.title} <span className="sep">/</span> {section.title}
        </span>
        <span className="word-count">{wordCount} mot{wordCount !== 1 ? 's' : ''}</span>
      </div>
      <TiptapEditor
        key={section.id}
        chapterId={chapter.id}
        sectionId={section.id}
        content={section.content}
        fontFamily={style.fontFamily}
        fontSize={style.fontSize}
        lineHeight={style.lineHeight}
      />
    </main>
  );
}
