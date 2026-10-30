import { create } from 'zustand';

interface UiState {
  isAddSheetOpen: boolean;
  /** Incremented after any local write so list/summary screens can re-query. */
  dataVersion: number;
  openAddSheet: () => void;
  closeAddSheet: () => void;
  bumpDataVersion: () => void;
}

export const useUiStore = create<UiState>()((set) => ({
  isAddSheetOpen: false,
  dataVersion: 0,
  openAddSheet: () => set({ isAddSheetOpen: true }),
  closeAddSheet: () => set({ isAddSheetOpen: false }),
  bumpDataVersion: () => set((s) => ({ dataVersion: s.dataVersion + 1 })),
}));
