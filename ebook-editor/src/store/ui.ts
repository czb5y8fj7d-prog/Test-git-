import { create } from 'zustand';

export type RightTab = 'reglages' | 'apercu';

interface UiState {
  rightTab: RightTab;
  setRightTab: (tab: RightTab) => void;
  pendingPrint: boolean;
  requestPdfExport: () => void;
  clearPendingPrint: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  rightTab: 'reglages',
  setRightTab: (tab) => set({ rightTab: tab }),
  pendingPrint: false,
  requestPdfExport: () => set({ rightTab: 'apercu', pendingPrint: true }),
  clearPendingPrint: () => set({ pendingPrint: false }),
}));
