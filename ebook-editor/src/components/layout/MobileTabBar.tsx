import { List, PenLine, SlidersHorizontal } from 'lucide-react';
import { useUiStore } from '../../store/ui';

export function MobileTabBar() {
  const mobilePanel = useUiStore((s) => s.mobilePanel);
  const setMobilePanel = useUiStore((s) => s.setMobilePanel);

  return (
    <nav className="mobile-tab-bar">
      <button
        type="button"
        className={mobilePanel === 'structure' ? 'active' : ''}
        onClick={() => setMobilePanel('structure')}
      >
        <List size={18} />
        Structure
      </button>
      <button
        type="button"
        className={mobilePanel === 'editeur' ? 'active' : ''}
        onClick={() => setMobilePanel('editeur')}
      >
        <PenLine size={18} />
        Éditeur
      </button>
      <button
        type="button"
        className={mobilePanel === 'panneau' ? 'active' : ''}
        onClick={() => setMobilePanel('panneau')}
      >
        <SlidersHorizontal size={18} />
        Réglages
      </button>
    </nav>
  );
}
