import { getSqliteDatabase } from '@/shared/database/sqlite.mjs';

export function findRegistered(names: string[]) {
  const rows = getSqliteDatabase().prepare<string[], { name: string }>(`
    SELECT nombre AS name FROM dominios_simulados WHERE nombre IN (${names.map(() => '?').join(', ')})
  `).all(...names);
  return new Set(rows.map(row => row.name));
}

export function catalogSize() {
  return getSqliteDatabase().prepare<[], { size: number }>('SELECT COUNT(*) AS size FROM dominios_simulados').get()?.size ?? 0;
}
