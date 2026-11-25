import { getSqliteDatabase } from '@/shared/database/sqlite.mjs';
import type { OptInventory, OptRepository, OptUnit } from '../application/lookup-opt';
import { parseOptAddress } from '../domain/address.mjs';
import { containsPoint, type OptPolygon } from '../domain/opt';

interface InventoryRow {
  dataDate: string | null;
  parcels: number;
  zones: number;
  addresses: number;
  units: number;
}

interface ParcelRow {
  parcelCode: string;
  x: number;
  y: number;
}

interface PolygonRow {
  source: string;
  name: string;
  rings: string;
}

interface AddressRow {
  address: string;
  activityArea: string | null;
  urbanTreatment: string | null;
  neighborhood: string | null;
  commune: string | null;
}

const addressColumns = 'direccion AS address, area_actividad AS activityArea, tratamiento AS urbanTreatment, barrio AS neighborhood, comuna AS commune';

function mapParcel({ parcelCode, x, y }: ParcelRow) {
  const polygons = getSqliteDatabase().prepare<[number, number, number, number], PolygonRow>(`
    SELECT opt_capas.fuente AS source, opt_capas.nombre AS name, opt_capas.anillos_json AS rings
    FROM opt_capas_limites INNER JOIN opt_capas USING (id)
    WHERE min_x <= ? AND max_x >= ? AND min_y <= ? AND max_y >= ?
  `).all(x, x, y, y);
  const labels = new Map<string, Set<string>>();
  for (const polygon of polygons) {
    if (!containsPoint(JSON.parse(polygon.rings) as OptPolygon, x, y)) continue;
    const names = labels.get(polygon.source) ?? new Set<string>();
    names.add(polygon.name);
    labels.set(polygon.source, names);
  }
  const label = (source: string) => {
    const names = labels.get(source);
    return names ? [...names].sort().join(' · ') : undefined;
  };

  return {
    parcelCode,
    activityArea: label('areas'),
    urbanTreatment: label('tratamientos'),
    neighborhood: label('barrios'),
    commune: label('comunas'),
    precision: 'centroide_predial' as const,
  };
}

export const sqliteOpt: OptRepository = {
  inventory(): OptInventory {
    const summary = getSqliteDatabase().prepare<[], InventoryRow>(`
      SELECT
        (SELECT MAX(importado_en) FROM opt_fuentes WHERE codigo = 'areas') AS dataDate,
        (SELECT COUNT(*) FROM opt_predios) AS parcels,
        (SELECT COUNT(*) FROM opt_capas WHERE fuente = 'areas') AS zones,
        (SELECT COUNT(*) FROM opt_direcciones_referencia) AS addresses,
        (SELECT COUNT(*) FROM opt_unidades) AS units
    `).get()!;
    const { dataDate, ...counts } = summary;
    return { dataDate, counts };
  },

  units() {
    return getSqliteDatabase().prepare<[], OptUnit>(`
      SELECT codigo AS id, nombre AS label FROM opt_unidades ORDER BY nombre, codigo
    `).all();
  },

  unit(unitId) {
    return getSqliteDatabase().prepare<[string], OptUnit>(`
      SELECT codigo AS id, nombre AS label FROM opt_unidades WHERE codigo = ?
    `).get(unitId);
  },

  findParcel(code) {
    const rows = getSqliteDatabase().prepare<[string, string], ParcelRow>(`
      SELECT DISTINCT codigo AS parcelCode, longitud AS x, latitud AS y
      FROM opt_predios WHERE codigo = ? OR codigo_anterior = ?
      ORDER BY codigo, longitud, latitud LIMIT 12
    `).all(code, code);
    return rows.map(mapParcel);
  },

  findAddress(address) {
    const parts = parseOptAddress(address);
    if (!parts) return [];
    const key = [parts.route, parts.cross, parts.plate].join('|');
    const database = getSqliteDatabase();
    const rows = parts.plate
      ? database.prepare<[string], AddressRow>(`
          SELECT ${addressColumns} FROM opt_direcciones_referencia WHERE clave = ?
        `).all(key)
      : database.prepare<[string, string], AddressRow>(`
          SELECT ${addressColumns} FROM opt_direcciones_referencia
          WHERE clave >= ? AND clave < ? ORDER BY clave LIMIT 12
        `).all(key, key + '\uffff');
    return rows.map(row => ({
      address: row.address,
      activityArea: row.activityArea ?? undefined,
      urbanTreatment: row.urbanTreatment ?? undefined,
      neighborhood: row.neighborhood ?? undefined,
      commune: row.commune ?? undefined,
      precision: 'referencia_del_prototipo' as const,
    }));
  },
};
