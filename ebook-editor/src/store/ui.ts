import { create } from 'zustand';

export type RightTab = 'reglages' | 'apercu';
export type MobilePanel = 'structure' | 'editeur' | 'panneau';

interface UiState {
  rightTab: RightTab;
  setRightTab: (tab: RightTab) => void;
  pendingPrint: boolean;
  requestPdfExport: () => void;
  clearPendingPrint: () => void;
  mobilePanel: MobilePanel;
  setMobilePanel: (panel: MobilePanel) => void;
}

export const useUiStore = create<UiState>((set) => ({
  rightTab: 'reglages',
  setRightTab: (tab) => set({ rightTab: tab }),
  pendingPrint: false,
  requestPdfExport: () => set({ rightTab: 'apercu', pendingPrint: true, mobilePanel: 'panneau' }),
  clearPendingPrint: () => set({ pendingPrint: false }),
  mobilePanel: 'editeur',
  setMobilePanel: (panel) => set({ mobilePanel: panel }),
}));
