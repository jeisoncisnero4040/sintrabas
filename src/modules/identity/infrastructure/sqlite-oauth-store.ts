import type Database from 'better-sqlite3';
import { getSqliteDatabase } from '../../../shared/database/sqlite.mjs';
import type { ConsentEvidence } from '../../privacy';
import { sqliteConsentStore } from '../../privacy/infrastructure/sqlite-consent-store';
import type { OAuthFlow, OAuthStore } from '../application/oauth-store';
import type { PublicUser } from '../domain/account';
import type { ExternalIdentity } from '../domain/external-identity';
import { insertSqliteAccount, insertSqliteSession } from './sqlite-identity-writes';

interface StoredFlow extends Omit<OAuthFlow, 'consents' | 'linkSessionHash'> {
  consents: string | null;
  linkSessionHash: string | null;
}

interface SerializedEvidence extends Omit<ConsentEvidence, 'recordedAt'> {
  recordedAt: string;
}

function readFlow({ consents, linkSessionHash, ...flow }: StoredFlow): OAuthFlow {
  return {
    ...flow,
    consents: consents === null ? undefined : (JSON.parse(consents) as SerializedEvidence[])
      .map((entry) => ({ ...entry, recordedAt: new Date(entry.recordedAt) })),
    linkSessionHash: linkSessionHash ?? undefined,
  };
}

function findIdentityOwner(database: Database.Database, identity: ExternalIdentity): string | undefined {
  return database.prepare<[string, string], string>(`
    SELECT usuario_id FROM identidades_externas WHERE proveedor = ? AND sujeto = ?
  `).pluck().get(identity.provider, identity.subject);
}

function insertExternalIdentity(database: Database.Database, identity: ExternalIdentity, userId: string): void {
  database.prepare(`
    INSERT INTO identidades_externas (proveedor, sujeto, usuario_id) VALUES (?, ?, ?)
  `).run(identity.provider, identity.subject, userId);
}

export const sqliteOAuthStore: OAuthStore = {
  async createFlow(flow, now) {
    const database = getSqliteDatabase();
    database.transaction(() => {
      database.prepare('DELETE FROM oauth_flows WHERE expira_en <= ?').run(now.toISOString());
      database.prepare(`
        INSERT INTO oauth_flows (
          state_hash, browser_hash, proveedor, intencion, redirect_uri, verificador_pkce,
          nonce, consentimientos_json, link_session_hash, expira_en
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        flow.stateHash, flow.browserHash, flow.provider, flow.intent, flow.redirectUri, flow.codeVerifier,
        flow.nonce, flow.consents === undefined ? null : JSON.stringify(flow.consents),
        flow.linkSessionHash ?? null, flow.expiresAt.toISOString(),
      );
    }).immediate();
  },

  async consumeFlow(provider, stateHash, browserHash, now) {
    const stored = getSqliteDatabase().prepare<[string, string, string, string], StoredFlow>(`
      DELETE FROM oauth_flows
      WHERE state_hash = ? AND browser_hash = ? AND proveedor = ? AND expira_en > ?
      RETURNING proveedor AS provider, intencion AS intent, redirect_uri AS redirectUri,
                verificador_pkce AS codeVerifier, nonce, consentimientos_json AS consents,
                link_session_hash AS linkSessionHash
    `).get(stateHash, browserHash, provider, now.toISOString());
    return stored ? readFlow(stored) : null;
  },

  async findByExternalIdentity(identity) {
    return getSqliteDatabase().prepare<[string, string], PublicUser>(`
      SELECT u.id, u.nombre AS name, u.correo AS email
      FROM identidades_externas i
      JOIN usuarios u ON u.id = i.usuario_id
      WHERE i.proveedor = ? AND i.sujeto = ?
    `).get(identity.provider, identity.subject) ?? null;
  },

  async registerExternal({ identity, user, session, consents, previousTokenHash }) {
    const database = getSqliteDatabase();
    return database.transaction((): Awaited<ReturnType<OAuthStore['registerExternal']>> => {
      if (findIdentityOwner(database, identity)) return 'identity_exists';
      if (!insertSqliteAccount(database, { ...user, passwordHash: '' })) return 'email_conflict';

      insertExternalIdentity(database, identity, user.id);
      sqliteConsentStore.record(database, user.id, consents);
      insertSqliteSession(database, session, previousTokenHash);
      return 'created';
    }).immediate();
  },

  async linkIdentity(identity, sessionTokenHash, now) {
    const database = getSqliteDatabase();
    return database.transaction((): Awaited<ReturnType<OAuthStore['linkIdentity']>> => {
      const userId = database.prepare<[string, string], string>(`
        SELECT usuario_id FROM sesiones WHERE token_hash = ? AND expira_en > ?
      `).pluck().get(sessionTokenHash, now.toISOString());
      if (!userId) return 'unauthenticated';

      const owner = findIdentityOwner(database, identity);
      if (owner) return owner === userId ? 'linked' : 'identity_conflict';

      const linkedProvider = database.prepare<[string, string], number>(`
        SELECT 1 FROM identidades_externas WHERE usuario_id = ? AND proveedor = ?
      `).pluck().get(userId, identity.provider);
      if (linkedProvider) return 'identity_conflict';

      insertExternalIdentity(database, identity, userId);
      return 'linked';
    }).immediate();
  },
};
