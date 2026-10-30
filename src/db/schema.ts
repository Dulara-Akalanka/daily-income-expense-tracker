import type { SQLiteDatabase } from 'expo-sqlite';

export const DATABASE_NAME = 'expense-tracker.db';

/** Row-level sync state, mirrored to Firestore by the sync engine. */
export const SyncStatus = {
  PENDING: 0,
  SYNCED: 1,
} as const;

/*
 * Conventions
 * - All timestamps are epoch milliseconds (INTEGER).
 * - `exchange_rate_to_usd` = units of that currency per 1 USD (the shape
 *   open.er-api.com returns for base=USD), so USD = 1, LKR ≈ 300.
 * - Rows are soft-deleted via `deleted_at` so deletions can be synced.
 * - `tags` is a JSON array of strings.
 */
const SCHEMA_V1 = `
CREATE TABLE IF NOT EXISTS currencies (
  code                 TEXT PRIMARY KEY NOT NULL,
  symbol               TEXT NOT NULL,
  name                 TEXT NOT NULL,
  exchange_rate_to_usd REAL NOT NULL CHECK (exchange_rate_to_usd > 0),
  updated_at           INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS categories (
  id          TEXT PRIMARY KEY NOT NULL,
  name        TEXT NOT NULL,
  parent_id   TEXT REFERENCES categories(id) ON DELETE CASCADE,
  icon        TEXT NOT NULL DEFAULT 'shape-outline',
  color       TEXT NOT NULL DEFAULT '#9E9E9E',
  type        TEXT NOT NULL CHECK (type IN ('INCOME', 'EXPENSE')),
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  deleted_at  INTEGER,
  sync_status INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_categories_type ON categories(type);

-- cycle_type MONTHLY: calendar month (start_day = 1)
-- cycle_type CUSTOM:  pay-period starting on start_day (1-31, clamped to month length)
-- cycle_type WEEKLY:  start_day is the weekday (0 = Sunday ... 6 = Saturday)
-- category_id NULL means an overall budget across all expense categories.
CREATE TABLE IF NOT EXISTS budgets (
  id          TEXT PRIMARY KEY NOT NULL,
  category_id TEXT REFERENCES categories(id) ON DELETE CASCADE,
  amount      REAL NOT NULL CHECK (amount > 0),
  cycle_type  TEXT NOT NULL CHECK (cycle_type IN ('MONTHLY', 'WEEKLY', 'CUSTOM')),
  start_day   INTEGER NOT NULL DEFAULT 1,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  deleted_at  INTEGER,
  sync_status INTEGER NOT NULL DEFAULT 0,
  CHECK (
    (cycle_type = 'WEEKLY' AND start_day BETWEEN 0 AND 6) OR
    (cycle_type <> 'WEEKLY' AND start_day BETWEEN 1 AND 31)
  )
);
CREATE INDEX IF NOT EXISTS idx_budgets_category ON budgets(category_id);

-- base_currency + exchange_rate record the conversion used at entry time, so
-- base_amount can be recomputed if the user later changes base currency.
CREATE TABLE IF NOT EXISTS transactions (
  id            TEXT PRIMARY KEY NOT NULL,
  type          TEXT NOT NULL CHECK (type IN ('INCOME', 'EXPENSE')),
  amount        REAL NOT NULL CHECK (amount > 0),
  currency      TEXT NOT NULL,
  base_amount   REAL NOT NULL,
  base_currency TEXT NOT NULL,
  exchange_rate REAL NOT NULL,
  category_id   TEXT REFERENCES categories(id) ON DELETE SET NULL,
  date          INTEGER NOT NULL,
  note          TEXT,
  tags          TEXT NOT NULL DEFAULT '[]',
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL,
  deleted_at    INTEGER,
  sync_status   INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_transactions_pending ON transactions(sync_status) WHERE sync_status = 0;
`;

/** Offline fallback rates (approximate). Replaced by the first successful API sync. */
const FALLBACK_CURRENCIES: ReadonlyArray<readonly [code: string, symbol: string, name: string, perUsd: number]> = [
  ['USD', '$', 'US Dollar', 1],
  ['EUR', '€', 'Euro', 0.92],
  ['GBP', '£', 'British Pound', 0.79],
  ['JPY', '¥', 'Japanese Yen', 150],
  ['LKR', 'Rs', 'Sri Lankan Rupee', 300],
  ['INR', '₹', 'Indian Rupee', 84],
  ['AUD', 'A$', 'Australian Dollar', 1.52],
  ['CAD', 'C$', 'Canadian Dollar', 1.37],
  ['SGD', 'S$', 'Singapore Dollar', 1.34],
  ['CHF', 'Fr', 'Swiss Franc', 0.88],
  ['CNY', '¥', 'Chinese Yuan', 7.2],
  ['AED', 'د.إ', 'UAE Dirham', 3.67],
];

interface SeedCategory {
  id: string;
  name: string;
  icon: string;
  color: string;
  type: 'INCOME' | 'EXPENSE';
  children?: ReadonlyArray<{ id: string; name: string; icon: string }>;
}

/*
 * Stable ids (not UUIDs) so the same default category on two devices maps to
 * the same Firestore document instead of duplicating after sync.
 */
const DEFAULT_CATEGORIES: ReadonlyArray<SeedCategory> = [
  {
    id: 'cat_food', name: 'Food', icon: 'food', color: '#FF7043', type: 'EXPENSE',
    children: [
      { id: 'cat_food_groceries', name: 'Groceries', icon: 'cart' },
      { id: 'cat_food_restaurants', name: 'Restaurants', icon: 'silverware-fork-knife' },
      { id: 'cat_food_coffee', name: 'Coffee', icon: 'coffee' },
    ],
  },
  {
    id: 'cat_utilities', name: 'Utilities', icon: 'lightning-bolt', color: '#FFB300', type: 'EXPENSE',
    children: [
      { id: 'cat_utilities_electricity', name: 'Electricity', icon: 'flash' },
      { id: 'cat_utilities_water', name: 'Water', icon: 'water' },
      { id: 'cat_utilities_internet', name: 'Internet', icon: 'wifi' },
      { id: 'cat_utilities_mobile', name: 'Mobile', icon: 'cellphone' },
    ],
  },
  {
    id: 'cat_transport', name: 'Transport', icon: 'car', color: '#42A5F5', type: 'EXPENSE',
    children: [
      { id: 'cat_transport_fuel', name: 'Fuel', icon: 'gas-station' },
      { id: 'cat_transport_public', name: 'Public Transport', icon: 'bus' },
      { id: 'cat_transport_taxi', name: 'Taxi', icon: 'taxi' },
    ],
  },
  {
    id: 'cat_entertainment', name: 'Entertainment', icon: 'movie-open', color: '#AB47BC', type: 'EXPENSE',
    children: [
      { id: 'cat_entertainment_subscriptions', name: 'Subscriptions', icon: 'play-box-multiple' },
      { id: 'cat_entertainment_events', name: 'Events', icon: 'ticket' },
      { id: 'cat_entertainment_games', name: 'Games', icon: 'gamepad-variant' },
    ],
  },
  { id: 'cat_shopping', name: 'Shopping', icon: 'shopping', color: '#EC407A', type: 'EXPENSE' },
  { id: 'cat_health', name: 'Health', icon: 'medical-bag', color: '#26A69A', type: 'EXPENSE' },
  { id: 'cat_other_expense', name: 'Other', icon: 'dots-horizontal-circle', color: '#78909C', type: 'EXPENSE' },
  {
    id: 'cat_income', name: 'Income', icon: 'cash-multiple', color: '#66BB6A', type: 'INCOME',
    children: [
      { id: 'cat_income_salary', name: 'Salary', icon: 'briefcase' },
      { id: 'cat_income_freelance', name: 'Freelance', icon: 'laptop' },
      { id: 'cat_income_gifts', name: 'Gifts', icon: 'gift' },
      { id: 'cat_income_interest', name: 'Interest', icon: 'bank' },
    ],
  },
];

async function seedDefaults(db: SQLiteDatabase): Promise<void> {
  const now = Date.now();

  for (const [code, symbol, name, perUsd] of FALLBACK_CURRENCIES) {
    await db.runAsync(
      'INSERT OR IGNORE INTO currencies (code, symbol, name, exchange_rate_to_usd, updated_at) VALUES (?, ?, ?, ?, 0)',
      code, symbol, name, perUsd,
    );
  }

  const insertCategory =
    `INSERT OR IGNORE INTO categories
       (id, name, parent_id, icon, color, type, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;

  for (const [i, parent] of DEFAULT_CATEGORIES.entries()) {
    await db.runAsync(insertCategory, parent.id, parent.name, null, parent.icon, parent.color, parent.type, i, now, now);
    for (const [j, child] of (parent.children ?? []).entries()) {
      // Children inherit the parent's colour so charts group visually.
      await db.runAsync(insertCategory, child.id, child.name, parent.id, child.icon, parent.color, parent.type, j, now, now);
    }
  }
}

interface Migration {
  version: number;
  up: (db: SQLiteDatabase) => Promise<void>;
}

/** Append-only. Never edit a shipped migration; add a new version instead. */
const MIGRATIONS: ReadonlyArray<Migration> = [
  {
    version: 1,
    up: async (db) => {
      await db.execAsync(SCHEMA_V1);
      await seedDefaults(db);
    },
  },
];

/** Pass to `<SQLiteProvider onInit={migrateDbIfNeeded}>`. */
export async function migrateDbIfNeeded(db: SQLiteDatabase): Promise<void> {
  // Connection-level pragmas; these cannot run inside a transaction.
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const currentVersion = row?.user_version ?? 0;

  for (const migration of MIGRATIONS) {
    if (migration.version <= currentVersion) continue;
    await db.withTransactionAsync(async () => {
      await migration.up(db);
      await db.execAsync(`PRAGMA user_version = ${migration.version}`);
    });
  }
}
