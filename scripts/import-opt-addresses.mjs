import { fileURLToPath } from 'node:url';
import nextEnv from '@next/env';
import { parseOptAddress } from '../src/modules/opt/domain/address.mjs';
import { cadastralSource } from '../src/modules/opt/domain/sources.mjs';
import { openSqliteDatabase, sqlitePath } from '../src/shared/database/sqlite.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const resource = 'https://www.datos.gov.co/resource/3qja-8idc.json';
const pageSize = 25000;

async function read(parameters) {
  const url = resource + '?' + new URLSearchParams(parameters);
  for (let attempt = 1; ; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(45000) });
      if (!response.ok) throw new Error(`Datos Abiertos respondió HTTP ${response.status}.`);
      const rows = await response.json();
      if (!Array.isArray(rows)) throw new Error('Respuesta inesperada del catálogo catastral.');
      return rows;
    } catch (error) {
      if (attempt === 3) throw error;
      await new Promise(resolve => setTimeout(resolve, attempt * 1000));
    }
  }
}

async function download() {
  const [{ count }] = await read({ $select: 'count(*)' });
  const expected = Number(count);
  if (!Number.isSafeInteger(expected) || expected < 1) throw new Error('El catálogo catastral está vacío.');
  const offsets = Array.from({ length: Math.ceil(expected / pageSize) }, (_, index) => index * pageSize);
  const addresses = new Map();
  let received = 0;
  for (let index = 0; index < offsets.length; index += 2) {
    const pages = await Promise.all(offsets.slice(index, index + 2).map(offset => read({
      $select: 'numero_del_predio,direccion', $order: ':id', $limit: pageSize, $offset: offset,
    })));
    for (const page of pages) {
      received += page.length;
      for (const { numero_del_predio: code, direccion } of page) {
        if (typeof code !== 'string' || !/^(?:\d{15}|68001\d{25})$/u.test(code) || typeof direccion !== 'string') continue;
        const parts = parseOptAddress(direccion);
        if (!parts?.plate) continue;
        const key = [parts.route, parts.cross, parts.plate].join('|');
        const codes = addresses.get(key) ?? new Set();
        codes.add(code);
        addresses.set(key, codes);
      }
    }
  }
  if (received !== expected || !addresses.size) throw new Error('La descarga catastral quedó incompleta.');
  return addresses;
}

nextEnv.loadEnvConfig(root, process.env.NODE_ENV !== 'production');
const addresses = await download();
const database = openSqliteDatabase(sqlitePath(root));
try {
  const count = database.transaction(() => {
    database.exec('DELETE FROM opt_direcciones_catastro');
    const insert = database.prepare('INSERT INTO opt_direcciones_catastro (clave, codigo_predial) VALUES (?, ?)');
    let total = 0;
    for (const [key, codes] of addresses) {
      for (const code of codes) {
        insert.run(key, code);
        total++;
      }
    }
    database.prepare(`
      INSERT INTO opt_fuentes (codigo, nombre, url, importado_en, total) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT (codigo) DO UPDATE SET nombre = excluded.nombre, url = excluded.url,
        importado_en = excluded.importado_en, total = excluded.total
    `).run(cadastralSource.id, cadastralSource.name, cadastralSource.url, new Date().toISOString(), total);
    return total;
  }).immediate();
  console.log(`${addresses.size} direcciones y ${count} cruces con códigos prediales importados.`);
} finally {
  database.close();
}
