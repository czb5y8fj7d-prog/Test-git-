import { useCallback, useRef, useState } from 'react';
import { NodeViewWrapper } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';
import { AlignLeft, AlignCenter, AlignRight, Square, CircleDot } from 'lucide-react';
import type { ImageAlign } from './ImageBlock';

export function ImageBlockView({ node, updateAttributes, selected }: NodeViewProps) {
  const { src, alt, caption, width, align, rounded, shadow } = node.attrs as {
    src: string;
    alt: string;
    caption: string;
    width: number;
    align: ImageAlign;
    rounded: boolean;
    shadow: boolean;
  };
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [resizing, setResizing] = useState(false);

  const handleResizeStart = useCallback(
    (event: React.PointerEvent) => {
      event.preventDefault();
      const container = wrapperRef.current?.parentElement;
      if (!container) return;
      const containerWidth = container.clientWidth;
      const startX = event.clientX;
      const startWidth = width;
      setResizing(true);

      function onMove(moveEvent: PointerEvent) {
        const deltaPx = moveEvent.clientX - startX;
        const deltaPercent = (deltaPx / containerWidth) * 100;
        const next = Math.min(100, Math.max(15, Math.round(startWidth + deltaPercent)));
        updateAttributes({ width: next });
      }
      function onUp() {
        setResizing(false);
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
      }
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    },
    [width, updateAttributes]
  );

  const setAlign = (next: ImageAlign) => updateAttributes({ align: next });

  const imgStyle: React.CSSProperties = {
    borderRadius: rounded ? 14 : 0,
    boxShadow: shadow ? '0 6px 18px rgba(0,0,0,0.22)' : 'none',
  };

  return (
    <NodeViewWrapper
      className={`image-block-wrapper align-${align}`}
      style={{ width: `${width}%` }}
      ref={wrapperRef}
    >
      <figure className={`image-block ${selected ? 'is-selected' : ''} ${resizing ? 'is-resizing' : ''}`}>
        <div className="image-block-toolbar" contentEditable={false}>
          <button type="button" className={align === 'left' ? 'active' : ''} onClick={() => setAlign('left')} title="Aligner à gauche">
            <AlignLeft size={14} />
          </button>
          <button type="button" className={align === 'center' ? 'active' : ''} onClick={() => setAlign('center')} title="Centrer">
            <AlignCenter size={14} />
          </button>
          <button type="button" className={align === 'right' ? 'active' : ''} onClick={() => setAlign('right')} title="Aligner à droite">
            <AlignRight size={14} />
          </button>
          <span className="image-block-toolbar-sep" />
          <button
            type="button"
            className={rounded ? 'active' : ''}
            onClick={() => updateAttributes({ rounded: !rounded })}
            title="Coins arrondis"
          >
            <CircleDot size={14} />
          </button>
          <button
            type="button"
            className={shadow ? 'active' : ''}
            onClick={() => updateAttributes({ shadow: !shadow })}
            title="Ombre portée"
          >
            <Square size={14} />
          </button>
        </div>
        <img src={src} alt={alt} draggable={false} style={imgStyle} />
        <input
          className="image-block-caption"
          type="text"
          placeholder="Légende (optionnelle)"
          value={caption}
          onChange={(e) => updateAttributes({ caption: e.target.value })}
        />
        <div className="image-resize-handle" onPointerDown={handleResizeStart} contentEditable={false} />
      </figure>
    </NodeViewWrapper>
  );
}
