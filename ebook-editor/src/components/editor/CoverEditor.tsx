import { useBookStore } from '../../store/book';

export function CoverEditor() {
  const meta = useBookStore((s) => s.book.meta);
  const updateMeta = useBookStore((s) => s.updateMeta);

  return (
    <div className="cover-editor">
      <h2>Page de garde</h2>
      <p className="settings-hint">Ces informations apparaîtront sur la première page du livre exporté.</p>
      <label className="cover-field">
        Titre
        <input
          type="text"
          value={meta.title}
          onChange={(e) => updateMeta({ title: e.target.value })}
          placeholder="Titre du livre"
        />
      </label>
      <label className="cover-field">
        Sous-titre
        <input
          type="text"
          value={meta.subtitle}
          onChange={(e) => updateMeta({ subtitle: e.target.value })}
          placeholder="Sous-titre (optionnel)"
        />
      </label>
      <label className="cover-field">
        Auteur
        <input
          type="text"
          value={meta.author}
          onChange={(e) => updateMeta({ author: e.target.value })}
          placeholder="Nom de l'auteur"
        />
      </label>
    </div>
  );
}
