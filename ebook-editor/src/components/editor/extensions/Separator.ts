import { Node, mergeAttributes } from '@tiptap/core';

export type SeparatorVariant = 'line' | 'dots' | 'ornament';

const ORNAMENT_GLYPH: Record<SeparatorVariant, string> = {
  line: '',
  dots: '• • •',
  ornament: '❦',
};

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    separator: {
      setSeparator: (attrs?: { variant: SeparatorVariant }) => ReturnType;
    };
  }
}

export const Separator = Node.create({
  name: 'separator',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      variant: { default: 'line' as SeparatorVariant },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="separator"]' }];
  },

  renderHTML({ HTMLAttributes, node }) {
    const variant = (node.attrs.variant ?? 'line') as SeparatorVariant;
    return [
      'div',
      mergeAttributes(HTMLAttributes, { 'data-type': 'separator', class: `book-separator sep-${variant}` }),
      ORNAMENT_GLYPH[variant],
    ];
  },

  addCommands() {
    return {
      setSeparator:
        (attrs) =>
        ({ commands }) => {
          return commands.insertContent({ type: this.name, attrs: { variant: attrs?.variant ?? 'line' } });
        },
    };
  },
});
