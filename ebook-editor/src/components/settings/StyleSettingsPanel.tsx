import { useBookStore } from '../../store/book';
import { FONT_OPTIONS } from '../../types';
import type { StyleSettings } from '../../types';

const FONT_SIZES = [9, 10, 11, 12, 13, 14, 16, 18];
const LINE_HEIGHTS = [1, 1.15, 1.3, 1.5, 1.75, 2];

export function StyleSettingsPanel() {
  const book = useBookStore((s) => s.book);
  const selectedChapterId = useBookStore((s) => s.selectedChapterId);
  const selectedSectionId = useBookStore((s) => s.selectedSectionId);
  const updateGlobalStyle = useBookStore((s) => s.updateGlobalStyle);
  const updatePageSettings = useBookStore((s) => s.updatePageSettings);
  const updateChapterStyle = useBookStore((s) => s.updateChapterStyle);
  const updateSectionStyle = useBookStore((s) => s.updateSectionStyle);

  const chapter = book.chapters.find((c) => c.id === selectedChapterId);
  const section = chapter?.sections.find((s) => s.id === selectedSectionId);

  return (
    <div className="settings-panel">
      <section className="settings-block">
        <h3>Mise en page (livre entier)</h3>
        <label className="settings-row">
          Format de page
          <select
            value={book.pageSettings.format}
            onChange={(e) => updatePageSettings({ format: e.target.value as 'A4' | 'A5' })}
          >
            <option value="A5">A5</option>
            <option value="A4">A4</option>
          </select>
        </label>
        <div className="settings-row margins-row">
          <span>Marges (mm)</span>
          <div className="margins-grid">
            {(['top', 'right', 'bottom', 'left'] as const).map((side) => (
              <label key={side}>
                {marginLabel(side)}
                <input
                  type="number"
                  min={5}
                  max={50}
                  value={book.pageSettings.margins[side]}
                  onChange={(e) =>
                    updatePageSettings({ margins: { ...book.pageSettings.margins, [side]: Number(e.target.value) } })
                  }
                />
              </label>
            ))}
          </div>
        </div>
      </section>

      <section className="settings-block">
        <h3>Style global du livre</h3>
        <StyleFields style={book.globalStyle} onChange={updateGlobalStyle} />
      </section>

      {chapter && !section && (
        <section className="settings-block">
          <h3>Style du chapitre : {chapter.title}</h3>
          <p className="settings-hint">Laissez vide pour hériter du style global.</p>
          <StyleFields
            style={chapter.styleOverride ?? {}}
            onChange={(style) => updateChapterStyle(chapter.id, mergeOverride(chapter.styleOverride, style))}
            allowEmpty
          />
          {chapter.styleOverride && (
            <button className="reset-style-btn" onClick={() => updateChapterStyle(chapter.id, undefined)}>
              Réinitialiser au style global
            </button>
          )}
        </section>
      )}

      {chapter && section && (
        <section className="settings-block">
          <h3>Style de la section : {section.title}</h3>
          <p className="settings-hint">Laissez vide pour hériter du chapitre / style global.</p>
          <StyleFields
            style={section.styleOverride ?? {}}
            onChange={(style) =>
              updateSectionStyle(chapter.id, section.id, mergeOverride(section.styleOverride, style))
            }
            allowEmpty
          />
          {section.styleOverride && (
            <button className="reset-style-btn" onClick={() => updateSectionStyle(chapter.id, section.id, undefined)}>
              Réinitialiser au style hérité
            </button>
          )}
        </section>
      )}
    </div>
  );
}

function mergeOverride(
  current: Partial<StyleSettings> | undefined,
  patch: Partial<StyleSettings>
): Partial<StyleSettings> {
  return { ...current, ...patch };
}

function marginLabel(side: 'top' | 'right' | 'bottom' | 'left') {
  return { top: 'Haut', right: 'Droite', bottom: 'Bas', left: 'Gauche' }[side];
}

function StyleFields({
  style,
  onChange,
  allowEmpty,
}: {
  style: Partial<StyleSettings>;
  onChange: (style: Partial<StyleSettings>) => void;
  allowEmpty?: boolean;
}) {
  return (
    <>
      <label className="settings-row">
        Police
        <select
          value={style.fontFamily ?? ''}
          onChange={(e) => onChange({ fontFamily: e.target.value || undefined })}
        >
          {allowEmpty && <option value="">— Hérité —</option>}
          {FONT_OPTIONS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
      </label>
      <label className="settings-row">
        Taille
        <select
          value={style.fontSize ?? ''}
          onChange={(e) => onChange({ fontSize: e.target.value ? Number(e.target.value) : undefined })}
        >
          {allowEmpty && <option value="">— Héritée —</option>}
          {FONT_SIZES.map((size) => (
            <option key={size} value={size}>
              {size} pt
            </option>
          ))}
        </select>
      </label>
      <label className="settings-row">
        Interligne
        <select
          value={style.lineHeight ?? ''}
          onChange={(e) => onChange({ lineHeight: e.target.value ? Number(e.target.value) : undefined })}
        >
          {allowEmpty && <option value="">— Hérité —</option>}
          {LINE_HEIGHTS.map((lh) => (
            <option key={lh} value={lh}>
              {lh}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}
