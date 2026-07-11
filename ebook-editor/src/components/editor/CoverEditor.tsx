import { useRef } from 'react';
import { ImagePlus, X } from 'lucide-react';
import { useBookStore } from '../../store/book';

export function CoverEditor() {
  const meta = useBookStore((s) => s.book.meta);
  const updateMeta = useBookStore((s) => s.updateMeta);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCoverImageChosen = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => updateMeta({ coverImage: reader.result as string });
    reader.readAsDataURL(file);
    e.target.value = '';
  };

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

      <div className="cover-field">
        Image de couverture (optionnelle)
        {meta.coverImage ? (
          <div className="cover-image-preview">
            <img src={meta.coverImage} alt="Aperçu de la couverture" />
            <button type="button" onClick={() => updateMeta({ coverImage: null })} title="Retirer l'image">
              <X size={14} /> Retirer
            </button>
          </div>
        ) : (
          <button type="button" className="cover-image-upload-btn" onClick={() => fileInputRef.current?.click()}>
            <ImagePlus size={16} /> Choisir une image de fond
          </button>
        )}
        <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={handleCoverImageChosen} />
      </div>
    </div>
  );
}
