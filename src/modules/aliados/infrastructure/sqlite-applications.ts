import { randomUUID } from 'node:crypto';
import { getSqliteDatabase } from '@/shared/database/sqlite.mjs';
import type { AllyApplication, ApplicationReceipt } from '../domain/application';

export function recordApplication(userId: string, input: AllyApplication) {
  const database = getSqliteDatabase();
  return database.transaction(() => {
    database.prepare(`
      INSERT INTO postulaciones_aliados (id, usuario_id, solicitud_id, rol, datos_json, creada_en)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(usuario_id, solicitud_id) DO NOTHING
    `).run(randomUUID(), userId, input.requestId, input.role, JSON.stringify(input.details), new Date().toISOString());
    return database.prepare<[string, string], ApplicationReceipt>(`
      SELECT id, rol AS role, estado AS status, creada_en AS createdAt
      FROM postulaciones_aliados WHERE usuario_id = ? AND solicitud_id = ?
    `).get(userId, input.requestId)!;
  }).immediate();
}

export function listApplications(userId: string) {
  return getSqliteDatabase().prepare<[string], ApplicationReceipt>(`
    SELECT id, rol AS role, estado AS status, creada_en AS createdAt
    FROM postulaciones_aliados WHERE usuario_id = ? ORDER BY creada_en DESC, id LIMIT 20
  `).all(userId);
}
