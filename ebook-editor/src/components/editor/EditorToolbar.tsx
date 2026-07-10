import { useRef } from 'react';
import type { Editor } from '@tiptap/react';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  Heading3,
  Quote,
  Minus,
  ImageIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
} from 'lucide-react';
import { FONT_OPTIONS } from '../../types';

interface EditorToolbarProps {
  editor: Editor;
}

const FONT_SIZES = [9, 10, 11, 12, 13, 14, 16, 18, 20, 24, 28];
const LINE_HEIGHTS = [1, 1.15, 1.3, 1.5, 1.75, 2];

export function EditorToolbar({ editor }: EditorToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageChosen = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      editor.chain().focus().insertImageBlock({ src: reader.result as string, alt: file.name }).run();
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const currentFontFamily = editor.getAttributes('fontFamily').fontFamily ?? '';
  const currentFontSize = editor.getAttributes('fontSize').fontSize ?? '';

  return (
    <div className="editor-toolbar">
      <div className="toolbar-group">
        <button
          type="button"
          className={editor.isActive('bold') ? 'active' : ''}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="Gras"
        >
          <Bold size={16} />
        </button>
        <button
          type="button"
          className={editor.isActive('italic') ? 'active' : ''}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="Italique"
        >
          <Italic size={16} />
        </button>
        <button
          type="button"
          className={editor.isActive('underline') ? 'active' : ''}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          title="Souligné"
        >
          <UnderlineIcon size={16} />
        </button>
      </div>

      <div className="toolbar-group">
        <button
          type="button"
          className={editor.isActive('heading', { level: 1 }) ? 'active' : ''}
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          title="Titre 1"
        >
          <Heading1 size={16} />
        </button>
        <button
          type="button"
          className={editor.isActive('heading', { level: 2 }) ? 'active' : ''}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          title="Titre 2"
        >
          <Heading2 size={16} />
        </button>
        <button
          type="button"
          className={editor.isActive('heading', { level: 3 }) ? 'active' : ''}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          title="Titre 3"
        >
          <Heading3 size={16} />
        </button>
      </div>

      <div className="toolbar-group">
        <button
          type="button"
          className={editor.isActive('bulletList') ? 'active' : ''}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          title="Liste à puces"
        >
          <List size={16} />
        </button>
        <button
          type="button"
          className={editor.isActive('orderedList') ? 'active' : ''}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          title="Liste numérotée"
        >
          <ListOrdered size={16} />
        </button>
        <button
          type="button"
          className={editor.isActive('blockquote') ? 'active' : ''}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          title="Citation"
        >
          <Quote size={16} />
        </button>
        <button type="button" onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Séparateur">
          <Minus size={16} />
        </button>
      </div>

      <div className="toolbar-group">
        <button
          type="button"
          className={editor.isActive({ textAlign: 'left' }) ? 'active' : ''}
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
          title="Aligner à gauche"
        >
          <AlignLeft size={16} />
        </button>
        <button
          type="button"
          className={editor.isActive({ textAlign: 'center' }) ? 'active' : ''}
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
          title="Centrer"
        >
          <AlignCenter size={16} />
        </button>
        <button
          type="button"
          className={editor.isActive({ textAlign: 'right' }) ? 'active' : ''}
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
          title="Aligner à droite"
        >
          <AlignRight size={16} />
        </button>
      </div>

      <div className="toolbar-group">
        <select
          value={currentFontFamily}
          onChange={(e) => {
            if (e.target.value) editor.chain().focus().setFontFamily(e.target.value).run();
            else editor.chain().focus().unsetFontFamily().run();
          }}
          title="Police (sélection)"
        >
          <option value="">Police du style</option>
          {FONT_OPTIONS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
        <select
          value={currentFontSize}
          onChange={(e) => {
            if (e.target.value) editor.chain().focus().setFontSize(e.target.value).run();
            else editor.chain().focus().unsetFontSize().run();
          }}
          title="Taille (sélection)"
        >
          <option value="">Taille du style</option>
          {FONT_SIZES.map((s) => (
            <option key={s} value={`${s}pt`}>
              {s} pt
            </option>
          ))}
        </select>
      </div>

      <div className="toolbar-group">
        <button type="button" onClick={() => fileInputRef.current?.click()} title="Insérer une image">
          <ImageIcon size={16} />
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={handleImageChosen} />
      </div>
    </div>
  );
}

export { FONT_SIZES, LINE_HEIGHTS };
