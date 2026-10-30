export type TransactionType = 'INCOME' | 'EXPENSE';

export interface Currency {
  code: string;
  symbol: string;
  name: string;
  /** Units of this currency per 1 USD. */
  rateToUsd: number;
  /** 0 = still using the bundled fallback rate. */
  updatedAt: number;
}

export interface Category {
  id: string;
  name: string;
  parentId: string | null;
  /** MaterialCommunityIcons glyph name. */
  icon: string;
  color: string;
  type: TransactionType;
  sortOrder: number;
}

export interface CategoryNode extends Category {
  children: Category[];
}

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  currency: string;
  baseAmount: number;
  baseCurrency: string;
  exchangeRate: number;
  categoryId: string | null;
  date: number;
  note: string | null;
  tags: string[];
  createdAt: number;
  updatedAt: number;
}
