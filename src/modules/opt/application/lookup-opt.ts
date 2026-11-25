import { OptQuery, OptQueryError, type OptMatch } from '../domain/opt';
import { potSource } from '../domain/sources.mjs';

export interface OptUnit {
  id: string;
  label: string;
}

export interface OptInventory {
  dataDate: string | null;
  counts: { parcels: number; zones: number; addresses: number; units: number };
}

export interface OptRepository {
  inventory(): OptInventory;
  units(): OptUnit[];
  unit(unitId: string): OptUnit | undefined;
  findParcel(code: string): OptMatch[];
  findAddress(address: string): OptMatch[];
}

function isReady(inventory: OptInventory) {
  const { parcels, zones, units } = inventory.counts;
  return parcels > 0 && zones > 0 && units > 0;
}

export function createOpt(repository: OptRepository) {
  return {
    catalog() {
      const inventory = repository.inventory();
      return {
        status: isReady(inventory) ? 'ready' : 'not_imported',
        units: repository.units(),
        counts: inventory.counts,
        source: { ...potSource, dataDate: inventory.dataDate },
      };
    },
    lookup(input: Record<string, unknown>) {
      const query = new OptQuery(input);
      const inventory = repository.inventory();
      const source = { ...potSource, dataDate: inventory.dataDate };
      if (!isReady(inventory)) {
        return {
          status: 'not_imported',
          matches: [],
          source,
          message: 'La cartografía aún no está disponible en SINTRABAS. Puedes consultar el visor municipal.',
        };
      }
      const unit = query.unitId ? repository.unit(query.unitId) : undefined;
      if (query.unitId && !unit) throw new OptQueryError('Selecciona una unidad de uso del catálogo municipal.');
      const matches = query.parcelCode ? repository.findParcel(query.parcelCode) : repository.findAddress(query.text);
      const status = matches.length === 0 ? 'not_found' : matches.length === 1 ? 'found' : 'ambiguous';
      const message = {
        not_found: 'No encontramos una coincidencia en los datos disponibles. Verifica la dirección o prueba con el código predial.',
        ambiguous: 'Encontramos varias coincidencias. Confirma la ubicación exacta en el visor municipal.',
        found: query.parcelCode
          ? 'Cartografía consultada en el centroide del predio. Confirma los límites y el uso específico en la consulta municipal.'
          : 'Coincidencia en el índice histórico de direcciones del prototipo. Confirma el predio en el visor municipal.',
      }[status];
      return { status, matches, source, message, ...(unit ? { unit } : {}) };
    },
  };
}
