import { randomUUID } from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';

import { roundMoney } from '@/utils/money';

import { SyncStatus } from '../schema';
import type { Transaction, TransactionType } from '../types';

export interface NewTransactionInput {
  type: TransactionType;
  amount: number;
  currency: string;
  baseCurrency: string;
  categoryId: string | null;
  date: number;
  note: string | null;
  tags: string[];
}

/** Converts using the locally stored rates, so this works fully offline. */
export async function createTransaction(db: SQLiteDatabase, input: NewTransactionInput): Promise<Transaction> {
  if (!(input.amount > 0)) throw new Error('Amount must be greater than zero');

  const rates = await db.getAllAsync<{ code: string; exchange_rate_to_usd: number }>(
    'SELECT code, exchange_rate_to_usd FROM currencies WHERE code IN (?, ?)',
    input.currency, input.baseCurrency,
  );
  const perUsd = new Map(rates.map((r) => [r.code, r.exchange_rate_to_usd]));
  const fromRate = perUsd.get(input.currency);
  const toRate = perUsd.get(input.baseCurrency);
  if (fromRate === undefined || toRate === undefined) {
    throw new Error(`No exchange rate for ${input.currency} → ${input.baseCurrency}`);
  }

  const now = Date.now();
  const exchangeRate = toRate / fromRate;
  const transaction: Transaction = {
    id: randomUUID(),
    type: input.type,
    amount: roundMoney(input.amount, input.currency),
    currency: input.currency,
    baseAmount: roundMoney(input.amount * exchangeRate, input.baseCurrency),
    baseCurrency: input.baseCurrency,
    exchangeRate,
    categoryId: input.categoryId,
    date: input.date,
    note: input.note,
    tags: input.tags,
    createdAt: now,
    updatedAt: now,
  };

  await db.runAsync(
    `INSERT INTO transactions
       (id, type, amount, currency, base_amount, base_currency, exchange_rate,
        category_id, date, note, tags, created_at, updated_at, sync_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    transaction.id,
    transaction.type,
    transaction.amount,
    transaction.currency,
    transaction.baseAmount,
    transaction.baseCurrency,
    transaction.exchangeRate,
    transaction.categoryId,
    transaction.date,
    transaction.note,
    JSON.stringify(transaction.tags),
    transaction.createdAt,
    transaction.updatedAt,
    SyncStatus.PENDING,
  );

  return transaction;
}

export interface RecentTransaction {
  id: string;
  type: TransactionType;
  amount: number;
  currency: string;
  date: number;
  note: string | null;
  categoryName: string | null;
  categoryIcon: string | null;
  categoryColor: string | null;
}

export async function getRecentTransactions(db: SQLiteDatabase, limit = 20): Promise<RecentTransaction[]> {
  return db.getAllAsync<RecentTransaction>(
    `SELECT t.id, t.type, t.amount, t.currency, t.date, t.note,
            c.name AS categoryName, c.icon AS categoryIcon, c.color AS categoryColor
       FROM transactions t
       LEFT JOIN categories c ON c.id = t.category_id
      WHERE t.deleted_at IS NULL
      ORDER BY t.date DESC, t.created_at DESC
      LIMIT ?`,
    limit,
  );
}
