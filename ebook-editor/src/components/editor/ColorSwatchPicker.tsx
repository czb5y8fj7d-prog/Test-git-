import { useEffect, useRef, useState } from 'react';
import { Ban } from 'lucide-react';

interface ColorSwatchPickerProps {
  icon: React.ReactNode;
  title: string;
  swatches: string[];
  activeColor: string | null;
  onPick: (color: string) => void;
  onClear: () => void;
}

export function ColorSwatchPicker({ icon, title, swatches, activeColor, onPick, onClear }: ColorSwatchPickerProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onMouseDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [open]);

  return (
    <div className="color-swatch-picker" ref={rootRef}>
      <button
        type="button"
        title={title}
        onClick={() => setOpen((v) => !v)}
        style={{ boxShadow: activeColor ? `inset 0 -3px 0 ${activeColor}` : undefined }}
      >
        {icon}
      </button>
      {open && (
        <div className="color-swatch-popover">
          {swatches.map((color) => (
            <button
              key={color}
              type="button"
              className="color-swatch"
              style={{ background: color }}
              onClick={() => {
                onPick(color);
                setOpen(false);
              }}
              title={color}
            />
          ))}
          <label className="color-swatch color-swatch-custom" title="Couleur personnalisée">
            <input
              type="color"
              onChange={(e) => {
                onPick(e.target.value);
                setOpen(false);
              }}
            />
          </label>
          <button
            type="button"
            className="color-swatch color-swatch-clear"
            title="Retirer la couleur"
            onClick={() => {
              onClear();
              setOpen(false);
            }}
          >
            <Ban size={13} />
          </button>
        </div>
      )}
    </div>
  );
}
