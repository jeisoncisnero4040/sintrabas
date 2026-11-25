import type Database from 'better-sqlite3';
import type { ConsentEvidence } from '../index';

export const sqliteConsentStore = {
  record(database: Database.Database, userId: string, evidence: readonly ConsentEvidence[]): void {
    const insert = database.prepare(`
      INSERT INTO consentimientos (usuario_id, tipo, version, aceptado, registrado_en)
      VALUES (?, ?, ?, ?, ?)
    `);
    for (const entry of evidence) {
      insert.run(userId, entry.kind, entry.version, Number(entry.accepted), entry.recordedAt.toISOString());
    }
  },
};
