import { useRef, useState } from 'react';
import { Download, Upload, Check } from 'lucide-react';
import { useBookStore } from '../../store/book';
import { exportBookToJsonFile, importBookFromJsonFile } from '../../lib/projectIO';
import { ExportPdfButton } from '../export/ExportPdfButton';

export function TopBar() {
  const book = useBookStore((s) => s.book);
  const replaceBook = useBookStore((s) => s.replaceBook);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [savedFlash, setSavedFlash] = useState(false);

  const handleExportJson = () => {
    exportBookToJsonFile(book);
  };

  const handleImportClick = () => fileInputRef.current?.click();

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const imported = await importBookFromJsonFile(file);
      if (confirm('Importer ce projet remplacera le livre actuellement ouvert. Continuer ?')) {
        replaceBook(imported);
        setSavedFlash(true);
        setTimeout(() => setSavedFlash(false), 1500);
      }
    } catch (err) {
      alert(`Impossible d'importer ce fichier : ${(err as Error).message}`);
    }
  };

  return (
    <header className="top-bar">
      <div className="top-bar-title">
        <span className="app-name">Éditeur d'ebook</span>
        <span className="book-title-preview">{book.meta.title || 'Sans titre'}</span>
      </div>
      <div className="top-bar-actions">
        {savedFlash && (
          <span className="autosave-flash">
            <Check size={14} /> Importé
          </span>
        )}
        <button type="button" onClick={handleImportClick} title="Importer un projet JSON">
          <Upload size={16} /> Importer
        </button>
        <input ref={fileInputRef} type="file" accept="application/json" hidden onChange={handleFileSelected} />
        <button type="button" onClick={handleExportJson} title="Exporter le projet en JSON">
          <Download size={16} /> Exporter JSON
        </button>
        <ExportPdfButton />
      </div>
    </header>
  );
}
