import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { IconButton, List, Searchbar, Text, useTheme } from 'react-native-paper';

import type { Currency } from '@/db/types';
import { convert } from '@/utils/money';

interface CurrencyPickerProps {
  currencies: Currency[];
  selectedCode: string;
  baseCurrency: string;
  onSelect: (code: string) => void;
  onClose: () => void;
}

/**
 * Rendered inline inside the Add Expense sheet (swapped in for the number pad)
 * rather than as a nested modal, which avoids iOS stacked-modal glitches and
 * Paper Portals rendering behind a native Modal.
 */
export function CurrencyPicker({ currencies, selectedCode, baseCurrency, onSelect, onClose }: CurrencyPickerProps) {
  const theme = useTheme();
  const [query, setQuery] = useState('');

  const base = currencies.find((c) => c.code === baseCurrency);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = q
      ? currencies.filter((c) => c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q))
      : currencies;
    // Keep the base currency pinned to the top.
    return [...matches].sort((a, b) => Number(b.code === baseCurrency) - Number(a.code === baseCurrency));
  }, [currencies, query, baseCurrency]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Searchbar
          placeholder="Search currency"
          value={query}
          onChangeText={setQuery}
          style={styles.search}
          inputStyle={styles.searchInput}
          autoCorrect={false}
          autoCapitalize="characters"
        />
        <IconButton icon="close" onPress={onClose} accessibilityLabel="Close currency picker" />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.code}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => {
          const selected = item.code === selectedCode;
          const rateLabel =
            base && item.code !== baseCurrency
              ? `1 ${item.code} = ${convert(1, item.rateToUsd, base.rateToUsd).toFixed(4)} ${baseCurrency}`
              : 'Base currency';
          return (
            <List.Item
              title={`${item.code} · ${item.name}`}
              description={rateLabel}
              onPress={() => onSelect(item.code)}
              left={() => (
                <View style={[styles.symbol, { backgroundColor: theme.colors.secondaryContainer }]}>
                  <Text variant="titleSmall" style={{ color: theme.colors.onSecondaryContainer }}>
                    {item.symbol}
                  </Text>
                </View>
              )}
              right={(props) => (selected ? <List.Icon {...props} icon="check" color={theme.colors.primary} /> : null)}
              style={styles.item}
            />
          );
        }}
        ListEmptyComponent={
          <Text variant="bodyMedium" style={styles.empty}>
            No currency matches “{query}”
          </Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    // Matches the number pad's footprint so the sheet doesn't jump in height.
    height: 236,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  search: {
    flex: 1,
    height: 44,
  },
  searchInput: {
    minHeight: 44,
  },
  item: {
    paddingVertical: 2,
  },
  symbol: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  empty: {
    textAlign: 'center',
    marginTop: 24,
    opacity: 0.6,
  },
});
