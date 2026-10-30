import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';

import type { PadKey } from '../amountInput';

const ROWS: ReadonlyArray<ReadonlyArray<PadKey>> = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['.', '0', 'back'],
];

interface NumberPadProps {
  onKey: (key: PadKey) => void;
  /** Long-press on backspace. */
  onClear: () => void;
  allowDecimal: boolean;
}

export const NumberPad = memo(function NumberPad({ onKey, onClear, allowDecimal }: NumberPadProps) {
  const theme = useTheme();

  return (
    <View style={styles.pad}>
      {ROWS.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.row}>
          {row.map((key) => {
            const disabled = key === '.' && !allowDecimal;
            return (
              <Pressable
                key={key}
                disabled={disabled}
                onPress={() => {
                  void Haptics.selectionAsync();
                  onKey(key);
                }}
                onLongPress={key === 'back' ? onClear : undefined}
                accessibilityRole="button"
                accessibilityLabel={key === 'back' ? 'Delete digit' : key === '.' ? 'Decimal point' : key}
                style={({ pressed }) => [
                  styles.key,
                  { backgroundColor: pressed ? theme.colors.surfaceVariant : 'transparent' },
                ]}
              >
                {key === 'back' ? (
                  <MaterialCommunityIcons name="backspace-outline" size={26} color={theme.colors.onSurface} />
                ) : (
                  <Text variant="headlineMedium" style={disabled && styles.disabled}>
                    {key}
                  </Text>
                )}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  pad: {
    gap: 4,
  },
  row: {
    flexDirection: 'row',
    gap: 4,
  },
  key: {
    flex: 1,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.25,
  },
});
