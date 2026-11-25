import type Database from 'better-sqlite3';
import type { SessionRecord } from '../application/identity-store';
import type { Account } from '../domain/account';

export function insertSqliteAccount(database: Database.Database, user: Account): boolean {
  const result = database.prepare(`
    INSERT INTO usuarios (id, nombre, correo, password_hash) VALUES (?, ?, ?, ?)
    ON CONFLICT (correo) DO NOTHING
  `).run(user.id, user.name, user.email, user.passwordHash);
  return result.changes === 1;
}

export function deleteSqliteSession(database: Database.Database, tokenHash: string): void {
  database.prepare('DELETE FROM sesiones WHERE token_hash = ?').run(tokenHash);
}

export function insertSqliteSession(database: Database.Database, session: SessionRecord, previousTokenHash?: string): void {
  database.prepare(`
    INSERT INTO sesiones (token_hash, usuario_id, expira_en) VALUES (?, ?, ?)
  `).run(session.tokenHash, session.userId, session.expiresAt.toISOString());

  if (previousTokenHash && previousTokenHash !== session.tokenHash) {
    deleteSqliteSession(database, previousTokenHash);
  }
}
