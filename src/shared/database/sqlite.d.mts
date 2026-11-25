import type Database from 'better-sqlite3';

export function sqlitePath(directory?: string): string;
export function openSqliteDatabase(filename?: string): Database.Database;
export function getSqliteDatabase(): Database.Database;
