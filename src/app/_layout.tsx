import { Stack } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { DATABASE_NAME, migrateDbIfNeeded } from '@/db/schema';
import { AddExpenseModal } from '@/features/transactions/AddExpenseModal';
import { useSettingsStore } from '@/store/settingsStore';
import { darkTheme, lightTheme } from '@/theme';

export default function RootLayout() {
  const systemScheme = useColorScheme();
  const themeMode = useSettingsStore((s) => s.themeMode);
  const isDark = themeMode === 'system' ? systemScheme === 'dark' : themeMode === 'dark';
  const theme = isDark ? darkTheme : lightTheme;

  return (
    <SafeAreaProvider>
      <PaperProvider theme={theme}>
        <SQLiteProvider databaseName={DATABASE_NAME} onInit={migrateDbIfNeeded}>
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.colors.background } }} />
          <AddExpenseModal />
          <StatusBar style={isDark ? 'light' : 'dark'} />
        </SQLiteProvider>
      </PaperProvider>
    </SafeAreaProvider>
  );
}
