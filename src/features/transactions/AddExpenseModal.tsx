import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { Button, Chip, HelperText, IconButton, SegmentedButtons, Text, TextInput, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getCategoryTree } from '@/db/repositories/categoryRepository';
import { getCurrencies } from '@/db/repositories/currencyRepository';
import { createTransaction } from '@/db/repositories/transactionRepository';
import type { CategoryNode, Currency, TransactionType } from '@/db/types';
import { useSettingsStore } from '@/store/settingsStore';
import { useUiStore } from '@/store/uiStore';
import { convert, currencyDecimals, formatMoney, roundMoney } from '@/utils/money';

import { applyPadKey, clampDecimals, extractTags, formatAmountInput, parseAmount, type PadKey } from './amountInput';
import { CategoryChips } from './components/CategoryChips';
import { CurrencyPicker } from './components/CurrencyPicker';
import { NumberPad } from './components/NumberPad';

type Panel = 'pad' | 'currency';
type DayOffset = 0 | 1;

const EMPTY_TREES: Record<TransactionType, CategoryNode[]> = { EXPENSE: [], INCOME: [] };

/**
 * Global quick-entry sheet. Mount once at the root and open it from anywhere
 * with `useUiStore.getState().openAddSheet()`. Staying mounted keeps the
 * open animation instant: no screen push and no cold data fetch.
 */
export function AddExpenseModal() {
  const db = useSQLiteContext();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const visible = useUiStore((s) => s.isAddSheetOpen);
  const closeSheet = useUiStore((s) => s.closeAddSheet);
  const bumpDataVersion = useUiStore((s) => s.bumpDataVersion);
  const baseCurrency = useSettingsStore((s) => s.baseCurrency);
  const lastUsedCurrency = useSettingsStore((s) => s.lastUsedCurrency);
  const setLastUsedCurrency = useSettingsStore((s) => s.setLastUsedCurrency);

  const [type, setType] = useState<TransactionType>('EXPENSE');
  const [amountText, setAmountText] = useState('');
  const [currencyCode, setCurrencyCode] = useState(baseCurrency);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [dayOffset, setDayOffset] = useState<DayOffset>(0);
  const [note, setNote] = useState('');
  const [panel, setPanel] = useState<Panel>('pad');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [categoryTrees, setCategoryTrees] = useState(EMPTY_TREES);
  const [currencies, setCurrencies] = useState<Currency[]>([]);

  // Reset the form and refresh reference data on every open. The queries are
  // tiny indexed reads, so they finish well within the slide-in animation.
  useEffect(() => {
    if (!visible) return;

    setType('EXPENSE');
    setAmountText('');
    setCurrencyCode(lastUsedCurrency ?? baseCurrency);
    setCategoryId(null);
    setDayOffset(0);
    setNote('');
    setPanel('pad');
    setError(null);

    let cancelled = false;
    Promise.all([getCategoryTree(db, 'EXPENSE'), getCategoryTree(db, 'INCOME'), getCurrencies(db)])
      .then(([expense, income, allCurrencies]) => {
        if (cancelled) return;
        setCategoryTrees({ EXPENSE: expense, INCOME: income });
        setCurrencies(allCurrencies);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load categories');
      });
    return () => {
      cancelled = true;
    };
    // Only re-run when the sheet opens; settings are read at that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, db]);

  const currencyByCode = useMemo(() => new Map(currencies.map((c) => [c.code, c])), [currencies]);
  const selectedCurrency = currencyByCode.get(currencyCode);
  const base = currencyByCode.get(baseCurrency);
  const decimals = currencyDecimals(currencyCode);
  const amount = parseAmount(amountText);

  const convertedPreview =
    currencyCode !== baseCurrency && selectedCurrency && base && amount > 0
      ? formatMoney(roundMoney(convert(amount, selectedCurrency.rateToUsd, base.rateToUsd), baseCurrency), baseCurrency, base.symbol)
      : null;

  const canSave = amount > 0 && categoryId !== null && !saving;

  const handleKey = useCallback(
    (key: PadKey) => setAmountText((prev) => applyPadKey(prev, key, decimals)),
    [decimals],
  );
  const handleClear = useCallback(() => setAmountText(''), []);

  const handleTypeChange = (value: string) => {
    setType(value as TransactionType);
    setCategoryId(null);
  };

  const handleCurrencySelect = (code: string) => {
    setCurrencyCode(code);
    setAmountText((prev) => clampDecimals(prev, currencyDecimals(code)));
    setPanel('pad');
  };

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      const date = new Date();
      date.setDate(date.getDate() - dayOffset);
      const trimmedNote = note.trim();

      await createTransaction(db, {
        type,
        amount,
        currency: currencyCode,
        baseCurrency,
        categoryId,
        date: date.getTime(),
        note: trimmedNote || null,
        tags: extractTags(trimmedNote),
      });

      setLastUsedCurrency(currencyCode);
      bumpDataVersion();
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      closeSheet();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save transaction');
    } finally {
      setSaving(false);
    }
  };

  const amountColor = type === 'INCOME' ? '#2E7D32' : theme.colors.onSurface;

  return (
    <Modal visible={visible} animationType="slide" transparent statusBarTranslucent onRequestClose={closeSheet}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={closeSheet} accessibilityLabel="Dismiss" />

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View
            style={[
              styles.sheet,
              { backgroundColor: theme.colors.surface, paddingBottom: insets.bottom + 12 },
            ]}
          >
            <View style={[styles.handle, { backgroundColor: theme.colors.outlineVariant }]} />

            <View style={styles.headerRow}>
              <SegmentedButtons
                value={type}
                onValueChange={handleTypeChange}
                density="small"
                style={styles.segment}
                buttons={[
                  { value: 'EXPENSE', label: 'Expense', icon: 'arrow-up' },
                  { value: 'INCOME', label: 'Income', icon: 'arrow-down' },
                ]}
              />
              <IconButton icon="close" onPress={closeSheet} accessibilityLabel="Close" />
            </View>

            <View style={styles.amountBlock}>
              <Pressable
                onPress={() => setPanel(panel === 'currency' ? 'pad' : 'currency')}
                accessibilityRole="button"
                accessibilityLabel={`Currency ${currencyCode}. Tap to change`}
                style={[styles.currencyPill, { backgroundColor: theme.colors.secondaryContainer }]}
              >
                <Text variant="titleMedium" style={{ color: theme.colors.onSecondaryContainer }}>
                  {selectedCurrency?.symbol ?? ''} {currencyCode}
                </Text>
                <MaterialCommunityIcons
                  name={panel === 'currency' ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color={theme.colors.onSecondaryContainer}
                />
              </Pressable>

              <Text
                variant="displayMedium"
                numberOfLines={1}
                adjustsFontSizeToFit
                style={[styles.amount, { color: amountText ? amountColor : theme.colors.outline }]}
                accessibilityLiveRegion="polite"
              >
                {formatAmountInput(amountText)}
              </Text>

              <Text variant="bodySmall" style={[styles.preview, { color: theme.colors.onSurfaceVariant }]}>
                {convertedPreview ? `≈ ${convertedPreview}` : ' '}
              </Text>
            </View>

            <CategoryChips categories={categoryTrees[type]} selectedId={categoryId} onSelect={setCategoryId} />

            <View style={styles.metaRow}>
              <Chip compact selected={dayOffset === 0} showSelectedCheck={false} onPress={() => setDayOffset(0)}>
                Today
              </Chip>
              <Chip compact selected={dayOffset === 1} showSelectedCheck={false} onPress={() => setDayOffset(1)}>
                Yesterday
              </Chip>
              <TextInput
                dense
                mode="outlined"
                placeholder="Note  (#tags)"
                value={note}
                onChangeText={setNote}
                style={styles.note}
                maxLength={200}
                returnKeyType="done"
              />
            </View>

            {error && (
              <HelperText type="error" visible style={styles.error}>
                {error}
              </HelperText>
            )}

            <View style={styles.panel}>
              {panel === 'pad' ? (
                <NumberPad onKey={handleKey} onClear={handleClear} allowDecimal={decimals > 0} />
              ) : (
                <CurrencyPicker
                  currencies={currencies}
                  selectedCode={currencyCode}
                  baseCurrency={baseCurrency}
                  onSelect={handleCurrencySelect}
                  onClose={() => setPanel('pad')}
                />
              )}
            </View>

            <Button
              mode="contained"
              onPress={handleSave}
              disabled={!canSave}
              loading={saving}
              contentStyle={styles.saveContent}
              style={styles.save}
            >
              {categoryId === null && amount > 0 ? 'Pick a category' : `Save ${type === 'INCOME' ? 'income' : 'expense'}`}
            </Button>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 8,
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -4 },
    elevation: 16,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    paddingRight: 4,
  },
  segment: {
    flex: 1,
  },
  amountBlock: {
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  currencyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
  },
  amount: {
    fontWeight: '600',
    marginTop: 4,
  },
  preview: {
    marginTop: 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
  },
  note: {
    flex: 1,
  },
  error: {
    paddingHorizontal: 16,
  },
  panel: {
    paddingHorizontal: 12,
  },
  save: {
    marginHorizontal: 16,
    borderRadius: 16,
  },
  saveContent: {
    height: 52,
  },
});
