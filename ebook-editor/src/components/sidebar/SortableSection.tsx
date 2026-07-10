import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Trash2, Pencil } from 'lucide-react';
import type { Section } from '../../types';
import { useBookStore } from '../../store/book';

interface SortableSectionProps {
  chapterId: string;
  section: Section;
  isActive: boolean;
}

export function SortableSection({ chapterId, section, isActive }: SortableSectionProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: section.id });
  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(section.title);

  const select = useBookStore((s) => s.select);
  const removeSection = useBookStore((s) => s.removeSection);
  const renameSection = useBookStore((s) => s.renameSection);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const commitRename = () => {
    setEditing(false);
    const trimmed = draftTitle.trim();
    if (trimmed && trimmed !== section.title) renameSection(chapterId, section.id, trimmed);
    else setDraftTitle(section.title);
  };

  return (
    <div ref={setNodeRef} style={style} className={`tree-row section-row ${isActive ? 'is-active' : ''}`}>
      <button type="button" className="drag-handle" {...attributes} {...listeners} title="Réordonner">
        <GripVertical size={13} />
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
              setDraftTitle(section.title);
              setEditing(false);
            }
          }}
        />
      ) : (
        <span className="tree-label" onClick={() => select(chapterId, section.id)}>
          {section.title}
        </span>
      )}
      <button type="button" onClick={() => setEditing(true)} title="Renommer">
        <Pencil size={12} />
      </button>
      <button
        type="button"
        className="danger"
        onClick={() => {
          if (confirm(`Supprimer la section « ${section.title} » ?`)) removeSection(chapterId, section.id);
        }}
        title="Supprimer la section"
      >
        <Trash2 size={12} />
      </button>
    </div>
  );
}
