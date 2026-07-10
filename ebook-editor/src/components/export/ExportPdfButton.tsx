import { FileDown } from 'lucide-react';
import { useUiStore } from '../../store/ui';

export function ExportPdfButton() {
  const requestPdfExport = useUiStore((s) => s.requestPdfExport);

  return (
    <button type="button" className="export-pdf-btn" onClick={requestPdfExport} title="Exporter en PDF">
      <FileDown size={16} />
      Exporter en PDF
    </button>
  );
}
