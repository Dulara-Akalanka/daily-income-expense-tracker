import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type ThemeMode = 'system' | 'light' | 'dark';

interface SettingsState {
  baseCurrency: string;
  /** Pre-selected in the Add Expense modal; null until the first save. */
  lastUsedCurrency: string | null;
  themeMode: ThemeMode;
  setBaseCurrency: (code: string) => void;
  setLastUsedCurrency: (code: string) => void;
  setThemeMode: (mode: ThemeMode) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      baseCurrency: 'USD',
      lastUsedCurrency: null,
      themeMode: 'system',
      setBaseCurrency: (baseCurrency) => set({ baseCurrency }),
      setLastUsedCurrency: (lastUsedCurrency) => set({ lastUsedCurrency }),
      setThemeMode: (themeMode) => set({ themeMode }),
    }),
    {
      name: 'settings',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
