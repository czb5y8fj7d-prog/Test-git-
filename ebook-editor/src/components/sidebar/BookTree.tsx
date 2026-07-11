import { useMemo, useState } from 'react';
import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Plus, BookOpen, Search, X } from 'lucide-react';
import { useBookStore } from '../../store/book';
import { countWordsInBook } from '../../lib/wordCount';
import { searchBook } from '../../lib/searchBook';
import { SortableChapter } from './SortableChapter';

export function BookTree() {
  const book = useBookStore((s) => s.book);
  const chapters = book.chapters;
  const selectedChapterId = useBookStore((s) => s.selectedChapterId);
  const selectedSectionId = useBookStore((s) => s.selectedSectionId);
  const addChapter = useBookStore((s) => s.addChapter);
  const reorderChapters = useBookStore((s) => s.reorderChapters);
  const select = useBookStore((s) => s.select);
  const isCoverActive = selectedChapterId === null;
  const [query, setQuery] = useState('');

  const results = useMemo(() => searchBook(book, query), [book, query]);
  const totalWords = useMemo(() => countWordsInBook(book), [book]);

  const handleChapterDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = chapters.findIndex((c) => c.id === active.id);
    const newIndex = chapters.findIndex((c) => c.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    reorderChapters(oldIndex, newIndex);
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h2>Structure du livre</h2>
      </div>

      <div className="sidebar-search">
        <Search size={14} />
        <input
          type="text"
          placeholder="Rechercher dans le livre…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {query && (
          <button type="button" onClick={() => setQuery('')} title="Effacer la recherche">
            <X size={14} />
          </button>
        )}
      </div>

      {query.trim() ? (
        <div className="search-results">
          {results.length === 0 && <div className="empty-hint">Aucun résultat pour « {query} »</div>}
          {results.map((r) => (
            <button
              key={r.sectionId}
              type="button"
              className="search-result"
              onClick={() => {
                select(r.chapterId, r.sectionId);
                setQuery('');
              }}
            >
              <span className="search-result-path">
                {r.chapterTitle} <span className="sep">/</span> {r.sectionTitle}
              </span>
              <span className="search-result-excerpt">{r.excerpt}</span>
            </button>
          ))}
        </div>
      ) : (
        <>
          <div className={`tree-row cover-row ${isCoverActive ? 'is-active' : ''}`} onClick={() => select(null, null)}>
            <BookOpen size={14} />
            <span className="tree-label">Page de garde</span>
          </div>

          <div className="sidebar-section-title">Chapitres</div>

          <DndContext collisionDetection={closestCenter} onDragEnd={handleChapterDragEnd}>
            <SortableContext items={chapters.map((c) => c.id)} strategy={verticalListSortingStrategy}>
              <div className="tree-chapters">
                {chapters.map((chapter, index) => (
                  <SortableChapter
                    key={chapter.id}
                    chapter={chapter}
                    index={index}
                    selectedChapterId={selectedChapterId}
                    selectedSectionId={selectedSectionId}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          <button type="button" className="add-chapter-btn" onClick={addChapter}>
            <Plus size={14} /> Ajouter un chapitre
          </button>
        </>
      )}

      <div className="sidebar-footer">{totalWords.toLocaleString('fr-FR')} mots au total</div>
    </aside>
  );
}
