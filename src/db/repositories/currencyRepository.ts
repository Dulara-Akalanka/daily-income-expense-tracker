import type { SQLiteDatabase } from 'expo-sqlite';

import type { Currency } from '../types';

interface CurrencyRow {
  code: string;
  symbol: string;
  name: string;
  exchange_rate_to_usd: number;
  updated_at: number;
}

export async function getCurrencies(db: SQLiteDatabase): Promise<Currency[]> {
  const rows = await db.getAllAsync<CurrencyRow>(
    'SELECT code, symbol, name, exchange_rate_to_usd, updated_at FROM currencies ORDER BY code',
  );
  return rows.map((row) => ({
    code: row.code,
    symbol: row.symbol,
    name: row.name,
    rateToUsd: row.exchange_rate_to_usd,
    updatedAt: row.updated_at,
  }));
}

/** Applies rates (units per 1 USD) from the exchange-rate API to known currencies. */
export async function updateRates(db: SQLiteDatabase, ratesPerUsd: Record<string, number>, fetchedAt: number): Promise<void> {
  await db.withTransactionAsync(async () => {
    for (const [code, rate] of Object.entries(ratesPerUsd)) {
      if (!(rate > 0)) continue;
      await db.runAsync(
        'UPDATE currencies SET exchange_rate_to_usd = ?, updated_at = ? WHERE code = ?',
        rate, fetchedAt, code,
      );
    }
  });
}
