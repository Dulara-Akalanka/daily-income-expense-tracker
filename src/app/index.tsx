import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSQLiteContext } from 'expo-sqlite';
import { type ComponentProps, useEffect, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { FAB, List, Text, useTheme } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getRecentTransactions, type RecentTransaction } from '@/db/repositories/transactionRepository';
import { useUiStore } from '@/store/uiStore';
import { formatMoney } from '@/utils/money';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

// Placeholder home screen until the dashboard feature lands.
export default function HomeScreen() {
  const db = useSQLiteContext();
  const theme = useTheme();
  const openAddSheet = useUiStore((s) => s.openAddSheet);
  const dataVersion = useUiStore((s) => s.dataVersion);
  const [recent, setRecent] = useState<RecentTransaction[]>([]);

  useEffect(() => {
    getRecentTransactions(db).then(setRecent).catch(console.error);
  }, [db, dataVersion]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Text variant="headlineMedium" style={styles.title}>
        Recent
      </Text>
      <FlatList
        data={recent}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <List.Item
            title={item.categoryName ?? 'Uncategorised'}
            description={[new Date(item.date).toLocaleDateString(), item.note].filter(Boolean).join(' · ')}
            left={() => (
              <View style={[styles.icon, { backgroundColor: `${item.categoryColor ?? '#9E9E9E'}26` }]}>
                <MaterialCommunityIcons
                  name={(item.categoryIcon ?? 'shape-outline') as IconName}
                  size={20}
                  color={item.categoryColor ?? '#9E9E9E'}
                />
              </View>
            )}
            right={() => (
              <Text
                variant="titleMedium"
                style={[styles.amount, { color: item.type === 'INCOME' ? '#2E7D32' : theme.colors.onSurface }]}
              >
                {item.type === 'INCOME' ? '+' : '−'}
                {formatMoney(item.amount, item.currency)}
              </Text>
            )}
          />
        )}
        ListEmptyComponent={
          <Text variant="bodyLarge" style={styles.empty}>
            No transactions yet. Tap + to add one.
          </Text>
        }
      />
      <FAB icon="plus" style={styles.fab} onPress={openAddSheet} accessibilityLabel="Add transaction" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  title: { paddingHorizontal: 16, paddingVertical: 12, fontWeight: '600' },
  list: { paddingBottom: 96 },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
  amount: { alignSelf: 'center' },
  empty: { textAlign: 'center', marginTop: 48, opacity: 0.6 },
  fab: { position: 'absolute', right: 16, bottom: 32 },
});
