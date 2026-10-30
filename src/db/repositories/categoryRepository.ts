import type { SQLiteDatabase } from 'expo-sqlite';

import type { Category, CategoryNode, TransactionType } from '../types';

interface CategoryRow {
  id: string;
  name: string;
  parent_id: string | null;
  icon: string;
  color: string;
  type: TransactionType;
  sort_order: number;
}

function toCategory(row: CategoryRow): Category {
  return {
    id: row.id,
    name: row.name,
    parentId: row.parent_id,
    icon: row.icon,
    color: row.color,
    type: row.type,
    sortOrder: row.sort_order,
  };
}

/** Two-level Parent > Child tree for one transaction type, sorted for display. */
export async function getCategoryTree(db: SQLiteDatabase, type: TransactionType): Promise<CategoryNode[]> {
  const rows = await db.getAllAsync<CategoryRow>(
    `SELECT id, name, parent_id, icon, color, type, sort_order
       FROM categories
      WHERE type = ? AND deleted_at IS NULL
      ORDER BY sort_order, name`,
    type,
  );

  const parents = new Map<string, CategoryNode>();
  for (const row of rows) {
    if (row.parent_id === null) parents.set(row.id, { ...toCategory(row), children: [] });
  }
  for (const row of rows) {
    if (row.parent_id !== null) parents.get(row.parent_id)?.children.push(toCategory(row));
  }
  return [...parents.values()];
}
