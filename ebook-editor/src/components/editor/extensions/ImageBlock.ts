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
  rounded: boolean;
  shadow: boolean;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    imageBlock: {
      insertImageBlock: (attrs: Partial<ImageBlockAttrs> & { src: string }) => ReturnType;
      updateImageBlock: (attrs: Partial<ImageBlockAttrs>) => ReturnType;
    };
  }
}

function imgStyle(rounded: boolean, shadow: boolean): string {
  const parts = ['max-width: 100%', 'display: block'];
  if (rounded) parts.push('border-radius: 14px');
  if (shadow) parts.push('box-shadow: 0 6px 18px rgba(0,0,0,0.22)');
  return parts.join('; ');
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
      rounded: { default: false },
      shadow: { default: false },
    };
  },

  parseHTML() {
    return [{ tag: 'figure[data-type="image-block"]' }];
  },

  renderHTML({ HTMLAttributes, node }) {
    const { src, alt, caption, width, align, rounded, shadow } = node.attrs as ImageBlockAttrs;
    return [
      'figure',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'image-block',
        style: `width: ${width}%; text-align: ${align}; margin-left: ${
          align === 'center' ? 'auto' : align === 'right' ? 'auto' : '0'
        }; margin-right: ${align === 'center' ? 'auto' : align === 'left' ? 'auto' : '0'};`,
      }),
      ['img', { src, alt, style: imgStyle(rounded, shadow) }],
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
            attrs: { alt: '', caption: '', width: 60, align: 'center', rounded: false, shadow: false, ...attrs },
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
