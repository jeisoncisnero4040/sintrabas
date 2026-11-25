import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import nextEnv from '@next/env';
import { formatOptAddress } from '../src/modules/opt/domain/address.mjs';
import { potLayers, potParcels, referenceSource, unitsSource } from '../src/modules/opt/domain/sources.mjs';
import { openSqliteDatabase, sqlitePath } from '../src/shared/database/sqlite.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const pageSize = 2000;

async function fetchText(url) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return await response.text();
    } catch (error) {
      if (attempt === 3) throw new Error('No se pudo leer ' + new URL(url).origin + ': ' + error.message);
      await new Promise(done => setTimeout(done, attempt * 350));
    }
  }
}

async function arcgis(source, params) {
  const query = new URL(source.url + '/query');
  query.search = new URLSearchParams({ f: 'json', where: '1=1', ...params });
  const result = JSON.parse(await fetchText(query));
  if (result.error) throw new Error(source.name + ': ' + (result.error.message || 'falló la consulta cartográfica'));
  return result;
}

function polygonRow(source, feature) {
  const { attributes, geometry } = feature;
  const rings = geometry?.rings;
  const label = attributes[source.label]?.trim();
  if (!label || !Array.isArray(rings) || !rings.length) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const ring of rings) {
    for (const [x, y] of ring) {
      minX = Math.min(x, minX);
      minY = Math.min(y, minY);
      maxX = Math.max(x, maxX);
      maxY = Math.max(y, maxY);
    }
  }
  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) return null;
  return [attributes.FID, label, attributes.OTROS?.trim() || null, JSON.stringify(rings), minX, maxX, minY, maxY];
}

function parcelRow(feature) {
  const { attributes, centroid } = feature;
  const parcelCode = attributes.codigo?.trim();
  const oldCode = attributes.codigo_ant?.trim();
  if (!parcelCode || !Number.isFinite(centroid?.x) || !Number.isFinite(centroid?.y)) return null;
  return [attributes.FID, parcelCode, oldCode || null, centroid.x, centroid.y];
}

async function dataset(source, geometry) {
  const { count } = await arcgis(source, { returnCountOnly: 'true' });
  if (!Number.isSafeInteger(count) || count < 1) throw new Error(source.name + ': cantidad no válida');

  const countPages = Math.ceil(count / pageSize);
  let consumed = 0;
  const records = [];
  const seen = new Set();
  for (let page = 0; page < countPages; page++) {
    const result = await arcgis(source, {
      outFields: source.fields,
      orderByFields: 'FID ASC',
      resultOffset: String(page * pageSize),
      resultRecordCount: String(pageSize),
      returnGeometry: String(geometry),
      returnCentroid: String(!geometry),
      geometryPrecision: '7',
      outSR: '4326',
    });
    if (result.spatialReference?.wkid !== 4326 || !Array.isArray(result.features)) {
      throw new Error(source.name + ': geometría o proyección inesperada');
    }
    for (const feature of result.features) {
      const fid = feature.attributes?.FID;
      if (!Number.isSafeInteger(fid) || seen.has(fid)) throw new Error(source.name + ': registro repetido o sin FID');
      seen.add(fid);
      const row = geometry ? polygonRow(source, feature) : parcelRow(feature);
      if (row) records.push(row);
    }
    consumed += result.features.length;
  }
  if (consumed !== count || !records.length) throw new Error(source.name + ': no se recibió la capa completa');
  console.log(source.name + ': ' + records.length + ' de ' + count);
  return { source, records, count };
}

function decodeOptionLabel(text) {
  const named = { amp: '&', nbsp: ' ', quot: '"', apos: "'", lt: '<', gt: '>' };
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/giu, (source, entity) => {
    if (entity.startsWith('#')) {
      const hex = entity[1].toLowerCase() === 'x';
      const code = Number.parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10);
      if (code <= 0x10ffff) return String.fromCodePoint(code);
    }
    return named[entity] ?? source;
  }).replace(/\s+/gu, ' ').trim();
}

async function catalog() {
  const html = await fetchText(unitsSource.url);
  const options = [...html.matchAll(/<option\s+value\s*=\s*['"](\d+)['"]\s*>([\s\S]*?)<\/option>/giu)]
    .map(([, id, name]) => [id, decodeOptionLabel(name)]);
  if (!options.length || new Set(options.map(([id]) => id)).size !== options.length || options.some(([, title]) => !title)) {
    throw new Error('No se pudo leer el catálogo municipal de unidades de uso.');
  }
  console.log(unitsSource.name + ': ' + options.length);
  return options;
}

async function addresses() {
  const referencePath = process.env.OPT_REFERENCE_HTML || resolve(root, '../app/old.html');
  const html = await readFile(referencePath, 'utf8').catch(error => {
    if (error.code === 'ENOENT') return null;
    throw error;
  });
  if (!html) {
    console.log('Referencia old.html ausente. Se importan las capas y los códigos prediales oficiales.');
    return [];
  }

  const source = /^const POT\s*=\s*(.+);\s*$/mu.exec(html)?.[1];
  const attributes = /^const POT_ATTR\s*=\s*(.+);\s*$/mu.exec(html)?.[1];
  const buffer = /^const POT_B64\s*=\s*'([A-Za-z0-9+/=]+)';\s*$/mu.exec(html)?.[1];
  if (!source || !attributes || !buffer) throw new Error('El índice de direcciones no se encontró en el prototipo.');
  const tables = JSON.parse(source);
  const details = JSON.parse(attributes);
  const index = gunzipSync(Buffer.from(buffer, 'base64')).toString('utf8');
  const rows = new Map();
  for (const line of index.split('\n')) {
    if (!line.trim()) continue;
    const [route, cross, entries] = line.split('|');
    if (!route || !cross || entries === undefined) continue;
    for (const item of entries.split(',')) {
      const [plate, ref] = item.split(':');
      const detail = details[Number.parseInt(ref, 36)];
      if (!plate || !detail) continue;
      const [area, treatment, , , neighborhood, , commune] = detail.split('.').map(Number);
      rows.set([route, cross, plate].join('|'), [
        formatOptAddress(route, cross, plate),
        tables.area[area]?.[0] || null,
        tables.trat[treatment]?.[0] || null,
        tables.barrio[neighborhood] || null,
        tables.comuna[commune] || null,
      ]);
    }
  }
  if (!rows.size) throw new Error('El índice de direcciones del prototipo está vacío.');
  console.log(referenceSource.name + ': ' + rows.size);
  return [...rows.entries()];
}

function store(database, { parcels, layers, units, reference }) {
  const date = new Date().toISOString();
  database.transaction(() => {
    database.exec(`
      DELETE FROM opt_capas_limites;
      DELETE FROM opt_capas;
      DELETE FROM opt_predios;
      DELETE FROM opt_unidades;
      DELETE FROM opt_direcciones_referencia;
      DELETE FROM opt_fuentes;
    `);
    const source = database.prepare('INSERT INTO opt_fuentes (codigo, nombre, url, importado_en, total) VALUES (?, ?, ?, ?, ?)');
    const parcel = database.prepare(`
      INSERT INTO opt_predios (fuente, fid, codigo, codigo_anterior, longitud, latitud)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const polygon = database.prepare(`
      INSERT INTO opt_capas (fuente, fid, nombre, detalle, anillos_json)
      VALUES (?, ?, ?, ?, ?)
    `);
    const bounds = database.prepare('INSERT INTO opt_capas_limites (id, min_x, max_x, min_y, max_y) VALUES (?, ?, ?, ?, ?)');
    const unit = database.prepare('INSERT INTO opt_unidades (codigo, nombre, fuente) VALUES (?, ?, ?)');
    const address = database.prepare(`
      INSERT INTO opt_direcciones_referencia (clave, direccion, area_actividad, tratamiento, barrio, comuna, fuente)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    for (const { source: layer, records, count } of parcels) {
      source.run(layer.id, layer.name, layer.url, date, count);
      for (const row of records) parcel.run(layer.id, ...row);
    }
    for (const { source: layer, records, count } of layers) {
      source.run(layer.id, layer.name, layer.url, date, count);
      for (const [fid, name, detail, rings, ...limits] of records) {
        const { lastInsertRowid } = polygon.run(layer.id, fid, name, detail, rings);
        bounds.run(lastInsertRowid, ...limits);
      }
    }
    source.run(unitsSource.id, unitsSource.name, unitsSource.url, date, units.length);
    for (const row of units) unit.run(...row, unitsSource.id);
    if (reference.length) {
      source.run(referenceSource.id, referenceSource.name, referenceSource.url, date, reference.length);
      for (const [key, row] of reference) address.run(key, ...row, referenceSource.id);
    }
  }).immediate();
}

try {
  nextEnv.loadEnvConfig(root, process.env.NODE_ENV !== 'production');
  const [parcels, layers, units, reference] = await Promise.all([
    Promise.all(potParcels.map(source => dataset(source, false))),
    Promise.all(potLayers.map(source => dataset(source, true))),
    catalog(),
    addresses(),
  ]);
  const database = openSqliteDatabase(sqlitePath(root));
  try {
    store(database, { parcels, layers, units, reference });
    console.log('OPT de Bucaramanga importado.');
  } finally {
    database.close();
  }
} catch (error) {
  console.error('No se pudo completar la importación OPT:', error.message);
  process.exitCode = 1;
}
