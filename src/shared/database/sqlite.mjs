import { createHash } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import Database from 'better-sqlite3';
import { identityAndPrivacy } from './migrations/001-identidad-privacidad.mjs';
import { externalIdentities } from './migrations/002-identidades-externas.mjs';
import { workspaces } from './migrations/003-espacios-de-trabajo.mjs';
import { optBucaramanga } from './migrations/004-opt-bucaramanga.mjs';
import { simulatedDomains } from './migrations/005-dominios-simulados.mjs';
import { cadastralAddresses } from './migrations/006-direcciones-catastrales.mjs';
import { allyApplications } from './migrations/007-postulaciones-aliados.mjs';

const migrations = [identityAndPrivacy, externalIdentities, workspaces, optBucaramanga, simulatedDomains, cadastralAddresses, allyApplications];
const connectionKey = Symbol.for('sintrabas.sqlite.connection');
const migrationKey = Symbol.for('sintrabas.sqlite.migration');
const latestMigration = migrations.at(-1).id;

export function sqlitePath(directory = process.cwd()) {
  return resolve(directory, process.env.SQLITE_PATH?.trim() || 'data/sintrabas.sqlite');
}

function migrate(database) {
  database.transaction(() => {
    database.exec(`
      CREATE TABLE IF NOT EXISTS migraciones (
        archivo TEXT PRIMARY KEY,
        checksum TEXT NOT NULL,
        aplicada_en TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      ) STRICT;
    `);

    const applied = database.prepare('SELECT checksum FROM migraciones WHERE archivo = ?');
    const record = database.prepare('INSERT INTO migraciones (archivo, checksum) VALUES (?, ?)');
    for (const migration of migrations) {
      const sql = migration.sql.replaceAll('\r\n', '\n');
      const checksum = createHash('sha256').update(sql).digest('hex');
      const existing = applied.get(migration.id);
      if (existing) {
        if (existing.checksum !== checksum) throw new Error(`La migración aplicada ${migration.id} cambió.`);
        continue;
      }

      database.exec(sql);
      record.run(migration.id, checksum);
    }
  }).immediate();
}

export function openSqliteDatabase(filename = sqlitePath()) {
  mkdirSync(dirname(filename), { recursive: true, mode: 0o700 });
  const database = new Database(filename, { timeout: 5000 });
  try {
    database.pragma('foreign_keys = ON');
    migrate(database);
    return database;
  } catch (error) {
    database.close();
    throw error;
  }
}

export function getSqliteDatabase() {
  let database = globalThis[connectionKey];
  if (!database?.open) {
    database = openSqliteDatabase();
    globalThis[connectionKey] = database;
  } else if (globalThis[migrationKey] !== latestMigration) {
    // Next.js puede recargar el módulo mientras conserva abierta la conexión.
    migrate(database);
  }
  globalThis[migrationKey] = latestMigration;
  return database;
}
