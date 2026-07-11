import { useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { Highlight } from '@tiptap/extension-highlight';
import Placeholder from '@tiptap/extension-placeholder';
import { FontFamily } from './extensions/FontFamily';
import { FontSize } from './extensions/FontSize';
import { ImageBlock } from './extensions/ImageBlock';
import { Separator } from './extensions/Separator';
import { EditorToolbar } from './EditorToolbar';
import { useBookStore } from '../../store/book';

interface TiptapEditorProps {
  chapterId: string;
  sectionId: string;
  content: unknown;
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
}

export function TiptapEditor({ chapterId, sectionId, content, fontFamily, fontSize, lineHeight }: TiptapEditorProps) {
  const updateSectionContent = useBookStore((s) => s.updateSectionContent);

  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
        TextStyle,
        FontFamily,
        FontSize,
        Color,
        Highlight.configure({ multicolor: true }),
        TextAlign.configure({ types: ['heading', 'paragraph'] }),
        ImageBlock,
        Separator,
        Placeholder.configure({ placeholder: 'Écrivez ou collez votre texte ici…' }),
      ],
      content: content as object,
      onUpdate: ({ editor }) => {
        updateSectionContent(chapterId, sectionId, editor.getJSON());
      },
    },
    [chapterId, sectionId]
  );

  useEffect(() => {
    if (editor && content && JSON.stringify(editor.getJSON()) !== JSON.stringify(content)) {
      editor.commands.setContent(content as object, { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapterId, sectionId]);

  if (!editor) return null;

  return (
    <div className="tiptap-editor">
      <EditorToolbar editor={editor} />
      <div
        className="tiptap-content-scroll"
        style={{
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ['--edit-font-family' as any]: fontFamily,
          ['--edit-font-size' as any]: `${fontSize}pt`,
          ['--edit-line-height' as any]: lineHeight,
        }}
      >
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
