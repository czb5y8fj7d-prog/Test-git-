import { useBookStore } from '../../store/book';
import {
  FONT_OPTIONS,
  STYLE_PRESETS,
  ACCENT_COLOR_SWATCHES,
  PAGE_BACKGROUND_SWATCHES,
} from '../../types';
import type { StyleSettings, StylePreset, ChapterNumbering } from '../../types';

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
  const updateTheme = useBookStore((s) => s.updateTheme);
  const applyPreset = useBookStore((s) => s.applyPreset);

  const chapter = book.chapters.find((c) => c.id === selectedChapterId);
  const section = chapter?.sections.find((s) => s.id === selectedSectionId);

  return (
    <div className="settings-panel">
      <details className="settings-accordion" open>
        <summary>Modèles de style</summary>
        <div className="accordion-body">
          <p className="settings-hint">Applique en un clic une police, une couleur et un format cohérents.</p>
          <div className="preset-grid">
            {STYLE_PRESETS.map((preset) => (
              <PresetButton key={preset.id} preset={preset} onApply={() => applyPreset(preset)} />
            ))}
          </div>
        </div>
      </details>

      <details className="settings-accordion" open>
        <summary>Mise en page (livre entier)</summary>
        <div className="accordion-body">
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
        </div>
      </details>

      <details className="settings-accordion" open>
        <summary>Couleurs &amp; thème</summary>
        <div className="accordion-body">
          <div className="settings-row swatch-row">
            <span>Couleur d'accent</span>
            <SwatchRow
              swatches={ACCENT_COLOR_SWATCHES}
              value={book.theme.accentColor}
              onPick={(color) => updateTheme({ accentColor: color })}
            />
          </div>
          <div className="settings-row swatch-row">
            <span>Fond de page</span>
            <SwatchRow
              swatches={PAGE_BACKGROUND_SWATCHES}
              value={book.theme.pageBackgroundColor}
              onPick={(color) => updateTheme({ pageBackgroundColor: color })}
            />
          </div>
          <label className="settings-row">
            Lettrine en début de chapitre
            <input
              type="checkbox"
              checked={book.theme.dropCapEnabled}
              onChange={(e) => updateTheme({ dropCapEnabled: e.target.checked })}
            />
          </label>
          <label className="settings-row">
            Numérotation des chapitres
            <select
              value={book.theme.chapterNumbering}
              onChange={(e) => updateTheme({ chapterNumbering: e.target.value as ChapterNumbering })}
            >
              <option value="none">Titre seul</option>
              <option value="numeric">« Chapitre 1 — Titre »</option>
            </select>
          </label>
        </div>
      </details>

      <details className="settings-accordion" open>
        <summary>Typographie (style global)</summary>
        <div className="accordion-body">
          <StyleFields style={book.globalStyle} onChange={updateGlobalStyle} />
        </div>
      </details>

      {chapter && !section && (
        <details className="settings-accordion" open>
          <summary>Style du chapitre : {chapter.title}</summary>
          <div className="accordion-body">
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
          </div>
        </details>
      )}

      {chapter && section && (
        <details className="settings-accordion" open>
          <summary>Style de la section : {section.title}</summary>
          <div className="accordion-body">
            <p className="settings-hint">Laissez vide pour hériter du chapitre / style global.</p>
            <StyleFields
              style={section.styleOverride ?? {}}
              onChange={(style) =>
                updateSectionStyle(chapter.id, section.id, mergeOverride(section.styleOverride, style))
              }
              allowEmpty
            />
            {section.styleOverride && (
              <button
                className="reset-style-btn"
                onClick={() => updateSectionStyle(chapter.id, section.id, undefined)}
              >
                Réinitialiser au style hérité
              </button>
            )}
          </div>
        </details>
      )}
    </div>
  );
}

function PresetButton({ preset, onApply }: { preset: StylePreset; onApply: () => void }) {
  return (
    <button type="button" className="preset-btn" onClick={onApply} style={{ borderColor: preset.accentColor }}>
      <span className="preset-swatch" style={{ background: preset.accentColor }} />
      <span className="preset-label">{preset.label}</span>
      <span className="preset-desc">{preset.description}</span>
    </button>
  );
}

function SwatchRow({
  swatches,
  value,
  onPick,
}: {
  swatches: string[];
  value: string;
  onPick: (color: string) => void;
}) {
  return (
    <div className="inline-swatch-row">
      {swatches.map((color) => (
        <button
          key={color}
          type="button"
          className={`inline-swatch ${value === color ? 'active' : ''}`}
          style={{ background: color }}
          onClick={() => onPick(color)}
          title={color}
        />
      ))}
      <label className="inline-swatch inline-swatch-custom" title="Couleur personnalisée">
        <input type="color" value={value} onChange={(e) => onPick(e.target.value)} />
      </label>
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
