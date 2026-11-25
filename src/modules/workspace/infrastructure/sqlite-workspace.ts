import { getSqliteDatabase } from '@/shared/database/sqlite.mjs';
import type { WorkspaceState } from '../domain/workspace-state';

interface WorkspaceRow {
  state: string;
  revision: number;
}

export function readWorkspace(userId: string) {
  const row = getSqliteDatabase().prepare<[string], WorkspaceRow>(`
    SELECT estado_json AS state, revision FROM espacios_de_trabajo WHERE usuario_id = ?
  `).get(userId);
  return row ? { state: JSON.parse(row.state) as WorkspaceState, revision: row.revision } : { state: null, revision: 0 };
}

export function writeWorkspace(userId: string, state: WorkspaceState, revision: number) {
  const database = getSqliteDatabase();
  const serialized = JSON.stringify(state);
  const result = revision === 0
    ? database.prepare(`
        INSERT INTO espacios_de_trabajo (usuario_id, estado_json, revision) VALUES (?, ?, 1)
        ON CONFLICT (usuario_id) DO NOTHING
      `).run(userId, serialized)
    : database.prepare(`
        UPDATE espacios_de_trabajo
        SET estado_json = ?, revision = revision + 1, actualizado_en = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        WHERE usuario_id = ? AND revision = ?
      `).run(serialized, userId, revision);
  return result.changes === 1 ? { state, revision: revision + 1 } : null;
}
