import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Plus, BookOpen } from 'lucide-react';
import { useBookStore } from '../../store/book';
import { SortableChapter } from './SortableChapter';

export function BookTree() {
  const chapters = useBookStore((s) => s.book.chapters);
  const selectedChapterId = useBookStore((s) => s.selectedChapterId);
  const selectedSectionId = useBookStore((s) => s.selectedSectionId);
  const addChapter = useBookStore((s) => s.addChapter);
  const reorderChapters = useBookStore((s) => s.reorderChapters);
  const select = useBookStore((s) => s.select);
  const isCoverActive = selectedChapterId === null;

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
    </aside>
  );
}
