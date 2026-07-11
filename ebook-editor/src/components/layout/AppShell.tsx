import { useEffect } from 'react';
import { useBookStore } from '../../store/book';
import { useUiStore } from '../../store/ui';
import { TopBar } from './TopBar';
import { MobileTabBar } from './MobileTabBar';
import { BookTree } from '../sidebar/BookTree';
import { EditorArea } from '../editor/EditorArea';
import { StyleSettingsPanel } from '../settings/StyleSettingsPanel';
import { PreviewPane } from '../preview/PreviewPane';

export function AppShell() {
  const hydrate = useBookStore((s) => s.hydrate);
  const hydrated = useBookStore((s) => s.hydrated);
  const rightTab = useUiStore((s) => s.rightTab);
  const setRightTab = useUiStore((s) => s.setRightTab);
  const mobilePanel = useUiStore((s) => s.mobilePanel);

  useEffect(() => {
    hydrate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!hydrated) {
    return <div className="app-loading">Chargement du projet…</div>;
  }

  return (
    <div className="app-shell">
      <TopBar />
      <MobileTabBar />
      <div className="app-body" data-mobile-panel={mobilePanel}>
        <BookTree />
        <EditorArea />
        <div className="right-panel">
          <div className="right-panel-tabs">
            <button
              type="button"
              className={rightTab === 'reglages' ? 'active' : ''}
              onClick={() => setRightTab('reglages')}
            >
              Réglages
            </button>
            <button
              type="button"
              className={rightTab === 'apercu' ? 'active' : ''}
              onClick={() => setRightTab('apercu')}
            >
              Aperçu
            </button>
          </div>
          <div className="right-panel-content" style={{ display: rightTab === 'reglages' ? 'block' : 'none' }}>
            <StyleSettingsPanel />
          </div>
          {rightTab === 'apercu' && (
            <div className="right-panel-content" style={{ display: 'flex' }}>
              <PreviewPane />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
