import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { ImageBlockView } from './ImageBlockView';

export type ImageAlign = 'left' | 'center' | 'right';

export interface ImageBlockAttrs {
  src: string;
  alt: string;
  caption: string;
  width: number; // percentage of container width, 10-100
  align: ImageAlign;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    imageBlock: {
      insertImageBlock: (attrs: Partial<ImageBlockAttrs> & { src: string }) => ReturnType;
      updateImageBlock: (attrs: Partial<ImageBlockAttrs>) => ReturnType;
    };
  }
}

export const ImageBlock = Node.create({
  name: 'imageBlock',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      src: { default: '' },
      alt: { default: '' },
      caption: { default: '' },
      width: { default: 60 },
      align: { default: 'center' },
    };
  },

  parseHTML() {
    return [{ tag: 'figure[data-type="image-block"]' }];
  },

  renderHTML({ HTMLAttributes, node }) {
    const { src, alt, caption, width, align } = node.attrs as ImageBlockAttrs;
    return [
      'figure',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'image-block',
        style: `width: ${width}%; text-align: ${align}; margin-left: ${
          align === 'center' ? 'auto' : align === 'right' ? 'auto' : '0'
        }; margin-right: ${align === 'center' ? 'auto' : align === 'left' ? 'auto' : '0'};`,
      }),
      ['img', { src, alt }],
      caption ? ['figcaption', {}, caption] : ['figcaption', { style: 'display:none' }],
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageBlockView);
  },

  addCommands() {
    return {
      insertImageBlock:
        (attrs) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: { alt: '', caption: '', width: 60, align: 'center', ...attrs },
          });
        },
      updateImageBlock:
        (attrs) =>
        ({ commands }) => {
          return commands.updateAttributes(this.name, attrs);
        },
    };
  },
});
