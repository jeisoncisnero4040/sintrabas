import { fileURLToPath } from 'node:url';
import nextEnv from '@next/env';
import { openSqliteDatabase, sqlitePath } from '../src/shared/database/sqlite.mjs';

try {
  const root = fileURLToPath(new URL('../', import.meta.url));
  nextEnv.loadEnvConfig(root, process.env.NODE_ENV !== 'production');
  const filename = sqlitePath(root);
  const database = openSqliteDatabase(filename);
  database.close();
  console.log(`Base de datos SQLite lista en ${filename}`);
} catch (error) {
  console.error('Error al inicializar la base de datos SQLite.', error.message);
  process.exitCode = 1;
}
