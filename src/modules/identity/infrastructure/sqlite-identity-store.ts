import { getSqliteDatabase } from '../../../shared/database/sqlite.mjs';
import { sqliteConsentStore } from '../../privacy/infrastructure/sqlite-consent-store';
import type { IdentityStore } from '../application/identity-store';
import type { Account, PublicUser } from '../domain/account';
import { deleteSqliteSession, insertSqliteAccount, insertSqliteSession } from './sqlite-identity-writes';

export const sqliteIdentityStore: IdentityStore = {
  async findByEmail(email) {
    return getSqliteDatabase().prepare<[string], Account>(`
      SELECT id, nombre AS name, correo AS email, password_hash AS passwordHash
      FROM usuarios WHERE correo = ?
    `).get(email) ?? null;
  },

  async findBySessionTokenHash(tokenHash, now) {
    return getSqliteDatabase().prepare<[string, string], PublicUser>(`
      SELECT u.id, u.nombre AS name, u.correo AS email
      FROM sesiones s
      JOIN usuarios u ON u.id = s.usuario_id
      WHERE s.token_hash = ? AND s.expira_en > ?
    `).get(tokenHash, now.toISOString()) ?? null;
  },

  async register({ user, session, consents, previousTokenHash }) {
    const database = getSqliteDatabase();
    return database.transaction((): 'created' | 'email_conflict' => {
      if (!insertSqliteAccount(database, user)) return 'email_conflict';

      sqliteConsentStore.record(database, user.id, consents);
      insertSqliteSession(database, session, previousTokenHash);
      return 'created';
    }).immediate();
  },

  async createSession(session, previousTokenHash) {
    const database = getSqliteDatabase();
    database.transaction(() => insertSqliteSession(database, session, previousTokenHash)).immediate();
  },

  async deleteSession(tokenHash) {
    deleteSqliteSession(getSqliteDatabase(), tokenHash);
  },
};
