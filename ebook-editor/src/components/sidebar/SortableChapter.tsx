import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { GripVertical, Plus, Trash2, ChevronDown, ChevronRight, Pencil } from 'lucide-react';
import type { Chapter } from '../../types';
import { useBookStore } from '../../store/book';
import { SortableSection } from './SortableSection';

interface SortableChapterProps {
  chapter: Chapter;
  index: number;
  selectedChapterId: string | null;
  selectedSectionId: string | null;
}

export function SortableChapter({ chapter, selectedChapterId, selectedSectionId }: SortableChapterProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: chapter.id });
  const [expanded, setExpanded] = useState(true);
  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(chapter.title);

  const select = useBookStore((s) => s.select);
  const addSection = useBookStore((s) => s.addSection);
  const removeChapter = useBookStore((s) => s.removeChapter);
  const renameChapter = useBookStore((s) => s.renameChapter);
  const reorderSections = useBookStore((s) => s.reorderSections);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const commitRename = () => {
    setEditing(false);
    const trimmed = draftTitle.trim();
    if (trimmed && trimmed !== chapter.title) renameChapter(chapter.id, trimmed);
    else setDraftTitle(chapter.title);
  };

  const handleSectionDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = chapter.sections.findIndex((s) => s.id === active.id);
    const newIndex = chapter.sections.findIndex((s) => s.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    reorderSections(chapter.id, oldIndex, newIndex);
  };

  const isChapterActive = selectedChapterId === chapter.id && !selectedSectionId;

  return (
    <div ref={setNodeRef} style={style} className="tree-chapter">
      <div className={`tree-row chapter-row ${isChapterActive ? 'is-active' : ''}`}>
        <button type="button" className="drag-handle" {...attributes} {...listeners} title="Réordonner">
          <GripVertical size={14} />
        </button>
        <button type="button" className="disclosure" onClick={() => setExpanded((v) => !v)}>
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
        {editing ? (
          <input
            className="rename-input"
            autoFocus
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename();
              if (e.key === 'Escape') {
                setDraftTitle(chapter.title);
                setEditing(false);
              }
            }}
          />
        ) : (
          <span className="tree-label" onClick={() => select(chapter.id, null)}>
            {chapter.title}
          </span>
        )}
        <button type="button" onClick={() => setEditing(true)} title="Renommer">
          <Pencil size={13} />
        </button>
        <button type="button" onClick={() => addSection(chapter.id)} title="Ajouter une section">
          <Plus size={13} />
        </button>
        <button
          type="button"
          className="danger"
          onClick={() => {
            if (confirm(`Supprimer le chapitre « ${chapter.title} » et son contenu ?`)) removeChapter(chapter.id);
          }}
          title="Supprimer le chapitre"
        >
          <Trash2 size={13} />
        </button>
      </div>

      {expanded && (
        <DndContext collisionDetection={closestCenter} onDragEnd={handleSectionDragEnd}>
          <SortableContext items={chapter.sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            <div className="tree-sections">
              {chapter.sections.map((section) => (
                <SortableSection
                  key={section.id}
                  chapterId={chapter.id}
                  section={section}
                  isActive={selectedSectionId === section.id}
                />
              ))}
              {chapter.sections.length === 0 && <div className="empty-hint">Aucune section</div>}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}

export { arrayMove };
